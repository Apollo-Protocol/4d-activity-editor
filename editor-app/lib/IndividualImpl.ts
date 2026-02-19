import type { Kind } from './Model.js';
import type { Id, Individual } from './Schema.js';
import type { EntityCategory } from './entityTypes.js';

/**
 * A class that implements the Individual interface.
 */
export class IndividualImpl implements Individual {
  id: Id;
  name: string;
  type: Kind;
  description?: string;
  beginning: number;
  ending: number;
  beginsWithParticipant: boolean;
  endsWithParticipant: boolean;
  installedIn?: Id;
  installedBeginning?: number;
  installedEnding?: number;
  entityType?: EntityCategory;

  constructor(
    id: Id,
    name: string,
    type: Kind,
    beginning: number,
    ending: number,
    description?: string,
    beginsWithParticipant?: boolean,
    endsWithParticipant?: boolean,
    installedIn?: Id,
    installedBeginning?: number,
    installedEnding?: number,
    entityType?: EntityCategory
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    if (description) {
      this.description = description;
    }
    this.beginning = beginning;
    this.ending = ending;
    this.beginsWithParticipant = beginsWithParticipant
      ? beginsWithParticipant
      : false;
    this.endsWithParticipant = endsWithParticipant
      ? endsWithParticipant
      : false;
    this.installedIn = installedIn;
    this.installedBeginning = installedBeginning;
    this.installedEnding = installedEnding;
    this.entityType = entityType;
  }
}
