/* eslint-disable max-classes-per-file */
import { HQDM_NS } from "@apollo-protocol/hqdm-lib";
import type { Activity, Individual } from "./Schema.js";
import { EPOCH_END } from "./ActivityLib";

/**
 * A class used to list the types needed for drop-downs in the UI.
 */
export class Kind {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly isCoreHqdm: boolean
  ) {}
}

/**
 * A class that is the UI Model.
 */
export class Model {
  readonly activities: Map<string, Activity>;
  readonly individuals: Map<string, Individual>;

  readonly roles: Array<Kind>;
  readonly activityTypes: Array<Kind>;
  readonly individualTypes: Array<Kind>;

  // Overall information about the model
  name: string | undefined;
  description: string | undefined;

  constructor(name?: string, description?: string) {
    this.name = name;
    this.description = description;
    this.activities = new Map<string, Activity>();
    this.individuals = new Map<string, Individual>();
    this.roles = [];
    this.activityTypes = [];
    this.individualTypes = [
      new Kind(HQDM_NS + "person", "Person", true),
      new Kind(HQDM_NS + "organization", "Organization", true),
      new Kind(HQDM_NS + "ordinary_physical_object", "Resource", true),
    ];
  }

  static END_OF_TIME = EPOCH_END;

  /**
   * Returns a copy of the model.
   */
  clone(): Model {
    const newModel = new Model(this.name, this.description);
    this.activities.forEach((a) => {
      newModel.addActivity(a);
    });
    this.individuals.forEach((i) => {
      newModel.addIndividual(i);
    });
    this.roles.forEach((r) => {
      newModel.roles.push(r);
    });
    this.activityTypes.forEach((a) => {
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
}
