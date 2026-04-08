import { Individual } from "@/lib/Schema";

export type InstallationRow = {
  id: string;
  systemComponentId: string;
  beginningText: string;
  endingText: string;
};

export type NormalizedInstallationRow = {
  id: string;
  systemComponentId: string;
  beginning: number;
  ending: number;
};

export type PendingBoundsChange = {
  periodId: string;
  systemComponentId: string;
  systemComponentName: string;
  parentSystemName?: string;
  fromBeginning: number;
  fromEnding: number;
  toBeginning?: number;
  toEnding?: number;
  action: "trim" | "drop";
};

export type AffectedComponent = {
  id: string;
  name: string;
  fromBeginning: number;
  fromEnding: number;
  toBeginning?: number;
  toEnding?: number;
  action: "trim" | "drop";
};

export type AffectedInstallation = {
  periodId: string;
  individualId: string;
  individualName: string;
  systemComponentId: string;
  systemComponentName: string;
  fromBeginning: number;
  fromEnding: number;
  toBeginning?: number;
  toEnding?: number;
  action: "trim" | "drop";
};

export type AffectedComponentOfSystem = {
  componentId: string;
  componentName: string;
  systemId: string;
  systemName: string;
  fromBeginning: number;
  fromEnding: number;
  action: "drop";
};

export type AffectedActivity = {
  activityId: string;
  activityName: string;
  /** The individual whose bounds changed, causing this activity to be affected */
  individualId: string;
  individualName: string;
  /** The participation map key (may be composite for per-installation participations) */
  participationKey?: string;
  systemName?: string;
  systemComponentName?: string;
  installationBeginning?: number;
  installationEnding?: number;
  fromBeginning: number;
  fromEnding: number;
  toBeginning?: number;
  toEnding?: number;
  action: "trim" | "drop";
  activityOutcomeText?: string;
  deleteChoice?: "required" | "optional";
  keepStrategy?: "return-to-individual";
  /** When true, this participation should be silently removed without user confirmation
   *  (the same individual still has another participation in the same activity). */
  autoRemove?: boolean;
};

export type CascadeWarning = {
  mode?: "bounds" | "delete";
  leadText?: string;
  entityBoundsText?: string;
  parentSwitchSummary?: {
    componentBoundsText: string;
    oldParentName: string;
    oldParentBoundsText: string;
    newParentName: string;
    newParentBoundsText: string;
  };
  removeButtonLabel?: string;
  trimButtonLabel?: string;
  entityName: string;
  affectedComponents: AffectedComponent[];
  affectedComponentOfSystems: AffectedComponentOfSystem[];
  affectedInstallations: AffectedInstallation[];
  affectedActivities: AffectedActivity[];
  pendingIndividual: Individual;
  /** Pre-computed model updater that applies the chosen action (trim or remove) */
  applyTrim: () => void;
  applyRemove: () => void;
};
