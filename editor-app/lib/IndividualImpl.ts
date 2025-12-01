import type { Kind } from "./Model.js";
import type { EntityType, Id, Individual, Installation } from "./Schema.js";

/**
 * A class that implements the Individual interface.
 */
export class IndividualImpl implements Individual {
  id: Id;
  name: string;
  type?: Kind;
  description?: string;
  beginning: number;
  ending: number;
  beginsWithParticipant: boolean;
  endsWithParticipant: boolean;
  entityType?: EntityType;
  installations?: Installation[];
  _installationId?: string;
  _nestingLevel?: number;
  _isVirtualRow?: boolean;
  _parentPath?: string;

  constructor(
    id: Id,
    name: string,
    type: Kind | undefined,
    beginning: number,
    ending: number,
    description?: string,
    beginsWithParticipant?: boolean,
    endsWithParticipant?: boolean,
    entityType?: EntityType,
    installations?: Installation[]
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
    this.entityType = entityType;
    this.installations = installations;
  }
}
