import type { Kind } from './Model.js';
import type { Activity, Id, Individual, Participation } from './Schema.js';

/**
 * An Activity is a period of time during which a set of Individuals are involved in an activity.
 */
export class ActivityImpl implements Activity {
  id: Id;
  name: string;
  type: Kind;
  description?: string;
  beginning: number;
  ending: number;
  participations: Map<string, Participation>;

  constructor(
    id: Id,
    name: string,
    type: Kind,
    beginning: number,
    ending: number,
    description?: string
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.beginning = beginning;
    this.ending = ending;
    if (description) {
      this.description = description;
    }
    this.participations = new Map<string, Participation>();
  }

  /**
   * Adds an Individual for the entire duration of the activity
   *
   * @param individual A participant
   * @returns The updated activity, meaning this function can be chained
   */
  addParticipation(individual: Individual, role: Kind): Activity {
    if (!individual.id) {
      console.error(
        'Cannot add a participation to an activity when the pariticipant id is null or undefined: ',
        individual
      );
    } else {
      const participation: Participation = {
        individualId: individual.id,
        role,
      };
      this.participations.set(participation.individualId, participation);
    }
    return this;
  }

  /**
   * Remove an Individual from an Activity
   *
   * @param id The id of the Individual to remove from the Activity
   * @returns The updated Activity, meaning this function can be chained
   */
  removeParticipation(individualId: string): Activity {
    this.participations.delete(individualId);
    return this;
  }
}
