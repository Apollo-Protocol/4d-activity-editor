import type { Kind } from './Model.js';
import type { Participation } from './Schema';

/**
 * A class that implements the Participation interface.
 */
export class ParticipationImpl implements Participation {
  individualId: string;
  role: Kind;
  beginning?: number;
  ending?: number;
  systemComponentId?: string;
  installationPeriodId?: string;

  constructor(individualId: string, role: Kind, beginning?: number, ending?: number, systemComponentId?: string, installationPeriodId?: string) {
    this.individualId = individualId;
    this.role = role;
    this.beginning = beginning;
    this.ending = ending;
    this.systemComponentId = systemComponentId;
    this.installationPeriodId = installationPeriodId;
  }
}
