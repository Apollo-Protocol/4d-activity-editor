/**
 * This file contains the schema for the data model.
 */

import type { Maybe } from '@apollo-protocol/hqdm-lib';
import type { Kind } from './Model';

export { Maybe };
export type Id = string;

/**
 * An activity is a thing that happens over time.
 */
export interface Activity {
  id: Id;
  name: string;
  type: Maybe<Kind>;
  description?: string;
  beginning: number;
  ending: number;
  participations: Map<string, Participation>;
  partOf: Maybe<Id>;
}

/**
 * An individual is a person, place, or thing that participates in an activity.
 */
export interface Individual {
  id: Id;
  name: string;
  type: Maybe<Kind>;
  description?: string;
  beginning: number;
  ending: number;
  beginsWithParticipant: boolean; //not persisted to HQDM. Indicates that the beginning time should be synchronised to participants.
  endsWithParticipant: boolean; //not persisted to HQDM. Indicates that the ending time should be synchronised to participants.
}

/**
 * A participation is a relationship between an individual and an activity that it particiaptes in.
 */
export interface Participation {
  individualId: Id;
  role: Maybe<Kind>;
}
