/**
 * This file contains the schema for the data model.
 */

import type { Maybe } from '@apollo-protocol/hqdm-lib';
import type { Kind } from './Model';
import type { EntityCategory } from './entityTypes';

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
  color?: string;
}

export interface InstallationPeriod {
  id: Id;
  systemComponentId: Id;
  beginning: number;
  ending: number;
}

/**
 * An individual is a person, place, or thing that participates in an activity.
 */
export interface Individual extends STExtent {
  beginsWithParticipant: boolean; //not persisted to HQDM. Indicates that the beginning time should be synchronised to participants.
  endsWithParticipant: boolean; //not persisted to HQDM. Indicates that the ending time should be synchronised to participants.
  installedIn?: Id; // optional parent system id for system components.
  installedBeginning?: number; // optional installation window start when installedIn is a system component.
  installedEnding?: number; // optional installation window end when installedIn is a system component.
  installations?: InstallationPeriod[]; // optional installation periods for individuals installed in system components.
  entityType?: EntityCategory; // explicit entity category shown in UI.
}

/**
 * A participation is a relationship between an individual and an activity that it particiaptes in.
 * When systemComponentId is set the participation represents the individual's
 * involvement via a specific installation in that system component.
 */
export interface Participation {
  individualId: Id;
  role: Maybe<Kind>;
  beginning?: number;
  ending?: number;
  systemComponentId?: Id;
  installationPeriodId?: Id;
}

/**
 * Compute the map key for a participation entry.
 * Installed participations use "individualId::componentId";
 * non-installed ones use plain "individualId".
 */
export function participationMapKey(
  individualId: string,
  systemComponentId?: string,
  installationPeriodId?: string
): string {
  return systemComponentId
    ? installationPeriodId
      ? `${individualId}::${systemComponentId}::${installationPeriodId}`
      : `${individualId}::${systemComponentId}`
    : individualId;
}

/**
 * Extract the individual ID from a participation map key.
 */
export function participationKeyIndividualId(key: string): string {
  const idx = key.indexOf("::");
  return idx >= 0 ? key.substring(0, idx) : key;
}

/**
 * Find all participation entries for a given individual, regardless of
 * whether they are plain or per-installation keys.
 */
export function findParticipationsForIndividual(
  participations: Map<string, Participation>,
  individualId: string
): [string, Participation][] {
  const result: [string, Participation][] = [];
  participations.forEach((p, key) => {
    if (p.individualId === individualId) {
      result.push([key, p]);
    }
  });
  return result;
}
