import type { Kind } from './Model';
import type { Activity, Id, Individual, Maybe, Participation } from './Schema';
import { participationMapKey } from './Schema';

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
  partOf: Maybe<Id>;
  color?: string;

  constructor(
    id: Id,
    name: string,
    type: Kind,
    beginning: number,
    ending: number,
    description?: string,
    partOf?: string,
    color?: string
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
    this.partOf = partOf;
    this.color = color;
  }

  /**
   * Adds an Individual for the entire duration of the activity
   *
   * @param individual A participant
   * @returns The updated activity, meaning this function can be chained
   */
  addParticipation(
    individual: Individual,
    role: Kind,
    beginning?: number,
    ending?: number,
    systemComponentId?: string,
    installationPeriodId?: string
  ): Activity {
    if (!individual.id) {
      console.error(
        'Cannot add a participation to an activity when the pariticipant id is null or undefined: ',
        individual
      );
    } else {
      const participation: Participation = {
        individualId: individual.id,
        role,
        beginning,
        ending,
        systemComponentId,
        installationPeriodId,
      };
      const key = participationMapKey(individual.id, systemComponentId, installationPeriodId);
      this.participations.set(key, participation);
    }
    return this;
  }

  /**
   * Remove an Individual from an Activity
   *
   * @param individualId The id of the Individual to remove from the Activity
   * @param systemComponentId Optional component id for per-installation participations
   * @returns The updated Activity, meaning this function can be chained
   */
  removeParticipation(individualId: string, systemComponentId?: string, installationPeriodId?: string): Activity {
    const key = participationMapKey(individualId, systemComponentId, installationPeriodId);
    this.participations.delete(key);
    return this;
  }
}
