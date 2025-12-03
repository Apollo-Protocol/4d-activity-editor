import { v4 as uuidv4 } from "uuid";
import { ActivityImpl } from "./ActivityImpl";
import {
  APOLLO_NS,
  activity,
  class_of_event,
  CONSISTS_OF_BY_CLASS,
  ENTITY_NAME,
  event,
  HQDMModel,
  HQDM_NS,
  kind_of_activity,
  kind_of_ordinary_physical_object,
  Maybe,
  ordinary_physical_object,
  organization,
  participant,
  PART_OF_BY_CLASS,
  person,
  possible_world,
  role,
  state_of_ordinary_physical_object,
  Thing,
  utcMillisecondsClass,
} from "@apollo-protocol/hqdm-lib";
import { IndividualImpl } from "./IndividualImpl";
import { Kind, Model } from "./Model";
import { EDITOR_VERSION } from "./version";
import { EntityType, Installation } from "./Schema";

import { ParticipationImpl } from "./ParticipationImpl";
// ... rest of existing imports ...

/**
 * ActivityLib
 */

// This is only used to confirm that the libary is loaded into a web page and accessible.
export const status = (): string => "OK";

// The IRI base for this application.
const EDITOR_NS = `${APOLLO_NS}/2023/diagram-editor`;
const EDITOR_REPR = `${EDITOR_NS}#hqdm-representation`;
export const BASE = `${EDITOR_NS}/diagram#`;

const AMRC_BASE = "https://www.amrc.co.uk/hqdm/activities#";

const currentReprVersion = "1";

// A well-known ENTITY_NAME used to find the AMRC Community entity.
const AMRC_COMMUNITY = "AMRC Community";

export const EPOCH_START = 0;
export const EPOCH_START_STR = EPOCH_START.toString();
export const EPOCH_END = 9999999999999;
export const EPOCH_END_STR = EPOCH_END.toString();

// Private HQDMModel for our classes and kinds
const diagramModel = new HQDMModel();

const diagramTimeUuid = "c9ecb65e-4b1f-4633-ac5c-f765e36586f2";
const diagramTimeIri = BASE + diagramTimeUuid;
const diagramTimeClass = diagramModel.createThing(
  class_of_event,
  diagramTimeIri
);

/**
 * Attempts to load a model from a string containing a TTL representation of the model.
 */
export const load = (ttl: string): Model | Error => {
  const hqdmModelOrErrors = HQDMModel.load(ttl);
  return hqdmModelOrErrors instanceof Error
    ? hqdmModelOrErrors
    : toModel(hqdmModelOrErrors);
};

/**
 * These options are needed by the N3 library when saving the model as TTL.
 * The prefixes are used to shorten the IRI's in the TTL.
 * The object can also be used to specify a different output format if needed.
 */
export const n3Options = {
  prefixes: {
    hqdm: HQDM_NS,
    diag: BASE,
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  },
};

/**
 * Save a UI Model to a string containing a TTL representation of the model.
 */
export const save = (model: Model): string => {
  const hqdm = toHQDM(model);
  return hqdm.save(n3Options);
};

/**
 * Save a UI Model to a JSON-LD representation of the model.
 *
 * The callback is called with the JSON-LD string.
 */
export const saveJSONLD = (
  model: Model,
  callback: (...args: any[]) => void
): void => {
  const hqdm = toHQDM(model);
  return hqdm.saveJSONLD(callback);
};

/**
 * Return a Model id for an HQDM Thing.
 */
const getModelId = (t: Thing): string => {
  return t.id.replace(BASE, "");
};

/**
 * Returns a time value from an HQDM Thing.
 * Only knows how to decode the utcMillisecondsClass.
 */
const getTimeValue = (hqdm: HQDMModel, t: Thing): number => {
  const name = hqdm.getEntityName(t);

  if (hqdm.isMemberOf(t, utcMillisecondsClass))
    return Number.parseInt(name, 10);

  /* For now translate +-Inf to the hardcoded epoch start and end values
   * above. This is a hack because the UI code makes assumptions about
   * these values; properly that code should be reworked. (Individuals
   * with no known beginning need their beginning set to -1, not to
   * EPOCH_START == 0.) If we attempt to load a file with out-of-epoch
   * times we will simply lose that information in the diagram. */
  if (hqdm.isMemberOf(t, diagramTimeClass)) {
    const n = Number.parseFloat(name);
    return n < EPOCH_START ? -1 : n >= EPOCH_END ? EPOCH_END : n;
  }

  console.log("getTimeValue: unknown class for %s", t.id);
  return Number.NaN;
};

/**
 * Returns HQDM point_in_time, creating it if it doesn't already exist.
 */
const createTimeValue = (
  hqdm: HQDMModel,
  modelWorld: Thing,
  time: number
): Thing => {
  /* Map the epoch start and end to +-Inf for output to the file. This
   * is cleaner than leaving magic numbers in the output. Possibly we
   * should simply omit the attribute altogether instead? */
  const f =
    time < EPOCH_START
      ? Number.NEGATIVE_INFINITY
      : time >= EPOCH_END
      ? Number.POSITIVE_INFINITY
      : time;

  var exists: boolean = false;
  const iri = BASE + uuidv4();
  var thing = new Thing(iri); // Placeholder thing as we don't know if we need to create one yet.

  // Test whether f value already exists in hqdm: HQDMModel
  hqdm.findByType(event).forEach((obj) => {
    const tVal = hqdm.getEntityName(obj);
    if (tVal == f.toString()) {
      exists = true;
      thing = obj;
    }
  });

  if (!exists) {
    thing = hqdm.createThing(event, iri);
    hqdm.addMemberOf(thing, diagramTimeClass);
    hqdm.relate(ENTITY_NAME, thing, new Thing(f.toString()));
    hqdm.addToPossibleWorld(thing, modelWorld);
  }

  return thing;
};

const checkReprVersion = (hqdm: HQDMModel) => {
  const reprVersion = hqdm.getVersionInfo(EDITOR_REPR);
  if (reprVersion == undefined) {
    hqdm.replaceIriPrefix(AMRC_BASE, BASE);
  } else if (reprVersion != currentReprVersion)
    throw new Error("Unrecognised data version");
};

// Custom predicates for our extensions
const ENTITY_TYPE_PREDICATE = `${EDITOR_NS}#entityType`;
const INSTALLATION_PREDICATE = `${EDITOR_NS}#hasInstallation`;
const INSTALLATION_TARGET_PREDICATE = `${EDITOR_NS}#installationTarget`;
const INSTALLATION_COMPONENT_PREDICATE = `${EDITOR_NS}#installationComponent`;
const INSTALLATION_BEGINNING_PREDICATE = `${EDITOR_NS}#installationBeginning`;
const INSTALLATION_ENDING_PREDICATE = `${EDITOR_NS}#installationEnding`;
const INSTALLATION_SC_CONTEXT_PREDICATE = `${EDITOR_NS}#installationSCContext`;
const INSTALLATION_SYSTEM_CONTEXT_PREDICATE = `${EDITOR_NS}#installationSystemContext`;
const PARTICIPATION_VIRTUAL_ROW_PREDICATE = `${EDITOR_NS}#participationVirtualRowId`;
const SORT_INDEX_PREDICATE = `${EDITOR_NS}#sortIndex`;

/**
 * Converts an HQDMModel to a UI Model.
 */
export const toModel = (hqdm: HQDMModel): Model => {
  checkReprVersion(hqdm);

  // Kinds are immutable so it's fine to use constant objects.
  // XXX These duplicate the code in lib/Model.ts.
  const ordPhysObjKind = new Kind(
    ordinary_physical_object.id,
    "Resource",
    true
  );
  const organizationKind = new Kind(organization.id, "Organization", true);
  const personKind = new Kind(person.id, "Person", true);
  const activityKind = new Kind(activity.id, "Task", true);
  const participantKind = new Kind(participant.id, "Participant", true);

  const communityName = new Thing(AMRC_COMMUNITY);
  const m = new Model();
  const isKindOfOrdinaryPhysicalObject = (x: Thing): boolean =>
    hqdm.isKindOf(x, kind_of_ordinary_physical_object);

  const kindOrDefault = (kind: Maybe<Thing>, defKind: Kind) => {
    if (!kind) return defKind;
    return new Kind(getModelId(kind!), hqdm.getEntityName(kind!), false);
  };

  // Get the name and description of the model from the possible world
  const possibleWorld = hqdm.findByType(possible_world).first(); // Assumes just one possible world
  if (possibleWorld) {
    m.name = hqdm.getIdentifications(possibleWorld, communityName).first()?.id;
    m.description = hqdm
      .getDescriptions(possibleWorld, communityName)
      .first()?.id;
  }

  // STEP 1: Load all individuals FIRST
  // Collect all candidates first so we can sort them by index
  const candidates: { thing: Thing; kind: Kind }[] = [];

  hqdm.findByType(ordinary_physical_object).forEach((obj) => {
    const kind = hqdm
      .memberOfKind(obj)
      .filter(isKindOfOrdinaryPhysicalObject)
      .first();
    const kindOfIndividual = kindOrDefault(kind, ordPhysObjKind);
    candidates.push({ thing: obj, kind: kindOfIndividual });
  });

  hqdm.findByType(person).forEach((persona) => {
    candidates.push({ thing: persona, kind: personKind });
  });

  hqdm.findByType(organization).forEach((org) => {
    candidates.push({ thing: org, kind: organizationKind });
  });

  // Helper to get sort index
  const getSortIndex = (thing: Thing): number | undefined => {
    const ref = hqdm.getRelated(thing, SORT_INDEX_PREDICATE).first();
    if (ref) {
      const val = parseInt(ref.id, 10);
      return isNaN(val) ? undefined : val;
    }
    return undefined;
  };

  // Sort candidates by index
  candidates.sort((a, b) => {
    const idxA = getSortIndex(a.thing);
    const idxB = getSortIndex(b.thing);

    if (idxA !== undefined && idxB !== undefined) {
      return idxA - idxB;
    }
    // If only one has index, prioritize it (though usually all or none will have it)
    if (idxA !== undefined) return -1;
    if (idxB !== undefined) return 1;

    // Fallback to name for deterministic order if no index exists
    const nameA = hqdm.getEntityName(a.thing) || "";
    const nameB = hqdm.getEntityName(b.thing) || "";
    return nameA.localeCompare(nameB);
  });

  // Add sorted individuals to model
  candidates.forEach((c) => {
    addIndividual(c.thing, hqdm, communityName, c.kind, m);
  });

  // STEP 2: Load installations BEFORE activities
  // This ensures virtual rows can be created properly
  loadInstallations(hqdm, m);

  // STEP 3: Now load activities with participations
  hqdm.findByType(activity).forEach((a) => {
    const id = getModelId(a);

    const identifications = hqdm.getIdentifications(a, communityName);
    const name = identifications.first()?.id ?? "No Name Found: " + a.id;

    const kinds = hqdm
      .memberOfKind(a)
      .filter((x) => hqdm.isKindOf(x, kind_of_activity));
    const kind = kinds.first((x) => (x ? true : false));
    const kindOfActivity = kindOrDefault(kind, activityKind);

    const activityFromEvent = hqdm.getBeginning(a);
    const activityToEvent = hqdm.getEnding(a);
    const beginning = activityFromEvent
      ? getTimeValue(hqdm, activityFromEvent)
      : 0;
    const ending = activityToEvent
      ? getTimeValue(hqdm, activityToEvent)
      : EPOCH_END;

    const descriptions = hqdm.getDescriptions(a, communityName);
    const description = descriptions.first()?.id;

    const partOf = hqdm.getPartOf(a).first();

    const newA = new ActivityImpl(
      id,
      name,
      kindOfActivity,
      beginning,
      ending,
      description,
      partOf ? getModelId(partOf) : undefined
    );
    m.addActivity(newA);

    // Find the participations to the activities and add them to the model.
    const participations = hqdm.getParticipants(a);
    participations.forEach((p) => {
      const participantRole = hqdm.getRole(p).first();
      const roleType = kindOrDefault(participantRole, participantKind);

      // Check if this participation has a virtual row ID saved
      const virtualRowRef = hqdm
        .getRelated(p, PARTICIPATION_VIRTUAL_ROW_PREDICATE)
        .first();

      const participantThing = hqdm.getTemporalWhole(p);

      if (virtualRowRef) {
        // Use the saved virtual row ID
        const virtualRowId = virtualRowRef.id;

        // Add participation directly using the virtual row ID
        // Don't create an IndividualImpl - just use the ID directly in the participation
        const participation = new ParticipationImpl(virtualRowId, roleType);
        newA.participations.set(virtualRowId, participation);
      } else {
        // Regular participation
        const indiv = participantThing
          ? m.individuals.get(getModelId(participantThing))
          : undefined;

        if (indiv) {
          newA.addParticipation(indiv, roleType);
        } else if (participantThing) {
          console.warn(
            `Could not find individual ${getModelId(
              participantThing
            )} for participation`
          );
        }
      }
    });
  });

  // STEP 4: Sort activities by beginning time to maintain correct order
  // First, get all activities as an array and sort them
  const sortedActivities = Array.from(m.activities.values()).sort((a, b) => {
    // First sort by beginning time
    if (a.beginning !== b.beginning) {
      return a.beginning - b.beginning;
    }
    // If same beginning, sort by ending time
    if (a.ending !== b.ending) {
      return a.ending - b.ending;
    }
    // If same times, sort by name
    return a.name.localeCompare(b.name);
  });

  // Clear and re-add activities in sorted order
  m.activities.clear();
  sortedActivities.forEach((activity) => {
    m.activities.set(activity.id, activity);
  });

  return addRefDataToModel(hqdm, m);
};

/**
 * Converts an HQDMModel to a UI Model with just the ref data.
 */
export const addRefDataToModel = (hqdm: HQDMModel, m: Model): Model => {
  hqdm.findByType(kind_of_ordinary_physical_object).forEach((i) => {
    const id = getModelId(i);
    const name = hqdm.getEntityName(i);
    m.addIndividualType(id, name);
  });

  hqdm.findByType(kind_of_activity).forEach((i) => {
    const id = getModelId(i);
    const name = hqdm.getEntityName(i);
    m.addActivityType(id, name);
  });

  hqdm.findByType(role).forEach((i) => {
    const id = getModelId(i);
    const name = hqdm.getEntityName(i);
    m.addRoleType(id, name);
  });

  return m;
};

/**
 * Converts a UI Model to an HQDMModel.
 *
 * @param model The UI Model to convert.
 * @returns The HQDMModel.
 */
export const toHQDM = (model: Model): HQDMModel => {
  // Create the HQDM Model and create some necssary HQDM things.
  const hqdm = new HQDMModel();
  hqdm.setVersionInfo(EDITOR_REPR, currentReprVersion);
  hqdm.setVersionInfo(EDITOR_NS, EDITOR_VERSION);

  // Normalise child activities to sit temporally within their parents.
  model.normalizeActivityBounds();

  // Save the kinds to the model.
  model.activityTypes
    .filter((a) => !a.isCoreHqdm)
    .forEach((a) => {
      const kind = hqdm.createThing(kind_of_activity, BASE + a.id);
      hqdm.relate(ENTITY_NAME, kind, new Thing(a.name));
    });
  model.individualTypes
    .filter((i) => !i.isCoreHqdm)
    .forEach((i) => {
      const kind = hqdm.createThing(
        kind_of_ordinary_physical_object,
        BASE + i.id
      );
      hqdm.relate(ENTITY_NAME, kind, new Thing(i.name));
    });
  model.roles
    .filter((r) => !r.isCoreHqdm)
    .forEach((r) => {
      const kind = hqdm.createThing(role, BASE + r.id);
      hqdm.relate(ENTITY_NAME, kind, new Thing(r.name));
    });

  const communityName = new Thing(AMRC_COMMUNITY);

  // Create a Possible World for the Model
  const modelWorld = hqdm.createThing(possible_world, BASE + uuidv4());

  // The possible world is a part of itself and the epoch start and end are also part of it.
  hqdm.addToPossibleWorld(modelWorld, modelWorld);

  const epochStart = createTimeValue(hqdm, modelWorld, EPOCH_START);
  const epochEnd = createTimeValue(hqdm, modelWorld, EPOCH_END);

  // Add the name and description of the model to the model world.
  if (model.name) {
    hqdm.addIdentification(
      BASE,
      modelWorld,
      modelWorld,
      new Thing(model.name),
      communityName,
      epochStart,
      epochEnd
    );
  }

  if (model.description) {
    hqdm.addDescription(
      BASE,
      modelWorld,
      modelWorld,
      new Thing(model.description),
      communityName,
      epochStart,
      epochEnd
    );
  }

  /**
   * Find or create the kind of individual and add the individual to the kind.
   *
   * This will find an HQDM kind corresponding to the UIModel kind,
   * creating it if necessary. If created this HQDM kind will derive
   * from the given base kind. Then the HDQM Thing will be made a member
   * of that kind. If the UIKind is undefined then the base kind will be
   * used directly.
   *
   * @param hqdmSt The Thing to set the kind of.
   * @param uiKind The UIModel Kind to build an HQDM kind from.
   * @param baseKind The base kind to derive the HQDM kind from.
   * @returns the HQDM kind.
   */
  const setKindFromUI = (
    hqdmSt: Thing,
    uiKind: Maybe<Kind>,
    baseKind: Thing
  ) => {
    if (!uiKind || uiKind.isCoreHqdm) {
      const stKind = uiKind ? new Thing(uiKind.id) : baseKind;
      hqdm.addMemberOfKind(hqdmSt, stKind);
      return stKind;
    }

    // The type is not actually optional - it's only optional because the UI model allows it to be undefined.
    const stKindId = BASE + uiKind.id;
    const stKind = hqdm.exists(stKindId)
      ? new Thing(stKindId)
      : hqdm.createThing(baseKind, stKindId);

    if (uiKind) {
      hqdm.relate(ENTITY_NAME, stKind, new Thing(uiKind.name)); // Set the entity name in case it was created
    }
    hqdm.addMemberOfKind(hqdmSt, stKind);
    return stKind;
  };

  // Add the individuals to the model
  let sortIndex = 0;
  model.individuals.forEach((i) => {
    // Create the individual and add it to the possible world, add the name and description.
    let playerEntityType;
    switch (i.type?.id) {
      case person.id:
        playerEntityType = person;
        break;
      case organization.id:
        playerEntityType = organization;
        break;
      default:
        playerEntityType = ordinary_physical_object;
    }
    const player = hqdm.createThing(playerEntityType, BASE + i.id);
    hqdm.addToPossibleWorld(player, modelWorld);

    // Save sort index to preserve order
    hqdm.relate(SORT_INDEX_PREDICATE, player, new Thing(sortIndex.toString()));
    sortIndex++;

    const individualStart = createTimeValue(hqdm, modelWorld, i.beginning);
    const individualEnd = createTimeValue(hqdm, modelWorld, i.ending);

    hqdm.beginning(player, individualStart);
    hqdm.ending(player, individualEnd);

    hqdm.addIdentification(
      BASE,
      modelWorld,
      player,
      new Thing(i.name),
      communityName,
      individualStart,
      individualEnd
    );
    if (i.description) {
      hqdm.addDescription(
        BASE,
        modelWorld,
        player,
        new Thing(i.description),
        communityName,
        individualStart,
        individualEnd
      );
    }

    setKindFromUI(player, i.type, kind_of_ordinary_physical_object);

    // Save entity type if present
    if (i.entityType) {
      hqdm.relate(ENTITY_TYPE_PREDICATE, player, new Thing(i.entityType));
    }

    // Save installations
    if (i.installations && i.installations.length > 0) {
      i.installations.forEach((inst) => {
        const instThing = hqdm.createThing(
          ordinary_physical_object,
          BASE + inst.id
        );
        hqdm.addToPossibleWorld(instThing, modelWorld);

        // Link installation to component
        hqdm.relate(INSTALLATION_PREDICATE, player, instThing);

        // Save installation properties
        hqdm.relate(
          INSTALLATION_TARGET_PREDICATE,
          instThing,
          new Thing(BASE + inst.targetId)
        );
        hqdm.relate(INSTALLATION_COMPONENT_PREDICATE, instThing, player);

        if (inst.beginning !== undefined) {
          hqdm.relate(
            INSTALLATION_BEGINNING_PREDICATE,
            instThing,
            new Thing(String(inst.beginning))
          );
        }
        if (inst.ending !== undefined) {
          hqdm.relate(
            INSTALLATION_ENDING_PREDICATE,
            instThing,
            new Thing(String(inst.ending))
          );
        }
        if (inst.scInstallationContextId) {
          hqdm.relate(
            INSTALLATION_SC_CONTEXT_PREDICATE,
            instThing,
            new Thing(BASE + inst.scInstallationContextId)
          );
        }
        if (inst.systemContextId) {
          hqdm.relate(
            INSTALLATION_SYSTEM_CONTEXT_PREDICATE,
            instThing,
            new Thing(BASE + inst.systemContextId)
          );
        }
      });
    }
  });

  // Add the activities to the model
  model.activities.forEach((a) => {
    // Create the temporal bounds for the activity.
    const activityFrom = createTimeValue(hqdm, modelWorld, a.beginning);
    const activityTo = createTimeValue(hqdm, modelWorld, a.ending);

    // Create the activity and add it to the possible world, add the name and description and temporal bounds.
    const act = hqdm.createThing(activity, BASE + a.id);
    hqdm.addToPossibleWorld(act, modelWorld);
    hqdm.addIdentification(
      BASE,
      modelWorld,
      act,
      new Thing(a.name),
      communityName,
      activityFrom,
      activityTo
    );
    if (a.description) {
      hqdm.addDescription(
        BASE,
        modelWorld,
        act,
        new Thing(a.description),
        communityName,
        activityFrom,
        activityTo
      );
    }
    const actKind = setKindFromUI(act, a.type, kind_of_activity);
    hqdm.beginning(act, activityFrom);
    hqdm.ending(act, activityTo);

    if (a.partOf) {
      hqdm.addPartOf(act, new Thing(BASE + a.partOf));
    }

    // Add the participations to the model
    a.participations.forEach((p) => {
      const participation = hqdm.createThing(
        state_of_ordinary_physical_object,
        BASE + uuidv4()
      );
      hqdm.addToPossibleWorld(participation, modelWorld);

      const pRole = setKindFromUI(participation, p.role, role);
      hqdm.addMemberOfKind(participation, participant);

      if (p.role && !p.role.isCoreHqdm) {
        hqdm.relate(PART_OF_BY_CLASS, pRole, actKind);
        hqdm.relate(CONSISTS_OF_BY_CLASS, actKind, pRole);
      }

      // Handle virtual row IDs for participations
      // Extract the original individual ID from virtual row format
      let actualIndividualId = p.individualId;
      const isVirtualRow = p.individualId.includes("__installed_in__");

      if (isVirtualRow) {
        actualIndividualId = p.individualId.split("__installed_in__")[0];
        // Save the full virtual row ID so we can restore it on load
        hqdm.relate(
          PARTICIPATION_VIRTUAL_ROW_PREDICATE,
          participation,
          new Thing(p.individualId)
        );
      }

      hqdm.addAsTemporalPartOf(
        participation,
        new Thing(BASE + actualIndividualId)
      );
      hqdm.addParticipant(participation, act);

      hqdm.beginning(participation, activityFrom);
      hqdm.ending(participation, activityTo);
    });
  });

  return hqdm;
};

/**
 * Get the kinds of activity, participant, and individual from the model and add them to a new HQDMModel then convert the HQDMModel to TTL and return it.
 *
 * @param model The model to convert to TTL.
 * @returns The TTL representation of the model.
 */
export const saveRefDataAsTTL = (m: Model): string => {
  const hqdm = new HQDMModel();

  // Add the kinds of activity to the model
  m.activityTypes.forEach((a) => {
    const actKind = hqdm.createThing(kind_of_activity, BASE + a.id);
    hqdm.relate(ENTITY_NAME, actKind, new Thing(a.name));
  });

  // Add the participant roles to the model
  m.roles.forEach((p) => {
    const pRole = hqdm.createThing(role, BASE + p.id);
    hqdm.relate(ENTITY_NAME, pRole, new Thing(p.name));
  });

  // Add the kinds of individual to the model
  m.individualTypes
    .filter((i) => i.isCoreHqdm === false)
    .forEach((i) => {
      const iKind = hqdm.createThing(
        kind_of_ordinary_physical_object,
        BASE + i.id
      );
      hqdm.relate(ENTITY_NAME, iKind, new Thing(i.name));
    });

  return hqdm.save(n3Options);
};

export const loadRefDataFromTTL = (ttl: string): Model | Error => {
  const hqdmModelOrErrors = HQDMModel.load(ttl);
  return hqdmModelOrErrors instanceof Error
    ? hqdmModelOrErrors
    : addRefDataToModel(hqdmModelOrErrors, new Model());
};

/**
 * Add an Individual to the model.
 *
 * @param thing The HQDM Individual to add to the model.
 * @param hqdm The HQDMModel containing the Individual.
 * @param communityName The name of the community that recognises the Individual.
 * @param kind The kind of Individual.
 * @param model The model to add the Individual to.
 * @returns void
 */
const addIndividual = (
  thing: Thing,
  hqdm: HQDMModel,
  communityName: Thing,
  kind: Kind,
  model: Model
): void => {
  const id = getModelId(thing); // The UI Model doesn't use IRIs, so remove the base.

  // Find the name signs recognised by the community for this individual.
  const identification = hqdm.getIdentifications(thing, communityName).first();
  const name = identification?.id ?? "No Name Found: " + thing.id; // Assumes just one name

  // Get the optional description of the individual.
  const descriptions = hqdm.getDescriptions(thing, communityName);
  const description = descriptions.first()?.id; // Assumes just one description

  const from = hqdm.getBeginning(thing);
  const to = hqdm.getEnding(thing);

  if (from && to) {
    // Get entity type if present - use string predicate
    const entityTypeValue = hqdm
      .getRelated(thing, ENTITY_TYPE_PREDICATE)
      .first();
    let entityType: EntityType | undefined = undefined;
    if (entityTypeValue) {
      const typeStr = entityTypeValue.id;
      if (Object.values(EntityType).includes(typeStr as EntityType)) {
        entityType = typeStr as EntityType;
      }
    }

    // Create the individual with entityType in constructor
    const individual = new IndividualImpl(
      id,
      name,
      kind,
      getTimeValue(hqdm, from),
      getTimeValue(hqdm, to),
      description,
      false, // beginsWithParticipant
      false, // endsWithParticipant
      entityType // Pass entityType directly to constructor
    );

    // Add to model
    model.addIndividual(individual);
  } else {
    console.error("Individual " + id + " has no temporal extent.");
  }
};

/**
 * Load installations from HQDM model after all individuals are loaded
 */
const loadInstallations = (hqdm: HQDMModel, model: Model): void => {
  model.individuals.forEach((individual) => {
    // Find installations for this individual
    const individualThing = new Thing(BASE + individual.id);
    const installationRefs = hqdm.getRelated(
      individualThing,
      INSTALLATION_PREDICATE
    );

    const installations: Installation[] = [];

    installationRefs.forEach((instRef) => {
      const instId = getModelId(instRef);

      // Get installation properties - use string predicates
      const targetRef = hqdm
        .getRelated(instRef, INSTALLATION_TARGET_PREDICATE)
        .first();
      const beginningRef = hqdm
        .getRelated(instRef, INSTALLATION_BEGINNING_PREDICATE)
        .first();
      const endingRef = hqdm
        .getRelated(instRef, INSTALLATION_ENDING_PREDICATE)
        .first();
      const scContextRef = hqdm
        .getRelated(instRef, INSTALLATION_SC_CONTEXT_PREDICATE)
        .first();
      const systemContextRef = hqdm
        .getRelated(instRef, INSTALLATION_SYSTEM_CONTEXT_PREDICATE)
        .first();

      if (targetRef) {
        const installation: Installation = {
          id: instId,
          componentId: individual.id,
          targetId: getModelId(targetRef),
          beginning: beginningRef ? parseFloat(beginningRef.id) : undefined,
          ending: endingRef ? parseFloat(endingRef.id) : undefined,
          scInstallationContextId: scContextRef
            ? getModelId(scContextRef)
            : undefined,
          systemContextId: systemContextRef
            ? getModelId(systemContextRef)
            : undefined,
        };

        installations.push(installation);
        model.installations.set(instId, installation);
      }
    });

    if (installations.length > 0) {
      individual.installations = installations;
      model.setIndividual(individual);
    }
  });
};
