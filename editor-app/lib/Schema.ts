/**
 * This file contains the schema for the data model.
 */

import type { Maybe } from "@apollo-protocol/hqdm-lib";
import type { Kind } from "./Model";

export { Maybe };
export type Id = string;

// Type alias for individual types (references Kind from Model)
export type IndividualType = Kind;

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

// Add entity typing for Individuals
export enum EntityType {
  Individual = "individual",
  System = "system",
  SystemComponent = "systemComponent", // A slot/position within a system or installed object
  InstalledComponent = "installedComponent", // A physical object that occupies a slot
}

// Installation - just a temporal relationship record
export interface Installation {
  id: Id;
  componentId: Id; // The physical object being installed
  targetId: Id; // The SystemComponent (slot) it's installed into
  beginning: number;
  ending: number;
}

/**
 * An individual is a person, place, or thing that participates in an activity.
 */
export interface Individual {
  id: string;
  name: string;
  description?: string;
  type?: Kind;
  beginning: number;
  ending: number;
  entityType?: EntityType;
  parentSystemId?: string; // For SystemComponents - reference to parent System
  installations?: Installation[]; // For InstalledComponents - where they're installed
  _installationId?: string; // For virtual rows - the specific installation ID
  beginsWithParticipant?: boolean;
  endsWithParticipant?: boolean;
}

// Note: beginning/ending are inherited from STExtent
// For Individual, System, SystemComponent: use -1 and END_OF_TIME to span full diagram
// For InstalledComponent: use actual lifecycle times

/**
 * A participation is a relationship between an individual and an activity that it particiaptes in.
 */
export interface Participation {
  individualId: Id;
  role: Maybe<Kind>;
}
