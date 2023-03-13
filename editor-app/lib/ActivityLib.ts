import { v4 as uuidv4 } from "uuid";
import { ActivityImpl } from "./ActivityImpl";
import {
  activity,
  CONSISTS_OF_BY_CLASS,
  ENTITY_NAME,
  HQDMModel,
  HQDM_NS,
  kind_of_activity,
  kind_of_ordinary_physical_object,
  ordinary_physical_object,
  organization,
  participant,
  PART_OF_BY_CLASS,
  person,
  point_in_time,
  possible_world,
  role,
  state_of_ordinary_physical_object,
  Thing,
  utcMillisecondsClass,
  utcPointInTimeIri,
} from "@apollo-protocol/hqdm-lib";
import { IndividualImpl } from "./IndividualImpl";
import { Kind, Model } from "./Model";

/**
 * ActivityLib
 */

// This is only used to confirm that the libary is loaded into a web page and accessible.
export const status = (): string => "OK";

// The IRI base for this application.
export const BASE = "https://www.amrc.co.uk/hqdm/activities#";

// A well-known ENTITY_NAME used to find the AMRC Community entity.
const AMRC_COMMUNITY = "AMRC Community";

// HQDM relations not exposed by hqdm-lib
const PART_OF = HQDM_NS + "part_of";

export const EPOCH_START = 0;
export const EPOCH_START_STR = EPOCH_START.toString();
export const EPOCH_END = 9999999999999;
export const EPOCH_END_STR = EPOCH_END.toString();

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
    amrc: BASE,
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
const getModelId = (t: Thing | undefined): string => {
  return t?.id?.replace(BASE, "");
}

/**
 * Converts an HQDMModel to a UI Model.
 */
export const toModel = (hqdm: HQDMModel): Model => {
  const communityName = new Thing(AMRC_COMMUNITY);
  const m = new Model();

  // Get the name and description of the model from the possible world
  const possibleWorld = hqdm.findByType(possible_world).first(); // Assumes just one possible world
  if (possibleWorld) {
    m.name = hqdm.getIdentifications(possibleWorld, communityName).first()?.id;
    m.description = hqdm.getDescriptions(possibleWorld, communityName).first()?.id;
  }

  /**
   * Add the individuals to the model by finding all the ordinary physical objects and converting them to Individuals.
   * TODO: It may be necessary in future to filter the ordinary_physical_objects to remove any that are not part of the model.
   */
  hqdm.findByType(ordinary_physical_object).forEach((i) => {
    const id = getModelId(i); // The UI Model doesn't use IRIs, so remove the base.

    // Find the name signs recognised by the community for this individual.
    const identification = hqdm.getIdentifications(i, communityName).first();
    const name = identification?.id ?? "No Name Found: " + i.id; // Assumes just one name

    // Find the kind of individual.
    const kinds = hqdm
      .memberOfKind(i)
      .filter((x) => hqdm.isKindOf(x, kind_of_ordinary_physical_object));
    const kind = kinds.first((x) => (x ? true : false)); // Matches every element, so returns the first

    let kindOfIndividual;
    if (kind) {
      kindOfIndividual = kind
        ? new Kind(getModelId(kind), hqdm.getEntityName(kind), false)
        : new Kind("dummyId", "Unknown Individual Type", false);
    } else {
      kindOfIndividual = new Kind(
        ordinary_physical_object.id,
        "Resource",
        true
      );
    }

    // Get the optional description of the individual.
    const descriptions = hqdm.getDescriptions(i, communityName);
    const description = descriptions.first()?.id; // Assumes just one description

    const from = hqdm.getBeginning(i);
    const to = hqdm.getEnding(i);

    if (from && to) {
      // Create the individual and add it to the model.
      const indiv = new IndividualImpl(
        id,
        name,
        kindOfIndividual,
        Number.parseInt(hqdm.getEntityName(from), 10),
        Number.parseInt(hqdm.getEntityName(to), 10),
        description,
        false,
        false
      );
      m.addIndividual(indiv);
    } else {
      console.error("Individual " + id + " has no temporal extent.");
    }
  });

  hqdm.findByType(person).forEach((i) => {
    const id = getModelId(i); // The UI Model doesn't use IRIs, so remove the base.

    // Find the name signs recognised by the community for this individual.
    const identifications = hqdm.getIdentifications(i, communityName);
    const name = identifications.first()?.id ?? "No Name Found: " + i.id; // Assumes just one name

    const kindOfIndividual = new Kind(person.id, "Person", true);

    // Get the optional description of the individual.
    const descriptions = hqdm.getDescriptions(i, communityName);
    const description = descriptions.first()?.id; // Assumes just one description

    const from = hqdm.getBeginning(i);
    const to = hqdm.getEnding(i);

    if (from && to) {
      // Create the individual and add it to the model.
      const indiv = new IndividualImpl(
        id,
        name,
        kindOfIndividual,
        Number.parseInt(hqdm.getEntityName(from), 10),
        Number.parseInt(hqdm.getEntityName(to), 10),
        description,
        false,
        false
      );
      m.addIndividual(indiv);
    } else {
      console.error("Individual " + id + " has no temporal extent.");
    }
  });

  hqdm.findByType(organization).forEach((i) => {
    const id = getModelId(i); // The UI Model doesn't use IRIs, so remove the base.

    // Find the name signs recognised by the community for this individual.
    const identifications = hqdm.getIdentifications(i, communityName);
    const name = identifications.first()?.id ?? "No Name Found: " + i.id; // Assumes just one name

    const kindOfIndividual = new Kind(organization.id, "Organization", true);

    // Get the optional description of the individual.
    const descriptions = hqdm.getDescriptions(i, communityName);
    const description = descriptions.first()?.id; // Assumes just one description

    const from = hqdm.getBeginning(i);
    const to = hqdm.getEnding(i);

    if (from && to) {
      // Create the individual and add it to the model.
      const indiv = new IndividualImpl(
        id,
        name,
        kindOfIndividual,
        Number.parseInt(hqdm.getEntityName(from), 10),
        Number.parseInt(hqdm.getEntityName(to), 10),
        description,
        false,
        false
      );
      m.addIndividual(indiv);
    } else {
      console.error("Individual " + id + " has no temporal extent.");
    }
  });

  //
  // Add each Activity to the model.
  //
  hqdm.findByType(activity).forEach((a) => {
    const id = getModelId(a);

    // Get the activity name.
    const identifications = hqdm.getIdentifications(a, communityName);
    const name = identifications.first()?.id ?? "No Name Found: " + a.id; // Assumes just one name

    // Get the activity type.
    const kinds = hqdm
      .memberOfKind(a)
      .filter((x) => hqdm.isKindOf(x, kind_of_activity));
    const kind = kinds.first((x) => (x ? true : false)); // Matches every element, so returns the first
    const kindOfActivity = kind
      ? new Kind(getModelId(kind), hqdm.getEntityName(kind), false)
      : new Kind("dummyId", "Unknown Activity Type", false);

    // Get the temporal extent of the activity with defaults, although the defaults should never be needed.
    const activityFromEvent = hqdm.getBeginning(a);
    const activityToEvent = hqdm.getEnding(a);
    const beginning = activityFromEvent
      ? Number.parseInt(hqdm.getEntityName(activityFromEvent), 10)
      : 0;
    const ending = activityToEvent
      ? Number.parseInt(hqdm.getEntityName(activityToEvent), 10)
      : EPOCH_END;

    // Get the optional description of the activity.
    const descriptions = hqdm.getDescriptions(a, communityName);
    const description = descriptions.first()?.id; // Assumes just one description

    // Get the parent activity, if any.
    const partOf = hqdm.getRelated(a, PART_OF).first(x => true);

    // Create the activity and add it to the model.
    const newA = new ActivityImpl(
      id,
      name,
      kindOfActivity,
      beginning,
      ending,
      description,
      getModelId(partOf),
    );
    m.addActivity(newA);

    //
    // Find the participations to the activities and add them to the model.
    //
    const participations = hqdm.getParticipants(a);
    participations.forEach((p) => {
      // Get the role of the participant.
      const participantRole = hqdm.getRole(p).first();
      const roleType = participantRole
        ? new Kind(
            getModelId(participantRole),
            hqdm.getEntityName(participantRole),
            false
          )
        : new Kind("dummyId", "Unknown Role Type", false);

      // Get the participant whole life object for this temporal part.
      const participantThing = hqdm.getTemporalWhole(p);

      // Get the individual from the model or create a dummy individual if the participant is not in the model.
      const indiv = participantThing
        ? m.individuals.get(getModelId(participantThing))
        : new IndividualImpl(
            "BAD ID",
            "Unknown Individual",
            new Kind("dummyId", "Unknown Individual Type", false),
            0,
            EPOCH_END,
            "Unknown Individual",
            false,
            false
          );
      if (indiv) {
        newA.addParticipation(indiv, roleType);
      }
    });
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

  // Save the kinds to the model.
  model.activityTypes.forEach((a) => {
    const kind = hqdm.createThing(kind_of_activity, BASE + a.id);
    hqdm.relate(ENTITY_NAME, kind, new Thing(a.name));
  });
  model.individualTypes
    .filter((i) => !i.id.startsWith(HQDM_NS))
    .forEach((i) => {
      const kind = hqdm.createThing(
        kind_of_ordinary_physical_object,
        BASE + i.id
      );
      hqdm.relate(ENTITY_NAME, kind, new Thing(i.name));
    });
  model.roles.forEach((r) => {
    const kind = hqdm.createThing(role, BASE + r.id);
    hqdm.relate(ENTITY_NAME, kind, new Thing(r.name));
  });

  const communityName = new Thing(AMRC_COMMUNITY);
  const epochStart = hqdm.createThing(
    point_in_time,
    utcPointInTimeIri(EPOCH_START)
  );
  const epochEnd = hqdm.createThing(
    point_in_time,
    utcPointInTimeIri(EPOCH_END)
  );
  hqdm.addMemberOf(epochStart, utcMillisecondsClass);
  hqdm.addMemberOf(epochEnd, utcMillisecondsClass);
  hqdm.relate(ENTITY_NAME, epochStart, new Thing(EPOCH_START_STR));
  hqdm.relate(ENTITY_NAME, epochEnd, new Thing(EPOCH_END_STR));

  // Create a Possible World for the Model
  const modelWorld = hqdm.createThing(possible_world, BASE + uuidv4());

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

  // The possible world is a part of itself and the epoch start and end are also part of it.
  hqdm.addToPossibleWorld(modelWorld, modelWorld);
  hqdm.addToPossibleWorld(epochStart, modelWorld);
  hqdm.addToPossibleWorld(epochEnd, modelWorld);

  // Add the individuals to the model
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

    const individualStart = hqdm.createThing(
      point_in_time,
      utcPointInTimeIri(i.beginning)
    );

    const individualEnd = hqdm.createThing(
      point_in_time,
      utcPointInTimeIri(i.ending)
    );
    hqdm.addMemberOf(individualStart, utcMillisecondsClass);
    hqdm.addMemberOf(individualEnd, utcMillisecondsClass);
    hqdm.relate(
      ENTITY_NAME,
      individualStart,
      new Thing(i.beginning.toString())
    );
    hqdm.relate(ENTITY_NAME, individualEnd, new Thing(i.ending.toString()));
    hqdm.addToPossibleWorld(individualStart, modelWorld);
    hqdm.addToPossibleWorld(individualEnd, modelWorld);

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

    // Find or create the kind of individual and add the individual to the kind.
    if (i.type?.isCoreHqdm) {
      hqdm.addMemberOfKind(player, new Thing(i.type.id));
    } else {
      // i.type is not actually optional - it's only optional because the UI model allows it to be undefined.
      const playerKindId = i.type ? BASE + i.type.id : "INVALID";
      const playerKind = hqdm.exists(playerKindId)
        ? new Thing(playerKindId)
        : hqdm.createThing(kind_of_ordinary_physical_object, playerKindId);

      if (i.type) {
        hqdm.relate(ENTITY_NAME, playerKind, new Thing(i.type.name)); // Set the entity name in case it was created
      }
      hqdm.addMemberOfKind(player, playerKind);
    }
  });

  // Add the activities to the model
  model.activities.forEach((a) => {
    // Create the temporal bounds for the activity.
    const activityFrom = hqdm.createThing(
      point_in_time,
      utcPointInTimeIri(a.beginning)
    );
    const activityTo = hqdm.createThing(
      point_in_time,
      utcPointInTimeIri(a.ending)
    );
    hqdm.addMemberOf(activityFrom, utcMillisecondsClass);
    hqdm.addMemberOf(activityTo, utcMillisecondsClass);
    hqdm.relate(ENTITY_NAME, activityFrom, new Thing(a.beginning.toString()));
    hqdm.relate(ENTITY_NAME, activityTo, new Thing(a.ending.toString()));

    hqdm.addToPossibleWorld(activityFrom, modelWorld);
    hqdm.addToPossibleWorld(activityTo, modelWorld);

    // Find or create the kind of activity and add the activity to the kind.
    const actKindId = a.type ? BASE + a.type.id : "INVALID";
    const actKind = hqdm.exists(actKindId)
      ? new Thing(actKindId)
      : hqdm.createThing(kind_of_activity, actKindId);
    if (a.type) {
      hqdm.relate(ENTITY_NAME, actKind, new Thing(a.type.name)); // Set the entity name in case it was created
    }

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
    hqdm.addMemberOfKind(act, actKind);
    hqdm.beginning(act, activityFrom);
    hqdm.ending(act, activityTo);

    if (a.partOf) {
      hqdm.relate(PART_OF, act, new Thing(BASE + a.partOf));
    }

    // Add the participations to the model
    a.participations.forEach((p) => {
      // Create the participant and add it to the possible world.
      const participation = hqdm.createThing(
        state_of_ordinary_physical_object,
        BASE + uuidv4()
      );
      hqdm.addToPossibleWorld(participation, modelWorld);

      // Find or create the role.
      const roleId = p.role ? BASE + p.role.id : "INVALID";
      const pRole = hqdm.exists(roleId)
        ? new Thing(roleId)
        : hqdm.createThing(role, roleId);

      // The kind_of_activity needs to define the roles it consists of, and the reverse relationship.
      hqdm.relate(PART_OF_BY_CLASS, pRole, actKind);
      hqdm.relate(CONSISTS_OF_BY_CLASS, actKind, pRole);

      // Name the role and add the participant to the role.
      if (p.role) {
        hqdm.relate(ENTITY_NAME, pRole, new Thing(p.role.name));
      }
      hqdm.addMemberOfKind(participation, pRole);
      hqdm.addMemberOfKind(participation, participant);

      // Add the participant as a temporal part of the individual.
      hqdm.addAsTemporalPartOf(participation, new Thing(BASE + p.individualId));
      hqdm.addParticipant(participation, act);

      // Make the participant have gthe same temporal bounds as the activity.
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
