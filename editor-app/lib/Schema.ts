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
  SystemComponent = "systemComponent", // A slot/position that can be installed into a System
  InstalledComponent = "installedComponent", // A physical object that can be installed into a SystemComponent
}

// Installation - a temporal relationship record
// - SystemComponent installs into System
// - InstalledComponent installs into SystemComponent
export interface Installation {
  id: Id;
  componentId: Id; // The component being installed
  targetId: Id; // Where it's installed (System for SC, SystemComponent for IC)
  beginning?: number;
  ending?: number;
  // For InstalledComponents: specifies which System this installation is valid for
  systemContextId?: Id;
  // For InstalledComponents: specifies which SC installation this IC installation belongs to
  scInstallationContextId?: Id;
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
  // installations array is used by both SystemComponent and InstalledComponent
  // - SystemComponent: installations into Systems
  // - InstalledComponent: installations into SystemComponents
  installations?: Installation[];
  _installationId?: string; // For virtual rows - the specific installation ID
  beginsWithParticipant?: boolean;
  endsWithParticipant?: boolean;
  _nestingLevel?: number;
  _isVirtualRow?: boolean;
  _parentPath?: string;
}

// Note: beginning/ending are inherited from STExtent
// For Individual, System, SystemComponent, InstalledComponent: use -1 and END_OF_TIME to span full diagram
// Actual temporal bounds come from installation periods

/**
 * A participation is a relationship between an individual and an activity that it particiaptes in.
 */
export interface Participation {
  individualId: Id;
  role: Maybe<Kind>;
}
