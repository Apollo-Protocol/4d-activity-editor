/* eslint-disable max-classes-per-file */
import { HQDM_NS } from "@apollo-protocol/hqdm-lib";
import type {
  Activity,
  Id,
  Individual,
  Installation,
  Maybe,
} from "./Schema.js";
import { EPOCH_END } from "./ActivityLib";

/**
 * A class used to list the types needed for drop-downs in the UI.
 */
export class Kind {
  readonly id: Id;
  name: string;
  readonly isCoreHqdm: boolean;

  constructor(id: Id, name: string, isCoreHqdm: boolean) {
    this.id = id;
    this.name = name;
    this.isCoreHqdm = isCoreHqdm;
  }
}

/**
 * A class that is the UI Model.
 */
export class Model {
  readonly activities: Map<Id, Activity>;
  readonly individuals: Map<Id, Individual>;

  readonly roles: Array<Kind>;
  readonly activityTypes: Array<Kind>;
  readonly individualTypes: Array<Kind>;

  defaultRole: Kind;
  defaultActivityType: Kind;
  defaultIndividualType: Kind;

  // Overall information about the model
  name: Maybe<string>;
  description: Maybe<string>;
  filename: string;

  // NEW: central store of installations
  installations: Map<Id, Installation>;

  constructor(name?: string, description?: string) {
    this.name = name;
    this.description = description;
    this.filename = "activity_diagram.ttl";
    this.activities = new Map<Id, Activity>();
    this.individuals = new Map<Id, Individual>();

    /* XXX There is an inconsistency here. Most objects in the UI model
     * have their id set to a plain UUID, i.e. not to an IRI. These core
     * HQDM objects are created with their id set to an IRI. */

    /* These default roles created here need to match the equivalents
     * created in ActivityLib:toModel. */
    this.roles = [new Kind(HQDM_NS + "participant", "Participant", true)];
    this.defaultRole = this.roles[0];
    this.activityTypes = [new Kind(HQDM_NS + "activity", "Task", true)];
    this.defaultActivityType = this.activityTypes[0];
    this.individualTypes = [
      new Kind(HQDM_NS + "person", "Person", true),
      new Kind(HQDM_NS + "organization", "Organization", true),
      new Kind(HQDM_NS + "ordinary_physical_object", "Resource", true),
    ];
    this.defaultIndividualType = this.individualTypes[2];

    this.installations = new Map<Id, Installation>();
  }

  static END_OF_TIME = EPOCH_END;

  /**
   * Returns a copy of the model.
   */
  clone(): Model {
    const newModel = new Model(this.name, this.description);
    newModel.filename = this.filename;
    this.activities.forEach((a) => {
      newModel.addActivity(a);
    });
    this.individuals.forEach((i) => {
      newModel.addIndividual(i);
    });
    this.roles
      .filter((r) => !r.isCoreHqdm)
      .forEach((r) => {
        newModel.roles.push(r);
      });
    this.activityTypes
      .filter((a) => !a.isCoreHqdm)
      .forEach((a) => {
        newModel.activityTypes.push(a);
      });
    this.individualTypes
      .filter((i) => !i.isCoreHqdm)
      .forEach((i) => {
        newModel.individualTypes.push(i);
      });
    return newModel;
  }

  /**
   * Adds a new activity to the model.
   *
   * @param a The activity to add.
   */
  addActivity(a: Activity): void {
    if (!a.id) {
      console.error("Cannot add an Activity when the Activity id is: ", a.id);
    } else {
      this.activities.set(a.id, a);
    }
  }

  /**
   * Removes an activity from the model.
   *
   * @param id The id of the activity to remove.
   */
  removeActivity(id: string): void {
    this.activities.delete(id);
  }

  /**
   * Adds a new individual to the model.
   *
   * @param individual The individual to add.
   */
  addIndividual(individual: Individual): void {
    if (!individual.id) {
      console.error(
        "Cannot add an individual when the individual id is: ",
        individual.id
      );
    } else {
      this.individuals.set(individual.id, individual);
    }
  }

  /**
   * Removes an individual from the model.
   *
   * @param id The id of the individual to remove.
   */
  removeIndividual(id: string): void {
    this.individuals.delete(id);
    this.activities.forEach((a) => {
      a.participations?.forEach((p) => {
        if (p.individualId === id) {
          a.participations?.delete(id);
        }
      });
    });
  }

  /**
   * Given an individual, find the beginning of the earliest activity in which it participates
   *
   * @param individualId
   * @returns A Integer representing the beginning of the earliest participant found, or undefined or no participations where found
   */
  earliestParticipantBeginning(individualId: string) {
    let earliestBeginning = -1;
    this.activities.forEach((a) => {
      a.participations.forEach((p) => {
        if (
          p.individualId === individualId &&
          (earliestBeginning === -1 || a.beginning < earliestBeginning)
        ) {
          earliestBeginning = a.beginning;
        }
      });
    });
    return earliestBeginning;
  }

  /**
   * Given an individual, find the ending of the lastest activity in which it participates
   *
   * @param individualId
   * @returns  Integer representing the ending of the latest participant found, or an integer representing the END_OF_TIME when no participations where found
   */
  lastParticipantEnding(individualId: string) {
    let lastEnding: number = Model.END_OF_TIME;
    this.activities.forEach((a) => {
      a.participations.forEach((p) => {
        if (
          p.individualId === individualId &&
          (lastEnding === Model.END_OF_TIME || a.ending > lastEnding)
        ) {
          lastEnding = a.ending;
        }
      });
    });
    return lastEnding;
  }

  /**
   * Given an individual, find if the individual participates in any activities
   *
   * @param individualId
   * @returns A boolean
   */
  hasParticipants(individualId: string) {
    let hasParticipants = false;
    this.activities.forEach((a) => {
      a.participations.forEach((p) => {
        if (p.individualId === individualId) {
          hasParticipants = true;
        }
      });
    });
    return hasParticipants;
  }

  /**
   * Given an activity ID, finds if the activity has any parts.
   */
  hasParts(activityId: string) {
    return this.getPartsCount(activityId) > 0;
  }

  /**
   * Return the list of child activities (parts) for a given activity id.
   */
  getParts(activityId: string): Activity[] {
    const parts: Activity[] = [];
    this.activities.forEach((a) => {
      if (a.partOf === activityId) parts.push(a);
    });
    return parts;
  }

  /**
   * Return the number of child activities (parts) for a given activity id.
   */
  getPartsCount(activityId: string): number {
    let count = 0;
    this.activities.forEach((a) => {
      if (a.partOf === activityId) count++;
    });
    return count;
  }

  /**
   * Add a new role type to the model.
   *
   * @param id The id of the role type.
   * @param name The name of the role type.
   */
  addRoleType(id: string, name: string): void {
    this.roles.push(new Kind(id, name, false));
  }

  /**
   * Add a new activity type to the model.
   *
   * @param id The id of the activity type.
   * @param name The name of the activity type.
   */
  addActivityType(id: string, name: string): void {
    this.activityTypes.push(new Kind(id, name, false));
  }

  /**
   * Add a new individual type to the model.
   *
   * @param id The id of the individual type.
   * @param name The name of the individual type.
   */
  addIndividualType(id: string, name: string): void {
    this.individualTypes.push(new Kind(id, name, false));
  }

  /**
   * Translate and scale child activity temporal bounds to lie within
   * their parent activities.
   */
  normalizeActivityBounds(): void {
    console.log("Normalising activity bounds: %o", this.activities);

    const parts = new Map<Maybe<Id>, Id[]>();
    this.activities.forEach((a) => {
      const list = parts.get(a.partOf);
      if (list) list.push(a.id);
      else parts.set(a.partOf, [a.id]);
    });

    const to_process: Id[] = [];
    const to_check: Maybe<Id>[] = [undefined];
    while (to_check.length > 0) {
      const next = to_check.shift();
      const list = parts.get(next);
      if (list) {
        /* This skips the top-level activities. We could instead rescale
         * to some standard boundaries (e.g. 0-1000). */
        if (next) to_process.push(next);
        to_check.push(...list);
      }
    }

    for (const id of to_process) {
      const act = this.activities.get(id)!;

      const kids = parts.get(id)!.map((id) => this.activities.get(id)!);
      const earliest = Math.min(...kids.map((a) => a.beginning));
      const latest = Math.max(...kids.map((a) => a.ending));

      const scale = (act.ending - act.beginning) / (latest - earliest);
      const offset = act.beginning - earliest;

      for (const kid of kids) {
        kid.beginning = (kid.beginning + offset) * scale;
        kid.ending = (kid.ending + offset) * scale;
      }
    }

    console.log("Normalised activity bounds: %o", this.activities);
  }

  // Return the activity object for a given id (or undefined)
  getActivity(activityId: Id): Activity | undefined {
    return this.activities.get(activityId);
  }

  // Set the parent (partOf) for an activity. parentId may be null for top-level.
  setActivityParent(
    activityId: Id,
    parentId: Id | null,
    expandAncestors = false
  ) {
    const a = this.activities.get(activityId);
    if (!a) return;
    a.partOf = parentId ?? undefined;
    this.activities.set(a.id, a);

    if (expandAncestors && parentId) {
      let cur = this.activities.get(parentId);
      while (cur) {
        // ensure parent contains child
        if (a.beginning < cur.beginning) cur.beginning = a.beginning;
        if (a.ending > cur.ending) cur.ending = a.ending;
        this.activities.set(cur.id, cur);
        if (!cur.partOf) break;
        cur = this.activities.get(cur.partOf);
      }
    }
  }

  // Get parent activity (or undefined)
  getParent(activityId: Id): Activity | undefined {
    const a = this.activities.get(activityId);
    if (!a || !a.partOf) return undefined;
    return this.activities.get(a.partOf);
  }

  // Return ancestors chain (closest parent first)
  getAncestors(activityId: Id): Activity[] {
    const ancestors: Activity[] = [];
    let cur = this.getParent(activityId);
    while (cur) {
      ancestors.push(cur);
      if (!cur.partOf) break;
      cur = this.getParent(cur.id);
    }
    return ancestors;
  }

  // True if candidateAncestorId is an ancestor of descendantId
  isAncestor(candidateAncestorId: Id, descendantId: Id): boolean {
    let cur = this.getParent(descendantId);
    while (cur) {
      if (cur.id === candidateAncestorId) return true;
      if (!cur.partOf) break;
      cur = this.getParent(cur.id);
    }
    return false;
  }

  // True if descendantId is a descendant of ancestorId
  isDescendant(ancestorId: Id, descendantId: Id): boolean {
    return this.isAncestor(ancestorId, descendantId);
  }

  // Persist/update an individual as usual
  setIndividual(individual: Individual) {
    // ...existing code to put into this.individuals...
    this.individuals.set(individual.id, individual);

    // Also mirror any inline installations into the central map
    if (individual.installations) {
      individual.installations.forEach((inst) => {
        this.installations.set(inst.id, inst);
      });
    }
  }

  // NEW: convenience methods for managing installations
  addInstallation(inst: Installation) {
    this.installations.set(inst.id, inst);

    const comp = this.individuals.get(inst.componentId);
    if (comp) {
      const list = [...(comp.installations ?? [])].filter(
        (i) => i.id !== inst.id
      );
      list.push(inst);
      comp.installations = list;
      this.individuals.set(comp.id, comp);
    }
  }

  removeInstallation(id: Id) {
    const inst = this.installations.get(id);
    if (inst) {
      const comp = this.individuals.get(inst.componentId);
      if (comp && comp.installations) {
        comp.installations = comp.installations.filter((i) => i.id !== id);
        this.individuals.set(comp.id, comp);
      }
    }
    this.installations.delete(id);
  }

  deleteIndividual(id: string) {
    const individual = this.individuals.get(id);
    if (!individual) return;

    // Remove the individual itself
    this.individuals.delete(id);

    // Remove installations that target this id (slot removed)
    this.individuals.forEach((ind) => {
      if (ind.installations) {
        ind.installations = ind.installations.filter(
          (inst) => inst.targetId !== id
        );
      }
    });

    // Clean up participations in all activities
    const activitiesToDelete: string[] = [];
    this.activities.forEach((activity) => {
      const parts = activity.participations;
      if (!parts) return;

      // Support Map or object shape; prefer Map if used
      if (parts instanceof Map) {
        const toRemove: string[] = [];
        parts.forEach((part, key) => {
          // direct reference
          if (key === id) {
            toRemove.push(key);
            return;
          }

          // defensive: participation object points to individualId
          if ((part as any).individualId === id) {
            toRemove.push(key);
            return;
          }

          // installation reference form: "<originalId>__installed_in__<slotId>"
          if (typeof key === "string" && key.includes("__installed_in__")) {
            const [originalId, slotId] = key.split("__installed_in__");
            if (originalId === id || slotId === id) {
              toRemove.push(key);
              return;
            }
          }
        });

        toRemove.forEach((k) => parts.delete(k));

        // mark activity for deletion if no participations remain
        if (parts.size === 0) activitiesToDelete.push(activity.id);
      } else {
        // If participations are stored as an object/array, handle common shapes
        try {
          // object with keys
          const keys = Object.keys(parts as any);
          keys.forEach((k) => {
            const p = (parts as any)[k];
            if (k === id || p?.individualId === id) {
              delete (parts as any)[k];
              return;
            }
            if (k.includes("__installed_in__")) {
              const [originalId, slotId] = k.split("__installed_in__");
              if (originalId === id || slotId === id) delete (parts as any)[k];
            }
          });

          // if it's now empty, queue activity for removal
          if (Object.keys(parts as any).length === 0)
            activitiesToDelete.push(activity.id);
        } catch {
          // ignore unexpected shapes
        }
      }
    });

    // Remove activities that have become orphaned
    activitiesToDelete.forEach((aid) => this.activities.delete(aid));
  }
}
