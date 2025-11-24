/**
 * This file contains the schema for the data model.
 */

import type { Maybe } from "@apollo-protocol/hqdm-lib";
import type { Kind } from "./Model";

export { Maybe };
export type Id = string;

/**
 * A spatio-temporal extent is a thing that exists in the world.
 */
export interface STExtent {
  id: Id;
  name: string;
  type: Maybe<Kind>;
  description?: string;
  beginning: number;
  ending: number;
}

/**
 * An activity is a thing that happens over time.
 */
export interface Activity extends STExtent {
  participations: Map<string, Participation>;
  partOf: Maybe<Id>;
}

/**
 * An individual is a person, place, or thing that participates in an activity.
 */
export interface Individual extends STExtent {
  beginsWithParticipant: boolean; //not persisted to HQDM. Indicates that the beginning time should be synchronised to participants.
  endsWithParticipant: boolean; //not persisted to HQDM. Indicates that the ending time should be synchronised to participants.
  entityType?: EntityType; // defaults to individual when absent
  parentSystemId?: Id; // only used when entityType === SystemComponent
  installations?: Installation[]; // optional list of installation periods
}

/**
 * A participation is a relationship between an individual and an activity that it particiaptes in.
 */
export interface Participation {
  individualId: Id;
  role: Maybe<Kind>;
}

// Add entity typing for Individuals
export enum EntityType {
  Individual = "individual",
  System = "system",
  SystemComponent = "systemComponent",
}

// Temporal extent is already defined as STExtent in your schema.
// We add an Installation that reuses beginning/ending.
export interface Installation extends STExtent {
  id: Id;
  componentId: Id; // the component being installed
  systemId: Id; // the system it is installed into
}

// Extend Individual with system fields (kept optional for back-compat)
export interface Individual extends STExtent {
  beginsWithParticipant: boolean;
  endsWithParticipant: boolean;

  entityType?: EntityType;
  parentSystemId?: Id;
  installations?: Installation[];
}
