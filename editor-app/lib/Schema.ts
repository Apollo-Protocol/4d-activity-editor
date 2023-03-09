/**
 * This file contains the schema for the data model.
 */

import type { Kind } from './Model';

/**
 * An optional object ID.
 */
export type MaybeId = string | undefined;

/**
 * An activity is a thing that happens over time.
 */
export interface Activity {
  id: string;
  name: string;
  type: Kind | undefined;
  description?: string;
  beginning: number;
  ending: number;
  participations: Map<string, Participation>;
  partOf: MaybeId;
}

/**
 * An individual is a person, place, or thing that participates in an activity.
 */
export interface Individual {
  id: string;
  name: string;
  type: Kind | undefined;
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
  individualId: string;
  role: Kind | undefined;
}
