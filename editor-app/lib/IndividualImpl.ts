import type { Kind } from './Model.js';
import type { Id, Individual, InstallationPeriod } from './Schema.js';
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
  installations?: InstallationPeriod[];
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
    installedBeginningOrEntityType?: number | EntityCategory,
    installedEnding?: number,
    entityType?: EntityCategory,
    installations?: InstallationPeriod[]
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

    const isLegacyEntityTypeArg =
      installedBeginningOrEntityType === "individual" ||
      installedBeginningOrEntityType === "system" ||
      installedBeginningOrEntityType === "system_component";

    const installedBeginning = isLegacyEntityTypeArg
      ? undefined
      : installedBeginningOrEntityType;
    const resolvedEntityType = isLegacyEntityTypeArg
      ? installedBeginningOrEntityType
      : entityType;

    this.installedIn = installedIn;
    this.installedBeginning = installedBeginning;
    this.installedEnding = installedEnding;
    this.entityType = resolvedEntityType;
    this.installations = installations;
  }
}
