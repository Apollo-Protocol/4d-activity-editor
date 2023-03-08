import type { Kind } from './Model.js';
import type { Participation } from './Schema.js';

/**
 * A class that implements the Participation interface.
 */
export class ParticipationImpl implements Participation {
  individualId: string;
  role: Kind;

  constructor(individualId: string, role: Kind) {
    this.individualId = individualId;
    this.role = role;
  }
}
