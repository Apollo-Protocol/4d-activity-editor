import React, { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import DraggableModalDialog, { shouldSuppressModalHide } from "@/components/DraggableModalDialog";
import Form from "react-bootstrap/Form";
import Table from "react-bootstrap/Table";
import Alert from "react-bootstrap/Alert";
import Card from "react-bootstrap/Card";
import { v4 as uuidv4 } from "uuid";
import { Activity, Individual, InstallationPeriod, findParticipationsForIndividual, participationMapKey } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import {
  ENTITY_CATEGORY,
  ENTITY_TYPE_IDS,
  ENTITY_TYPE_OPTIONS,
  getEntityCategoryFromTypeId,
  getEntityTypeIdFromIndividual,
} from "@/lib/entityTypes";
import {
  getInstallationPeriods,
  normalizeEnd,
  normalizeStart,
  syncLegacyInstallationFields,
} from "@/utils/installations";

interface Props {
  deleteIndividual: (id: string) => void;
  setIndividual: (individual: Individual) => void;
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedIndividual: Individual | undefined;
  setSelectedIndividual: Dispatch<SetStateAction<Individual | undefined>>;
  dataset: Model;
  updateDataset: Dispatch<Dispatch<Model>>;
  showTrigger?: boolean;
  triggerClassName?: string;
  triggerVariant?: string;
}

type InstallationRow = {
  id: string;
  systemComponentId: string;
  beginningText: string;
  endingText: string;
};

type NormalizedInstallationRow = {
  id: string;
  systemComponentId: string;
  beginning: number;
  ending: number;
};

type PendingBoundsChange = {
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

type AffectedComponent = {
  id: string;
  name: string;
  fromBeginning: number;
  fromEnding: number;
  toBeginning?: number;
  toEnding?: number;
  action: "trim" | "drop";
};

type AffectedInstallation = {
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

type AffectedComponentOfSystem = {
  componentId: string;
  componentName: string;
  systemId: string;
  systemName: string;
  fromBeginning: number;
  fromEnding: number;
  action: "drop";
};

type AffectedActivity = {
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

type CascadeWarning = {
  mode?: "bounds" | "delete";
  leadText?: string;
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

const EMPTY_BEGINNING = "";
const EMPTY_ENDING = "";

const SetIndividual = (props: Props) => {
  const {
    deleteIndividual,
    setIndividual,
    show,
    setShow,
    selectedIndividual,
    setSelectedIndividual,
    dataset,
    updateDataset,
    showTrigger = true,
    triggerClassName = "mx-1",
    triggerVariant = "primary",
  } = props;

  const defaultIndividual: Individual = {
    id: "",
    name: "",
    type:
      dataset.individualTypes.find((kind) => kind.name === "Resource") ??
      dataset.defaultIndividualType,
    description: "",
    beginning: -1,
    ending: Model.END_OF_TIME,
    beginsWithParticipant: false,
    endsWithParticipant: false,
    installedIn: undefined,
    installedBeginning: undefined,
    installedEnding: undefined,
    installations: [],
    entityType: ENTITY_CATEGORY.INDIVIDUAL,
  };

  const [inputs, setInputs] = useState<Individual>(defaultIndividual);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Custom type selector state
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState("");
  const typeDropdownRef = React.useRef<HTMLDivElement | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const itemRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  const [beginningText, setBeginningText] = useState(EMPTY_BEGINNING);
  const [endingText, setEndingText] = useState(EMPTY_ENDING);

  const [showInstallationsModal, setShowInstallationsModal] = useState(false);
  const [installationRows, setInstallationRows] = useState<InstallationRow[]>([]);
  const [installationErrors, setInstallationErrors] = useState<string[]>([]);
  const [showBoundsWarningModal, setShowBoundsWarningModal] = useState(false);
  const [pendingSaveIndividual, setPendingSaveIndividual] =
    useState<Individual | null>(null);
  const [pendingRemoveIndividual, setPendingRemoveIndividual] =
    useState<Individual | null>(null);
  const [pendingTrimCount, setPendingTrimCount] = useState(0);
  const [pendingDroppedCount, setPendingDroppedCount] = useState(0);
  const [pendingBoundsChanges, setPendingBoundsChanges] = useState<PendingBoundsChange[]>([]);
  const [pendingAffectedActivities, setPendingAffectedActivities] = useState<AffectedActivity[]>([]);
  const [pendingAutoRemoveActivities, setPendingAutoRemoveActivities] = useState<AffectedActivity[]>([]);
  const [pendingActivityAction, setPendingActivityAction] =
    useState<"keep" | "remove">("keep");
  const [selectedAffectedActivityKeys, setSelectedAffectedActivityKeys] =
    useState<Set<string>>(new Set());
  const [pendingChangeScope, setPendingChangeScope] =
    useState<"bounds" | "installations" | "both">("bounds");

  const [showCascadeWarningModal, setShowCascadeWarningModal] = useState(false);
  const [cascadeWarning, setCascadeWarning] = useState<CascadeWarning | null>(null);

  const isEditMode = !!selectedIndividual;
  const selectedEntityTypeId = getEntityTypeIdFromIndividual(inputs);

  const systems = useMemo(
    () =>
      Array.from(dataset.individuals.values()).filter(
        (individual) =>
          individual.id !== inputs.id &&
          getEntityTypeIdFromIndividual(individual) === ENTITY_TYPE_IDS.SYSTEM
      ),
    [dataset.individuals, inputs.id]
  );

  const systemComponents = useMemo(
    () =>
      Array.from(dataset.individuals.values()).filter(
        (individual) =>
          individual.id !== inputs.id &&
          getEntityTypeIdFromIndividual(individual) ===
            ENTITY_TYPE_IDS.SYSTEM_COMPONENT
      ),
    [dataset.individuals, inputs.id]
  );

  const selectedParentSystem = useMemo(
    () =>
      inputs.installedIn ? dataset.individuals.get(inputs.installedIn) : undefined,
    [dataset.individuals, inputs.installedIn]
  );

  const systemComponentSlotHints = useMemo(() => {
    if (!selectedParentSystem) return null;

    const systemStart = normalizeStart(selectedParentSystem.beginning);
    const systemEnd = normalizeEnd(selectedParentSystem.ending);

    return {
      bounds: `${systemStart}-${
        systemEnd >= Model.END_OF_TIME ? "∞" : String(systemEnd)
      }`,
    };
  }, [selectedParentSystem]);

  const asInputText = (value: number, isBeginning: boolean) => {
    if (isBeginning && value <= 0) return "0";
    if (!isBeginning && (value <= 0 || value >= Model.END_OF_TIME)) return "";
    return String(value);
  };

  const formatBound = (value: number, isBeginning: boolean) => {
    if (isBeginning && value <= 0) return "0";
    if (!isBeginning && value >= Model.END_OF_TIME) return "∞";
    return String(value);
  };

  const getAffectedActivitySelectionKey = (aa: AffectedActivity) =>
    `${aa.activityId}:${aa.participationKey ?? aa.individualId}`;

  const resolveCurrentAffectedParticipationKey = (
    activity: Activity,
    affectedActivity: AffectedActivity
  ) => {
    const originalKey =
      affectedActivity.participationKey ?? affectedActivity.individualId;

    if (activity.participations.has(originalKey)) {
      return originalKey;
    }

    const plainKey = affectedActivity.individualId;
    if (activity.participations.has(plainKey)) {
      return plainKey;
    }

    return originalKey;
  };

  const getAffectedActivityParticipantLabel = (aa: AffectedActivity): string => {
    const individual = dataset.individuals.get(aa.individualId);
    let timelineStart = individual?.beginning ?? aa.fromBeginning;
    let timelineEnd = individual?.ending ?? aa.fromEnding;
    const componentName = aa.systemComponentName;

    if (
      componentName &&
      aa.installationBeginning !== undefined &&
      aa.installationEnding !== undefined
    ) {
      return `${aa.individualName} [installed in ${componentName} (${formatBound(
        aa.installationBeginning,
        true
      )}-${formatBound(aa.installationEnding, false)})]`;
    }

    const activity = dataset.activities.get(aa.activityId);
    if (activity) {
      const participationKey = resolveCurrentAffectedParticipationKey(activity, aa);
      const participation = activity.participations.get(participationKey);

      if (participation?.systemComponentId) {
        const component = dataset.individuals.get(participation.systemComponentId);
        const componentName =
          component?.name || aa.systemComponentName || participation.systemComponentId;

        const installationPeriod =
          individual?.installations?.find(
            (period) =>
              period.id === participation.installationPeriodId &&
              period.systemComponentId === participation.systemComponentId
          ) ||
          individual?.installations?.find((period) => {
            if (period.systemComponentId !== participation.systemComponentId) {
              return false;
            }
            const pStart = participation.beginning ?? aa.fromBeginning;
            const pEnd = participation.ending ?? aa.fromEnding;
            return pStart >= period.beginning && pEnd <= period.ending;
          });

        if (installationPeriod) {
          timelineStart = installationPeriod.beginning;
          timelineEnd = installationPeriod.ending;
        }

        return `${aa.individualName} [installed in ${componentName} (${formatBound(
          timelineStart,
          true
        )}-${formatBound(timelineEnd, false)})]`;
      }
    }

    return `${aa.individualName} (${formatBound(timelineStart, true)}-${formatBound(
      timelineEnd,
      false
    )})`;
  };

  /**
   * Find activities that have participations with a given individual whose
   * activity bounds exceed the individual's new bounds AND the situation is
   * worse than the old bounds (i.e. the new bounds are more restrictive).
   * @param entityId  The individual whose bounds changed
   * @param entityName  Friendly name for the individual  
   * @param newStart  The new normalized start bound for the entity
   * @param newEnd    The new normalized end bound for the entity
   * @param oldStart  The old normalized start bound for the entity
   * @param oldEnd    The old normalized end bound for the entity
   */
  const findAffectedActivities = (
    entityId: string,
    entityName: string,
    newStart: number,
    newEnd: number,
    oldStart?: number,
    oldEnd?: number,
  ): AffectedActivity[] => {
    const result: AffectedActivity[] = [];
    for (const act of Array.from(dataset.activities.values())) {
      const entries = findParticipationsForIndividual(act.participations, entityId);
      if (entries.length === 0) continue;
      for (const [pKey, participation] of entries) {
        const actStart = normalizeStart(participation?.beginning ?? act.beginning);
        const actEnd = normalizeEnd(participation?.ending ?? act.ending);
        const clampedStart = Math.max(actStart, newStart);
        const clampedEnd = Math.min(actEnd, newEnd);

        // If old bounds were provided, compute what the clamp was before.
        // Only warn if the new bounds are MORE restrictive than the old bounds
        // for this activity (i.e. expanding bounds should never trigger a warning).
        if (oldStart !== undefined && oldEnd !== undefined) {
          const oldClampedStart = Math.max(actStart, oldStart);
          const oldClampedEnd = Math.min(actEnd, oldEnd);
          // New clamp is at least as permissive as old clamp → skip
          if (clampedStart <= oldClampedStart && clampedEnd >= oldClampedEnd) continue;
        }

        if (clampedEnd <= clampedStart) {
          result.push({
            activityId: act.id,
            activityName: act.name,
            individualId: entityId,
            individualName: entityName,
            participationKey: pKey,
            fromBeginning: participation?.beginning ?? act.beginning,
            fromEnding: participation?.ending ?? act.ending,
            action: "drop",
          });
        } else if (clampedStart !== actStart || clampedEnd !== actEnd) {
          result.push({
            activityId: act.id,
            activityName: act.name,
            individualId: entityId,
            individualName: entityName,
            participationKey: pKey,
            fromBeginning: participation?.beginning ?? act.beginning,
            fromEnding: participation?.ending ?? act.ending,
            toBeginning: clampedStart,
            toEnding: clampedEnd,
            action: "trim",
          });
        }
      }
    }
    return result;
  };

  const findAffectedActivitiesForInstallationPeriods = (
    entityId: string,
    entityName: string,
    oldPeriods: InstallationPeriod[],
    newPeriods: InstallationPeriod[]
  ): AffectedActivity[] => {
    const result: AffectedActivity[] = [];

    for (const activity of Array.from(dataset.activities.values())) {
      const entries = findParticipationsForIndividual(activity.participations, entityId);
      if (entries.length === 0) continue;

      for (const [pKey, participation] of entries) {
        const activityStart = normalizeStart(
          participation?.beginning ?? activity.beginning
        );
        const activityEnd = normalizeEnd(participation?.ending ?? activity.ending);

        // For per-installation participations, check if the specific component
        // is affected by the period changes
        const targetComponentId = participation.systemComponentId;
        const relevantOldPeriods = targetComponentId
          ? oldPeriods.filter((p) => p.systemComponentId === targetComponentId)
          : oldPeriods;

        const oldActiveInstallation = relevantOldPeriods.find(
          (period) =>
            activityStart >= period.beginning && activityEnd <= period.ending
        );

        if (!oldActiveInstallation) continue;

        const relevantNewPeriods = targetComponentId
          ? newPeriods.filter((p) => p.systemComponentId === targetComponentId)
          : newPeriods;

        const newActiveInstallation = relevantNewPeriods.find(
          (period) =>
            activityStart >= period.beginning && activityEnd <= period.ending
        );

        if (newActiveInstallation) continue;

        const bestOverlap = relevantNewPeriods
          .map((period) => {
            const overlapBeginning = Math.max(activityStart, period.beginning);
            const overlapEnding = Math.min(activityEnd, period.ending);
            return {
              period,
              overlapBeginning,
              overlapEnding,
              overlapDuration: overlapEnding - overlapBeginning,
            };
          })
          .filter((candidate) => candidate.overlapDuration > 0)
          .sort((left, right) => {
            if (right.overlapDuration !== left.overlapDuration) {
              return right.overlapDuration - left.overlapDuration;
            }
            if (left.overlapBeginning !== right.overlapBeginning) {
              return left.overlapBeginning - right.overlapBeginning;
            }
            return left.overlapEnding - right.overlapEnding;
          })[0];

        const previousComponent = dataset.individuals.get(
          oldActiveInstallation.systemComponentId
        );
        const previousSystem = previousComponent?.installedIn
          ? dataset.individuals.get(previousComponent.installedIn)
          : undefined;

        if (!bestOverlap) {
          result.push({
            activityId: activity.id,
            activityName: activity.name,
            individualId: entityId,
            individualName: entityName,
            participationKey: pKey,
            systemName: previousSystem?.name,
            systemComponentName: previousComponent?.name,
            installationBeginning: oldActiveInstallation.beginning,
            installationEnding: oldActiveInstallation.ending,
            fromBeginning: participation?.beginning ?? activity.beginning,
            fromEnding: participation?.ending ?? activity.ending,
            action: "drop",
          });
          continue;
        }

        const nextComponent = dataset.individuals.get(bestOverlap.period.systemComponentId);
        const nextSystem = nextComponent?.installedIn
          ? dataset.individuals.get(nextComponent.installedIn)
          : undefined;

        result.push({
          activityId: activity.id,
          activityName: activity.name,
          individualId: entityId,
          individualName: entityName,
          participationKey: pKey,
          systemName: nextSystem?.name ?? previousSystem?.name,
          systemComponentName: nextComponent?.name ?? previousComponent?.name,
          installationBeginning: oldActiveInstallation.beginning,
          installationEnding: oldActiveInstallation.ending,
          fromBeginning: participation?.beginning ?? activity.beginning,
          fromEnding: participation?.ending ?? activity.ending,
          toBeginning: bestOverlap.overlapBeginning,
          toEnding: bestOverlap.overlapEnding,
          action: "trim",
        });
      }
    }

    // Mark per-installation participations as autoRemove when the same
    // individual still has another unaffected participation in the same activity.
    const affectedKeys = new Set(result.map((r) => `${r.activityId}::${r.participationKey}`));
    for (const aa of result) {
      if (!aa.participationKey || !aa.participationKey.includes("::")) continue;
      const activity = dataset.activities.get(aa.activityId);
      if (!activity) continue;
      const allEntries = findParticipationsForIndividual(activity.participations, aa.individualId);
      const hasUnaffectedSibling = allEntries.some(
        ([key]) => key !== aa.participationKey && !affectedKeys.has(`${aa.activityId}::${key}`)
      );
      if (hasUnaffectedSibling) {
        aa.autoRemove = true;
      }
    }

    return result;
  };

  const markReturnToIndividualChanges = (
    affectedActivities: AffectedActivity[]
  ): AffectedActivity[] =>
    affectedActivities.map((affectedActivity) =>
      affectedActivity.action === "drop"
        ? {
            ...affectedActivity,
            keepStrategy: "return-to-individual" as const,
          }
        : affectedActivity
    );

  const applyInstallationBoundsToPeriods = (
    periods: InstallationPeriod[],
    componentBoundsById: Map<
      string,
      { beginning: number; ending: number; dropped: boolean }
    >
  ): InstallationPeriod[] =>
    periods.flatMap((period) => {
      const bounds = componentBoundsById.get(period.systemComponentId);
      if (!bounds) {
        return [period];
      }

      if (bounds.dropped) {
        return [];
      }

      const nextBeginning = Math.max(period.beginning, bounds.beginning);
      const nextEnding = Math.min(period.ending, bounds.ending);

      if (nextEnding <= nextBeginning) {
        return [];
      }

      if (
        nextBeginning === period.beginning &&
        nextEnding === period.ending
      ) {
        return [period];
      }

      return [
        {
          ...period,
          beginning: nextBeginning,
          ending: nextEnding,
        },
      ];
    });

  const mergeAffectedActivities = (
    ...activityGroups: AffectedActivity[][]
  ): AffectedActivity[] => {
    const merged = new Map<string, AffectedActivity>();

    activityGroups.flat().forEach((candidate) => {
      const key = `${candidate.activityId}:${candidate.participationKey ?? candidate.individualId}`;
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, candidate);
        return;
      }

      if (existing.action === "drop" || candidate.action === "drop") {
        merged.set(key, {
          ...existing,
          ...candidate,
          action: "drop",
          toBeginning: undefined,
          toEnding: undefined,
        });
        return;
      }

      const mergedBeginning = Math.max(
        existing.toBeginning ?? existing.fromBeginning,
        candidate.toBeginning ?? candidate.fromBeginning
      );
      const mergedEnding = Math.min(
        existing.toEnding ?? existing.fromEnding,
        candidate.toEnding ?? candidate.fromEnding
      );

      if (mergedEnding <= mergedBeginning) {
        merged.set(key, {
          ...existing,
          ...candidate,
          action: "drop",
          toBeginning: undefined,
          toEnding: undefined,
        });
        return;
      }

      merged.set(key, {
        ...existing,
        ...candidate,
        action: "trim",
        toBeginning: mergedBeginning,
        toEnding: mergedEnding,
      });
    });

    return Array.from(merged.values());
  };

  const annotateActivityOutcomes = (
    affectedActivities: AffectedActivity[]
  ): AffectedActivity[] => {
    const affectedByActivity = new Map<string, AffectedActivity[]>();

    affectedActivities.forEach((affectedActivity) => {
      const items = affectedByActivity.get(affectedActivity.activityId) ?? [];
      items.push(affectedActivity);
      affectedByActivity.set(affectedActivity.activityId, items);
    });

    return affectedActivities.map((affectedActivity) => {
      const activity = dataset.activities.get(affectedActivity.activityId);
      const relatedChanges = affectedByActivity.get(affectedActivity.activityId);
      if (!activity || !relatedChanges) return affectedActivity;

      const remainingParticipations = new Map(activity.participations);

      relatedChanges.forEach((change) => {
        const pKey = change.participationKey ?? change.individualId;
        if (change.action === "drop") {
          const participation = remainingParticipations.get(pKey);
          remainingParticipations.delete(pKey);

          if (
            change.keepStrategy === "return-to-individual" &&
            participation
          ) {
            const plainKey = participationMapKey(change.individualId);
            if (!remainingParticipations.has(plainKey)) {
              remainingParticipations.set(plainKey, {
                ...participation,
                systemComponentId: undefined,
                installationPeriodId: undefined,
              });
            }
          }

          return;
        }

        if (
          change.toBeginning === undefined ||
          change.toEnding === undefined
        ) {
          return;
        }

        const participation = remainingParticipations.get(pKey);
        if (!participation) return;

        remainingParticipations.set(pKey, {
          ...participation,
          beginning: change.toBeginning,
          ending: change.toEnding,
        });
      });

      if (remainingParticipations.size === 0) {
        return {
          ...affectedActivity,
          activityOutcomeText:
            "Activity itself would be removed (no remaining participants)",
        };
      }

      let earliestParticipationStart = Infinity;
      let latestParticipationEnd = -Infinity;

      remainingParticipations.forEach((participation) => {
        const effectiveStart = normalizeStart(
          participation.beginning ?? activity.beginning
        );
        const effectiveEnd = normalizeEnd(
          participation.ending ?? activity.ending
        );

        earliestParticipationStart = Math.min(
          earliestParticipationStart,
          effectiveStart
        );
        latestParticipationEnd = Math.max(
          latestParticipationEnd,
          effectiveEnd
        );
      });

      if (
        !Number.isFinite(earliestParticipationStart) ||
        !Number.isFinite(latestParticipationEnd) ||
        latestParticipationEnd <= earliestParticipationStart
      ) {
        return {
          ...affectedActivity,
          activityOutcomeText:
            "Activity itself would be removed (no remaining participants)",
        };
      }

      const currentActivityStart = normalizeStart(activity.beginning);
      const currentActivityEnd = normalizeEnd(activity.ending);

      if (
        earliestParticipationStart > currentActivityStart ||
        latestParticipationEnd < currentActivityEnd
      ) {
        return {
          ...affectedActivity,
          activityOutcomeText: `Activity itself would be trimmed to ${formatBound(
            earliestParticipationStart,
            true
          )}-${formatBound(latestParticipationEnd, false)}`,
        };
      }

      return affectedActivity;
    });
  };

  const applyAffectedActivityChanges = (
    model: Model,
    affectedActivities: AffectedActivity[]
  ) => {
    const affectedActivityIds = new Set(
      affectedActivities.map((affectedActivity) => affectedActivity.activityId)
    );

    const trimBoundsByParticipation = new Map<
      string,
      { beginning: number; ending: number }
    >();

    affectedActivities.forEach((affectedActivity) => {
      const activity = model.activities.get(affectedActivity.activityId);
      if (!activity) return;

      const pKey = resolveCurrentAffectedParticipationKey(
        activity,
        affectedActivity
      );

      if (affectedActivity.action === "drop") {
        activity.participations.delete(pKey);
        return;
      }

      if (
        affectedActivity.toBeginning === undefined ||
        affectedActivity.toEnding === undefined
      ) {
        return;
      }

      const trimKey = `${affectedActivity.activityId}:${pKey}`;
      const existing = trimBoundsByParticipation.get(trimKey);
      if (!existing) {
        trimBoundsByParticipation.set(trimKey, {
          beginning: affectedActivity.toBeginning,
          ending: affectedActivity.toEnding,
        });
        return;
      }

      trimBoundsByParticipation.set(trimKey, {
        beginning: Math.max(existing.beginning, affectedActivity.toBeginning),
        ending: Math.min(existing.ending, affectedActivity.toEnding),
      });
    });

    trimBoundsByParticipation.forEach((bounds, trimKey) => {
      const separatorIdx = trimKey.indexOf(":");
      const activityId = trimKey.substring(0, separatorIdx);
      const pKey = trimKey.substring(separatorIdx + 1);
      const activity = model.activities.get(activityId);
      if (!activity || bounds.ending <= bounds.beginning) return;
      const participation = activity.participations.get(pKey);
      if (!participation) return;

      activity.participations.set(pKey, {
        ...participation,
        beginning: bounds.beginning,
        ending: bounds.ending,
      });

      model.addActivity({
        ...activity,
        participations: new Map(activity.participations),
      });
    });

    shrinkActivitiesToRemainingParticipants(model, affectedActivityIds);
  };

  const shrinkActivitiesToRemainingParticipants = (
    model: Model,
    activityIds: Iterable<string>
  ) => {
    Array.from(activityIds).forEach((activityId) => {
      const activity = model.activities.get(activityId);
      if (!activity) return;
      if (activity.participations.size === 0) {
        model.activities.delete(activityId);
        return;
      }

      let earliestParticipationStart = Infinity;
      let latestParticipationEnd = -Infinity;

      activity.participations.forEach((participation) => {
        const effectiveStart = normalizeStart(
          participation.beginning ?? activity.beginning
        );
        const effectiveEnd = normalizeEnd(
          participation.ending ?? activity.ending
        );

        earliestParticipationStart = Math.min(
          earliestParticipationStart,
          effectiveStart
        );
        latestParticipationEnd = Math.max(
          latestParticipationEnd,
          effectiveEnd
        );
      });

      if (
        !Number.isFinite(earliestParticipationStart) ||
        !Number.isFinite(latestParticipationEnd) ||
        latestParticipationEnd <= earliestParticipationStart
      ) {
        return;
      }

      const currentActivityStart = normalizeStart(activity.beginning);
      const currentActivityEnd = normalizeEnd(activity.ending);
      let changed = false;
      let nextBeginning = activity.beginning;
      let nextEnding = activity.ending;

      if (earliestParticipationStart > currentActivityStart) {
        nextBeginning = earliestParticipationStart;
        changed = true;
      }

      if (latestParticipationEnd < currentActivityEnd) {
        nextEnding = latestParticipationEnd;
        changed = true;
      }

      if (changed) {
        model.addActivity({
          ...activity,
          beginning: nextBeginning,
          ending: nextEnding,
          participations: new Map(activity.participations),
        });
      }
    });
  };

  const parseBoundary = (text: string, isBeginning: boolean) => {
    if (text.trim() === "") {
      return isBeginning ? -1 : Model.END_OF_TIME;
    }
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) {
      return isBeginning ? -1 : Model.END_OF_TIME;
    }
    if (isBeginning && numeric <= 0) {
      return -1;
    }
    if (!isBeginning && numeric <= 0) {
      return Model.END_OF_TIME;
    }
    return Math.trunc(numeric);
  };

  const updateInputs = (key: keyof Individual, value: any) => {
    setInputs((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  };

  const handleClose = () => {
    setShow(false);
    setSelectedIndividual(undefined);
    setInputs(defaultIndividual);
    setDirty(false);
    setErrors([]);
    setBeginningText(EMPTY_BEGINNING);
    setEndingText(EMPTY_ENDING);
    setInstallationRows([]);
    setInstallationErrors([]);
    setShowInstallationsModal(false);
    setShowBoundsWarningModal(false);
    setPendingSaveIndividual(null);
    setPendingRemoveIndividual(null);
    setPendingTrimCount(0);
    setPendingDroppedCount(0);
    setPendingBoundsChanges([]);
    setPendingAffectedActivities([]);
    setPendingAutoRemoveActivities([]);
    setPendingActivityAction("keep");
    setSelectedAffectedActivityKeys(new Set());
    setPendingChangeScope("bounds");
    setShowCascadeWarningModal(false);
    setCascadeWarning(null);
    
    setTypeOpen(false);
    setTypeSearch("");
    setEditingTypeId(null);
    setEditingTypeValue("");
  };

  const handleModalHide = () => {
    if (editingTypeId || shouldSuppressModalHide()) {
      return;
    }
    handleClose();
  };

  const handleInstallationsModalHide = () => {
    if (shouldSuppressModalHide()) return;
    setShowInstallationsModal(false);
  };

  const commitIndividualSave = (next: Individual) => {
    setIndividual(next);
    handleClose();
  };

  const saveIndividualToModel = (d: Model, individual: Individual) => {
    d.addIndividual(individual);
    d.reconcileParticipationsForInstallations(individual);
  };

  const saveIndividualToModelWithoutReconcile = (
    d: Model,
    individual: Individual
  ) => {
    d.addIndividual(individual);
  };

  const buildDeleteCascadeWarning = (individual: Individual): CascadeWarning => {
    const cascade = dataset.getIndividualRemovalCascade(individual.id);
    const deletedIds = new Set(cascade.deletedIndividualIds);

    const affectedComponents: AffectedComponent[] = cascade.deletedIndividualIds
      .filter((id) => id !== individual.id)
      .map((id) => dataset.individuals.get(id))
      .filter((candidate): candidate is Individual => !!candidate)
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        fromBeginning: candidate.beginning,
        fromEnding: candidate.ending,
        action: "drop",
      }));

    const affectedComponentOfSystems: AffectedComponentOfSystem[] = [];
    const affectedInstallations: AffectedInstallation[] = [];

    cascade.removedInstallations.forEach((installation) => {
      const installationOwner = dataset.individuals.get(installation.individualId);
      const installationTarget = dataset.individuals.get(installation.systemComponentId);

      const ownerType = installationOwner
        ? getEntityTypeIdFromIndividual(installationOwner)
        : undefined;
      const targetType = installationTarget
        ? getEntityTypeIdFromIndividual(installationTarget)
        : undefined;

      if (
        ownerType === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
        targetType === ENTITY_TYPE_IDS.SYSTEM &&
        !deletedIds.has(installation.systemComponentId)
      ) {
        affectedComponentOfSystems.push({
          componentId: installation.individualId,
          componentName: installationOwner?.name || installation.individualId,
          systemId: installation.systemComponentId,
          systemName: installationTarget?.name || installation.systemComponentId,
          fromBeginning: installation.beginning,
          fromEnding: installation.ending,
          action: "drop",
        });
        return;
      }

      affectedInstallations.push({
        periodId: `${installation.individualId}:${installation.systemComponentId}:${installation.beginning}:${installation.ending}`,
        individualId: installation.individualId,
        individualName: installationOwner?.name || installation.individualId,
        systemComponentId: installation.systemComponentId,
        systemComponentName:
          installationTarget?.name || installation.systemComponentId,
        fromBeginning: installation.beginning,
        fromEnding: installation.ending,
        action: "drop",
      });
    });

    const requiredActivities: AffectedActivity[] = [];

    cascade.removedParticipations.forEach((removed) => {
      const activity = dataset.activities.get(removed.activityId);
      const participation = activity?.participations.get(removed.participationKey);
      const component = participation?.systemComponentId
        ? dataset.individuals.get(participation.systemComponentId)
        : undefined;
      const system = component?.installedIn
        ? dataset.individuals.get(component.installedIn)
        : undefined;

      const baseActivity: AffectedActivity = {
        activityId: removed.activityId,
        activityName: activity?.name || removed.activityId,
        individualId: removed.individualId,
        individualName:
          dataset.individuals.get(removed.individualId)?.name || removed.individualId,
        participationKey: removed.participationKey,
        systemName: system?.name,
        systemComponentName: component?.name,
        fromBeginning: participation?.beginning ?? activity?.beginning ?? 0,
        fromEnding: participation?.ending ?? activity?.ending ?? Model.END_OF_TIME,
        action: "drop",
      };

      requiredActivities.push({
        ...baseActivity,
        deleteChoice: "required",
      });
    });

    cascade.removedActivityIds.forEach((activityId) => {
      const activity = dataset.activities.get(activityId);

      requiredActivities.push({
        activityId,
        activityName: activity?.name || activityId,
        individualId: individual.id,
        individualName: individual.name,
        fromBeginning: activity?.beginning ?? 0,
        fromEnding: activity?.ending ?? Model.END_OF_TIME,
        action: "drop",
        deleteChoice: "required",
        activityOutcomeText: "activity would be deleted because no participants remain",
      });
    });

    const optionalActivities = Array.from(dataset.individuals.values())
      .filter((candidate) => !deletedIds.has(candidate.id))
      .flatMap((candidate) => {
        const oldPeriods = getInstallationPeriods(candidate);
        const newPeriods = oldPeriods.filter(
          (period) => !deletedIds.has(period.systemComponentId)
        );

        if (oldPeriods.length === newPeriods.length) {
          return [];
        }

        return findAffectedActivitiesForInstallationPeriods(
          candidate.id,
          candidate.name,
          oldPeriods,
          newPeriods
        ).map((affectedActivity) => ({
          ...affectedActivity,
          deleteChoice: "optional" as const,
          keepStrategy: "return-to-individual" as const,
        }));
      });

    const optionalByKey = new Map(
      annotateActivityOutcomes(mergeAffectedActivities(optionalActivities)).map(
        (affectedActivity) => [
          getAffectedActivitySelectionKey(affectedActivity),
          affectedActivity,
        ]
      )
    );

    requiredActivities.forEach((affectedActivity) => {
      optionalByKey.delete(getAffectedActivitySelectionKey(affectedActivity));
    });

    const affectedActivities: AffectedActivity[] = [
      ...requiredActivities,
      ...Array.from(optionalByKey.values()),
    ];

    return {
      mode: "delete",
      leadText: "Deleting",
      removeButtonLabel: `Delete ${individual.name || "Entity"}`,
      entityName: individual.name || "Entity",
      affectedComponents,
      affectedComponentOfSystems,
      affectedInstallations,
      affectedActivities,
      pendingIndividual: individual,
      applyTrim: () => {},
      applyRemove: () => {
        deleteIndividual(individual.id);
        setShowCascadeWarningModal(false);
        setCascadeWarning(null);
        handleClose();
      },
    };
  };

  const handleShow = () => {
    const base = selectedIndividual
      ? { ...selectedIndividual }
      : { ...defaultIndividual, id: uuidv4() };

    const category =
      base.entityType ??
      getEntityCategoryFromTypeId(getEntityTypeIdFromIndividual(base));

    const normalized = syncLegacyInstallationFields({
      ...base,
      entityType: category,
      installations: getInstallationPeriods(base),
    });

    if (getEntityTypeIdFromIndividual(normalized) === ENTITY_TYPE_IDS.INDIVIDUAL) {
      const hasParticipants = dataset.hasParticipants(normalized.id);
      if (hasParticipants) {
        const earliestBeginning = dataset.earliestParticipantBeginning(normalized.id);
        const latestEnding = dataset.lastParticipantEnding(normalized.id);

        if (
          normalized.beginning >= 0 &&
          !normalized.beginsWithParticipant &&
          normalized.beginning === earliestBeginning
        ) {
          normalized.beginsWithParticipant = true;
        }

        if (
          normalized.ending < Model.END_OF_TIME &&
          !normalized.endsWithParticipant &&
          normalized.ending === latestEnding
        ) {
          normalized.endsWithParticipant = true;
        }
      }
    }

    setInputs(normalized);
    setBeginningText(asInputText(normalized.beginning, true));
    setEndingText(asInputText(normalized.ending, false));
    setDirty(false);
    setErrors([]);
    setTypeOpen(false);
  };

  useEffect(() => {
    if (!show) return;
    handleShow();
  }, [show]);

  // Handle click outside type dropdown
  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(ev.target as Node)
      ) {
        setTypeOpen(false);
        setEditingTypeId(null);
        setEditingTypeValue("");
      }
    }
    if (typeOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [typeOpen]);

  // Ensure a highlighted item is visible when changed
  useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      const el = itemRefs.current[highlightedIndex];
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleChangeText = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateInputs(e.target.name as keyof Individual, e.target.value);
  };

  const handleBeginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextText = e.target.value;
    setBeginningText(nextText);
    updateInputs("beginning", parseBoundary(nextText, true));
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextText = e.target.value;
    setEndingText(nextText);
    updateInputs("ending", parseBoundary(nextText, false));
  };

  // ----- New helper functions for custom TYPE selector -----
  const filteredTypes = dataset.individualTypes.filter((t) =>
    t.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const showCreateTypeOption =
    typeSearch.trim().length > 0 &&
    !dataset.individualTypes.some(
      (t) => t.name.toLowerCase() === typeSearch.trim().toLowerCase()
    );

  const handleSelectType = (typeId: string) => {
    const t = dataset.individualTypes.find((x) => x.id === typeId);
    if (t) updateInputs("type", t);
    setTypeOpen(false);
    setTypeSearch("");
    setEditingTypeId(null);
    setEditingTypeValue("");
  };

  const moveHighlight = (delta: number) => {
    if (filteredTypes.length === 0) return;
    setHighlightedIndex((prev) => {
      let next = prev + delta;
      if (next < 0) next = filteredTypes.length - 1;
      if (next >= filteredTypes.length) next = 0;
      return next;
    });
  };

  const selectHighlighted = () => {
    if (highlightedIndex >= 0 && highlightedIndex < filteredTypes.length) {
      handleSelectType(filteredTypes[highlightedIndex].id);
    }
  };

  const handleCreateTypeFromSearch = () => {
    const name = typeSearch.trim();
    if (!name) return;
    const newId = uuidv4();

    updateDataset((d) => {
      d.addIndividualType(newId, name);
      return d;
    });

    // Immediately select the newly created type for this form
    updateInputs("type", { id: newId, name });
    setTypeOpen(false);
    setTypeSearch("");
  };

  const startEditType = (typeId: string, currentName: string, e: any) => {
    e.stopPropagation();
    setEditingTypeId(typeId);
    setEditingTypeValue(currentName);
  };

  const saveEditType = () => {
    if (!editingTypeId) return;
    const newName = editingTypeValue.trim();
    if (!newName) return;

    updateDataset((d) => {
      const existing = d.individualTypes.find(t => t.id === editingTypeId);
      if (existing) existing.name = newName;

      // Update individuals that use this type to reference the canonical Type object
      d.individuals.forEach((ind) => {
        if (ind.type && ind.type.id === editingTypeId) {
          const canonical = d.individualTypes.find((x) => x.id === editingTypeId);
          if (canonical) ind.type = canonical;
        }
      });
      
      if (d.defaultIndividualType && d.defaultIndividualType.id === editingTypeId) {
         const canonical = d.individualTypes.find((x) => x.id === editingTypeId);
         if (canonical) d.defaultIndividualType = canonical;
      }
      return d;
    });

    // Also update current inputs if it was the selected type
    if (inputs.type && inputs.type.id === editingTypeId) {
       updateInputs("type", { id: editingTypeId, name: newName });
    }

    setEditingTypeId(null);
    setEditingTypeValue("");
  };

  const cancelEditType = () => {
    setEditingTypeId(null);
    setEditingTypeValue("");
  };
  // ----- end helpers -----

  const handleEntityType = (typeId: string) => {
    if (isEditMode) return;

    const category = getEntityCategoryFromTypeId(typeId);
    setInputs((previous) => {
      const next: Individual = {
        ...previous,
        entityType: category,
      };
      if (typeId !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        next.installedIn = undefined;
      }
      if (typeId !== ENTITY_TYPE_IDS.INDIVIDUAL) {
        next.installations = [];
        next.installedIn = undefined;
        next.installedBeginning = undefined;
        next.installedEnding = undefined;
      }
      return next;
    });
    setDirty(true);
  };

  const validateMainInputs = () => {
    const runningErrors: string[] = [];

    if (!inputs.name?.trim()) {
      runningErrors.push("Name field is required");
    }

    if (!inputs.type) {
      runningErrors.push("Type field is required");
    }

    if (
      Number.isFinite(inputs.beginning) &&
      Number.isFinite(inputs.ending) &&
      inputs.beginning >= 0 &&
      inputs.ending < Model.END_OF_TIME &&
      inputs.ending <= inputs.beginning
    ) {
      runningErrors.push("Ending must be after Beginning");
    }

    if (selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
      if (!inputs.installedIn) {
        runningErrors.push("System Component must be a component of a System");
      } else {
        const parentSystem = dataset.individuals.get(inputs.installedIn);
        if (
          !parentSystem ||
          getEntityTypeIdFromIndividual(parentSystem) !== ENTITY_TYPE_IDS.SYSTEM
        ) {
          runningErrors.push("System Component can only be a component of a System");
        } else {
          const parentStart = normalizeStart(parentSystem.beginning);
          const parentEnd = normalizeEnd(parentSystem.ending);
          const ownStart = normalizeStart(inputs.beginning);
          const ownEnd = normalizeEnd(inputs.ending);

          if (ownStart < parentStart) {
            runningErrors.push(
              `System Component beginning must be within ${parentSystem.name}`
            );
          }
        }
      }
    }

    if (runningErrors.length > 0) {
      setErrors(runningErrors);
      return false;
    }

    setErrors([]);
    return true;
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty) {
      handleClose();
      return;
    }

    if (!validateMainInputs()) return;

    let next = { ...inputs };

    if (selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL) {
      const originalPeriods = getInstallationPeriods(next);
      let periods = originalPeriods;
      const ownStart = normalizeStart(next.beginning);
      const ownEnd = normalizeEnd(next.ending);
      const existingInd = dataset.individuals.get(next.id);
      const oldOwnStart = existingInd ? normalizeStart(existingInd.beginning) : ownStart;
      const oldOwnEnd = existingInd ? normalizeEnd(existingInd.ending) : ownEnd;
      const oldPeriods = existingInd ? getInstallationPeriods(existingInd) : [];
      let trimmedCount = 0;
      let droppedCount = 0;
      const boundsChanges: PendingBoundsChange[] = [];

      periods = periods
        .map((period) => {
          const component = dataset.individuals.get(period.systemComponentId);
          const parentSystem = component?.installedIn
            ? dataset.individuals.get(component.installedIn)
            : undefined;
          const systemComponentName = component?.name ?? period.systemComponentId;

          const beginning = Math.max(period.beginning, ownStart);
          const ending = Math.min(period.ending, ownEnd);

          if (ending <= beginning) {
            droppedCount += 1;
            boundsChanges.push({
              periodId: period.id,
              systemComponentId: period.systemComponentId,
              systemComponentName,
              parentSystemName: parentSystem?.name,
              fromBeginning: period.beginning,
              fromEnding: period.ending,
              action: "drop",
            });
            return null;
          }

          if (beginning !== period.beginning || ending !== period.ending) {
            trimmedCount += 1;
            boundsChanges.push({
              periodId: period.id,
              systemComponentId: period.systemComponentId,
              systemComponentName,
              parentSystemName: parentSystem?.name,
              fromBeginning: period.beginning,
              fromEnding: period.ending,
              toBeginning: beginning,
              toEnding: ending,
              action: "trim",
            });
          }

          return {
            ...period,
            beginning,
            ending,
          };
        })
        .filter((period): period is InstallationPeriod => !!period);

      if (trimmedCount > 0 || droppedCount > 0) {
        const boundsAffectedActivities = findAffectedActivities(
          next.id,
          next.name,
          ownStart,
          ownEnd,
          oldOwnStart,
          oldOwnEnd
        );
        const installationAffectedActivities =
          findAffectedActivitiesForInstallationPeriods(
            next.id,
            next.name,
            oldPeriods,
            periods
          );
        const indAffectedActivities = mergeAffectedActivities(
          boundsAffectedActivities,
          installationAffectedActivities
        );
        const warningScope =
          boundsAffectedActivities.length > 0 && installationAffectedActivities.length > 0
            ? "both"
            : installationAffectedActivities.length > 0
            ? "installations"
            : "bounds";

        const pending = syncLegacyInstallationFields({
          ...next,
          // Clear legacy fields so getInstallationPeriods inside sync
          // doesn't fall back to them and resurrect dropped periods.
          installedIn: undefined,
          installedBeginning: undefined,
          installedEnding: undefined,
          installations: periods,
        });

        const affectedPeriodIds = new Set(boundsChanges.map((change) => change.periodId));
        const removeAllAffectedPeriods = originalPeriods.filter(
          (period) => !affectedPeriodIds.has(period.id)
        );
        const pendingRemoveAll = syncLegacyInstallationFields({
          ...next,
          installedIn: undefined,
          installedBeginning: undefined,
          installedEnding: undefined,
          installations: removeAllAffectedPeriods,
        });

        setPendingSaveIndividual(pending);
        setPendingRemoveIndividual(pendingRemoveAll);
        setPendingTrimCount(trimmedCount);
        setPendingDroppedCount(droppedCount);
        setPendingBoundsChanges(boundsChanges);
        const annotated = annotateActivityOutcomes(indAffectedActivities);
        const autoRemovable = annotated.filter((aa) => aa.autoRemove);
        const userVisible = annotated.filter((aa) => !aa.autoRemove);
        setPendingAutoRemoveActivities(autoRemovable);
        setPendingAffectedActivities(userVisible);
        setPendingActivityAction("keep");
        setSelectedAffectedActivityKeys(new Set());
        setPendingChangeScope(warningScope);
        setShowBoundsWarningModal(true);
        return;
      }

      const installationAffectedActivities =
        findAffectedActivitiesForInstallationPeriods(
          next.id,
          next.name,
          oldPeriods,
          periods
        );

      // Even without installation changes, check for affected activities
      {
        const boundsAffectedActivities = findAffectedActivities(
          next.id,
          next.name,
          ownStart,
          ownEnd,
          oldOwnStart,
          oldOwnEnd
        );
        const indAffectedActivities = mergeAffectedActivities(
          boundsAffectedActivities,
          installationAffectedActivities
        );
        if (indAffectedActivities.length > 0) {
          const annotated = annotateActivityOutcomes(indAffectedActivities);
          const autoRemovable = annotated.filter((aa) => aa.autoRemove);
          const userVisible = annotated.filter((aa) => !aa.autoRemove);

          // If all affected entries are auto-removable, skip the modal
          if (userVisible.length === 0 && autoRemovable.length > 0) {
            const pending = syncLegacyInstallationFields({
              ...next,
              installedIn: undefined,
              installedBeginning: undefined,
              installedEnding: undefined,
              installations: periods,
            });
            updateDataset((d: Model) => {
              saveIndividualToModel(d, pending);
              applyAffectedActivityChanges(d, autoRemovable);
            });
            handleClose();
            return;
          }

          const warningScope =
            boundsAffectedActivities.length > 0 && installationAffectedActivities.length > 0
              ? "both"
              : installationAffectedActivities.length > 0
              ? "installations"
              : "bounds";
          const pending = syncLegacyInstallationFields({
            ...next,
            installedIn: undefined,
            installedBeginning: undefined,
            installedEnding: undefined,
            installations: periods,
          });
          setPendingSaveIndividual(pending);
          setPendingRemoveIndividual(pending);
          setPendingTrimCount(0);
          setPendingDroppedCount(0);
          setPendingBoundsChanges([]);
          setPendingAutoRemoveActivities(autoRemovable);
          setPendingAffectedActivities(userVisible);
          setPendingActivityAction("keep");
          setSelectedAffectedActivityKeys(new Set());
          setPendingChangeScope(warningScope);
          setShowBoundsWarningModal(true);
          return;
        }
      }

      next = syncLegacyInstallationFields({
        ...next,
        installedIn: undefined,
        installedBeginning: undefined,
        installedEnding: undefined,
        installations: periods,
      });
    } else {
      next = {
        ...next,
        installations: [],
        installedBeginning: undefined,
        installedEnding: undefined,
      };
      if (selectedEntityTypeId !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        next.installedIn = undefined;
      }

      // --- Cascade detection for SYSTEM and SYSTEM_COMPONENT ---
      const newStart = normalizeStart(next.beginning);
      const newEnd = normalizeEnd(next.ending);

      if (
        selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM &&
        isEditMode
      ) {
        // Get the old system bounds to detect trivial start-date propagation
        const oldSystem = dataset.individuals.get(next.id);
        const oldStart = oldSystem ? normalizeStart(oldSystem.beginning) : 0;

        const affectedComps: AffectedComponent[] = [];
        const affectedInstalls: AffectedInstallation[] = [];
        // Components that only need their 0-start bumped to the new system start
        const silentCompTrims: AffectedComponent[] = [];

        // Find child system components whose bounds exceed the new system bounds
        const childComponents = Array.from(dataset.individuals.values()).filter(
          (ind) =>
            ind.installedIn === next.id &&
            getEntityTypeIdFromIndividual(ind) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT
        );

        for (const comp of childComponents) {
          const compStart = normalizeStart(comp.beginning);
          const compEnd = normalizeEnd(comp.ending);

          // If the component's ending is infinity, keep it as infinity
          // regardless of the system's new bounds.
          const compEndIsInfinity = comp.ending >= Model.END_OF_TIME;

          const clampedStart = Math.max(compStart, newStart);
          const clampedEnd = compEndIsInfinity ? compEnd : Math.min(compEnd, newEnd);

          // Preserve original raw values when the normalized value didn't change
          // e.g. beginning:-1 (infinite past) normalizes to 0, so if clamped to 0
          // we keep -1 to preserve the visual open-start rendering.
          const rawClampedStart = clampedStart === compStart ? comp.beginning : clampedStart;
          const rawClampedEnd = clampedEnd === compEnd ? comp.ending : clampedEnd;

          if (clampedEnd <= clampedStart) {
            // Component falls entirely outside new bounds
            affectedComps.push({
              id: comp.id,
              name: comp.name,
              fromBeginning: comp.beginning,
              fromEnding: comp.ending,
              action: "drop",
            });

            // All installations referencing this component are also dropped
            for (const ind of Array.from(dataset.individuals.values())) {
              const periods = getInstallationPeriods(ind);
              for (const p of periods) {
                if (p.systemComponentId === comp.id) {
                  affectedInstalls.push({
                    periodId: p.id,
                    individualId: ind.id,
                    individualName: ind.name,
                    systemComponentId: comp.id,
                    systemComponentName: comp.name,
                    fromBeginning: p.beginning,
                    fromEnding: p.ending,
                    action: "drop",
                  });
                }
              }
            }
          } else {
            const compTrimmed = clampedStart !== compStart || clampedEnd !== compEnd;
            if (compTrimmed) {
              // Detect trivial start-date propagation: old system start was 0,
              // component also started at 0, and only the start is changing.
              const isTrivialStartBump =
                oldStart === 0 &&
                compStart === 0 &&
                clampedStart !== compStart &&
                clampedEnd === compEnd;

              const entry: AffectedComponent = {
                id: comp.id,
                name: comp.name,
                fromBeginning: comp.beginning,
                fromEnding: comp.ending,
                toBeginning: rawClampedStart,
                toEnding: rawClampedEnd,
                action: "trim",
              };

              if (isTrivialStartBump) {
                silentCompTrims.push(entry);
              } else {
                affectedComps.push(entry);
              }
            }

            // Check installations referencing this component
            // They are always clamped to the intersection of the component bounds
            // and the system's new bounds (even when the component itself keeps infinity).
            const effectiveCompStart = Math.max(compTrimmed ? clampedStart : compStart, newStart);
            const effectiveCompEnd = Math.min(compTrimmed ? clampedEnd : compEnd, newEnd);

            // Whether this component was silently trimmed (trivial start bump)
            const compIsSilent = silentCompTrims.some((c) => c.id === comp.id);

            for (const ind of Array.from(dataset.individuals.values())) {
              const periods = getInstallationPeriods(ind);
              for (const p of periods) {
                if (p.systemComponentId === comp.id) {
                  const pStart = Math.max(p.beginning, effectiveCompStart);
                  const pEnd = Math.min(p.ending, effectiveCompEnd);

                  if (pEnd <= pStart) {
                    affectedInstalls.push({
                      periodId: p.id,
                      individualId: ind.id,
                      individualName: ind.name,
                      systemComponentId: comp.id,
                      systemComponentName: comp.name,
                      fromBeginning: p.beginning,
                      fromEnding: p.ending,
                      action: "drop",
                    });
                  } else if (pStart !== p.beginning || pEnd !== p.ending) {
                    // Trivial: installation start was 0, only start changed,
                    // and the owning component is also a silent trim
                    const installIsTrivial =
                      compIsSilent &&
                      oldStart === 0 &&
                      p.beginning === 0 &&
                      pStart !== p.beginning &&
                      pEnd === p.ending;

                    if (!installIsTrivial) {
                      affectedInstalls.push({
                        periodId: p.id,
                        individualId: ind.id,
                        individualName: ind.name,
                        systemComponentId: comp.id,
                        systemComponentName: comp.name,
                        fromBeginning: p.beginning,
                        fromEnding: p.ending,
                        toBeginning: pStart,
                        toEnding: pEnd,
                        action: "trim",
                      });
                    }
                  }
                }
              }
            }
          }
        }

        // If there are non-trivial affected items, include silent trims in the affected list
        if (silentCompTrims.length > 0 && (affectedComps.length > 0 || affectedInstalls.length > 0)) {
          affectedComps.push(...silentCompTrims);
        }

        // Check activities that participate the system or any of its child components or installed individuals
        const affectedActivities: AffectedActivity[] = [];
        const componentBoundsById = new Map<
          string,
          { beginning: number; ending: number; dropped: boolean }
        >();
        // Activities participating the system itself
        const oldEnd = oldSystem ? normalizeEnd(oldSystem.ending) : newEnd;
        affectedActivities.push(...findAffectedActivities(next.id, next.name, newStart, newEnd, oldStart, oldEnd));
        // Activities participating child components
        const allCompEntries = [...affectedComps, ...silentCompTrims];
        for (const comp of childComponents) {
          const compFinalStart = (() => {
            const ac = allCompEntries.find((c) => c.id === comp.id);
            return ac?.toBeginning !== undefined ? normalizeStart(ac.toBeginning) : normalizeStart(comp.beginning);
          })();
          const compFinalEnd = (() => {
            const ac = allCompEntries.find((c) => c.id === comp.id);
            if (ac?.action === "drop") return 0; // component will be dropped
            return ac?.toEnding !== undefined ? normalizeEnd(ac.toEnding) : normalizeEnd(comp.ending);
          })();
          
          const compEffStart = Math.max(compFinalStart, newStart);
          const compEffEnd = Math.min(compFinalEnd, newEnd);
          const oldCompEffStart = Math.max(normalizeStart(comp.beginning), oldStart);
          const oldCompEffEnd = Math.min(normalizeEnd(comp.ending), oldEnd);

          componentBoundsById.set(comp.id, {
            beginning: compEffStart,
            ending: compEffEnd,
            dropped: compEffEnd <= compEffStart,
          });

          if (compEffEnd > compEffStart) {
            affectedActivities.push(...findAffectedActivities(comp.id, comp.name, compEffStart, compEffEnd, oldCompEffStart, oldCompEffEnd).map(a => ({...a, systemName: next.name})));
          } else {
            affectedActivities.push(...findAffectedActivities(comp.id, comp.name, compEffStart, compEffStart, oldCompEffStart, oldCompEffEnd).map(a => ({...a, systemName: next.name})));
          }
        }

        for (const ind of Array.from(dataset.individuals.values())) {
          const oldPeriods = getInstallationPeriods(ind);
          const newPeriods = applyInstallationBoundsToPeriods(
            oldPeriods,
            componentBoundsById
          );

          if (oldPeriods.length === newPeriods.length) {
            const unchanged = oldPeriods.every((period, index) => {
              const nextPeriod = newPeriods[index];
              return (
                nextPeriod &&
                nextPeriod.id === period.id &&
                nextPeriod.systemComponentId === period.systemComponentId &&
                nextPeriod.beginning === period.beginning &&
                nextPeriod.ending === period.ending
              );
            });
            if (unchanged) {
              continue;
            }
          }

          affectedActivities.push(
            ...markReturnToIndividualChanges(
              findAffectedActivitiesForInstallationPeriods(
                ind.id,
                ind.name,
                oldPeriods,
                newPeriods
              )
            )
          );
        }
        // De-duplicate by activityId (activity may participate multiple affected entities)
        const seenActivityIds = new Set<string>();
        const dedupedActivities = affectedActivities.filter((aa) => {
          if (seenActivityIds.has(aa.activityId)) return false;
          seenActivityIds.add(aa.activityId);
          return true;
        });

        // Auto-apply any silent component trims without a warning (only if no other items affected)
        if (silentCompTrims.length > 0 && affectedComps.length === 0 && affectedInstalls.length === 0 && dedupedActivities.length === 0) {
          // All affected items are trivial — apply silently
          updateDataset((d: Model) => {
            saveIndividualToModel(d, next);
            for (const sc of silentCompTrims) {
              const comp = d.individuals.get(sc.id);
              if (comp && sc.toBeginning !== undefined && sc.toEnding !== undefined) {
                d.addIndividual({ ...comp, beginning: sc.toBeginning, ending: sc.toEnding });
              }
            }
            // Also bump installations whose start matched 0
            const silentCompIds = new Set(silentCompTrims.map((c) => c.id));
            for (const ind of Array.from(d.individuals.values())) {
              const periods = getInstallationPeriods(ind);
              let changed = false;
              const updated = periods.map((p) => {
                if (!silentCompIds.has(p.systemComponentId)) return p;
                const cStart = Math.max(p.beginning, newStart);
                const cEnd = Math.min(p.ending, newEnd);
                if (cEnd <= cStart) { changed = true; return null; }
                if (cStart !== p.beginning || cEnd !== p.ending) {
                  changed = true;
                  return { ...p, beginning: cStart, ending: cEnd };
                }
                return p;
              }).filter((p): p is InstallationPeriod => !!p);
              if (changed) {
                saveIndividualToModel(d, syncLegacyInstallationFields({
                  ...ind,
                  installedIn: undefined,
                  installedBeginning: undefined,
                  installedEnding: undefined,
                  installations: updated,
                }));
              }
            }
          });
          handleClose();
          return;
        }

        // Include silent trims in the warning if we still have non-trivial items
        if (silentCompTrims.length > 0 && affectedComps.length === 0) {
          affectedComps.push(...silentCompTrims);
        }

        if (affectedComps.length > 0 || affectedInstalls.length > 0 || dedupedActivities.length > 0) {
          const pending = { ...next };
          setCascadeWarning({
            entityName: next.name,
            affectedComponents: affectedComps,
            affectedComponentOfSystems: [],
            affectedInstallations: affectedInstalls,
            affectedActivities: annotateActivityOutcomes(dedupedActivities),
            pendingIndividual: pending,
            applyTrim: () => {
              // Do everything in one atomic updateDataset call
              updateDataset((d: Model) => {
                // Save the system itself
                saveIndividualToModel(d, pending);

                // Trim or drop affected components
                for (const ac of affectedComps) {
                  const comp = d.individuals.get(ac.id);
                  if (!comp) continue;
                  if (ac.action === "trim" && ac.toBeginning !== undefined && ac.toEnding !== undefined) {
                    // Update bounds directly — do NOT call syncLegacyInstallationFields
                    // because it would wipe `installedIn` (the parent system reference).
                    d.addIndividual({
                      ...comp,
                      beginning: ac.toBeginning,
                      ending: ac.toEnding,
                    });
                  }
                  if (ac.action === "drop") {
                    d.individuals.delete(ac.id);
                  }
                }

                // Trim affected installations on the individuals that own them
                const installsByIndividual = new Map<string, AffectedInstallation[]>();
                for (const ai of affectedInstalls) {
                  const list = installsByIndividual.get(ai.individualId) ?? [];
                  list.push(ai);
                  installsByIndividual.set(ai.individualId, list);
                }

                Array.from(installsByIndividual.entries()).forEach(([indId, affectedPeriods]) => {
                  const ind = d.individuals.get(indId);
                  if (!ind) return;
                  const droppedCompIds = new Set(
                    affectedComps.filter((c) => c.action === "drop").map((c) => c.id)
                  );
                  let periods = getInstallationPeriods(ind)
                    // Remove periods for dropped components
                    .filter((p) => !droppedCompIds.has(p.systemComponentId));

                  periods = periods.map((p) => {
                    const match = affectedPeriods.find((a: AffectedInstallation) => a.periodId === p.id);
                    if (match && match.action === "trim" && match.toBeginning !== undefined && match.toEnding !== undefined) {
                      return { ...p, beginning: match.toBeginning, ending: match.toEnding };
                    }
                    // Drop periods that would be removed
                    if (match && match.action === "drop") return null;
                    return p;
                  }).filter((p): p is InstallationPeriod => !!p);

                  saveIndividualToModelWithoutReconcile(d, syncLegacyInstallationFields({
                    ...ind,
                    installedIn: undefined,
                    installedBeginning: undefined,
                    installedEnding: undefined,
                    installations: periods,
                  }));
                });

                applyAffectedActivityChanges(
                  d,
                  dedupedActivities.filter(
                    (affectedActivity) =>
                      !(
                        affectedActivity.action === "drop" &&
                        affectedActivity.keepStrategy === "return-to-individual"
                      )
                  )
                );

                Array.from(installsByIndividual.keys()).forEach((indId) => {
                  const ind = d.individuals.get(indId);
                  if (ind) {
                    d.reconcileParticipationsForInstallations(ind);
                  }
                });

                return d;
              });

              setShowCascadeWarningModal(false);
              setCascadeWarning(null);
              handleClose();
            },
            applyRemove: () => {
              updateDataset((d: Model) => {
                // Save the system itself
                saveIndividualToModel(d, pending);

                // Remove dropped components entirely
                const droppedCompIds = new Set(
                  affectedComps.filter((c) => c.action === "drop").map((c) => c.id)
                );
                Array.from(droppedCompIds).forEach((compId) => {
                  d.individuals.delete(compId);
                });

                // Remove ALL affected installations (both trimmed and dropped)
                const installsToRemove = new Set(affectedInstalls.map((ai) => ai.periodId));

                // Also any installations referencing dropped components
                for (const ind of Array.from(d.individuals.values())) {
                  const periods = getInstallationPeriods(ind);
                  const hasAffected = periods.some(
                    (p) => installsToRemove.has(p.id) || droppedCompIds.has(p.systemComponentId)
                  );
                  if (hasAffected) {
                    const kept = periods.filter(
                      (p) => !installsToRemove.has(p.id) && !droppedCompIds.has(p.systemComponentId)
                    );
                    saveIndividualToModelWithoutReconcile(d, syncLegacyInstallationFields({
                      ...ind,
                      installedIn: undefined,
                      installedBeginning: undefined,
                      installedEnding: undefined,
                      installations: kept,
                    }));
                  }
                }

                applyAffectedActivityChanges(
                  d,
                  dedupedActivities.filter(
                    (affectedActivity) =>
                      !(
                        affectedActivity.action === "drop" &&
                        affectedActivity.keepStrategy === "return-to-individual"
                      )
                  )
                );

                Array.from(d.individuals.values()).forEach((ind) => {
                  if (getInstallationPeriods(ind).length > 0) {
                    d.reconcileParticipationsForInstallations(ind);
                  }
                });

                return d;
              });

              setShowCascadeWarningModal(false);
              setCascadeWarning(null);
              handleClose();
            },
          });
          setShowCascadeWarningModal(true);
          return;
        }
      }

      if (
        selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
        isEditMode
      ) {
        // Compute effective bounds: intersection of component bounds and parent system bounds
        let effectiveStart = newStart;
        let effectiveEnd = newEnd;
        if (next.installedIn) {
          const parentSystem = dataset.individuals.get(next.installedIn);
          if (parentSystem && getEntityTypeIdFromIndividual(parentSystem) === ENTITY_TYPE_IDS.SYSTEM) {
            effectiveStart = Math.max(effectiveStart, normalizeStart(parentSystem.beginning));
            effectiveEnd = Math.min(effectiveEnd, normalizeEnd(parentSystem.ending));
          }
        }

        const affectedInstalls: AffectedInstallation[] = [];

        // Find all installations across all individuals that reference this component
        for (const ind of Array.from(dataset.individuals.values())) {
          const periods = getInstallationPeriods(ind);
          for (const p of periods) {
            if (p.systemComponentId === next.id) {
              const pStart = Math.max(p.beginning, effectiveStart);
              const pEnd = Math.min(p.ending, effectiveEnd);

              // Preserve raw values when normalized value didn't change
              const rawPStart = pStart === p.beginning ? p.beginning : pStart;
              const rawPEnd = pEnd === p.ending ? p.ending : pEnd;

              if (pEnd <= pStart) {
                affectedInstalls.push({
                  periodId: p.id,
                  individualId: ind.id,
                  individualName: ind.name,
                  systemComponentId: next.id,
                  systemComponentName: next.name,
                  fromBeginning: p.beginning,
                  fromEnding: p.ending,
                  action: "drop",
                });
              } else if (pStart !== p.beginning || pEnd !== p.ending) {
                affectedInstalls.push({
                  periodId: p.id,
                  individualId: ind.id,
                  individualName: ind.name,
                  systemComponentId: next.id,
                  systemComponentName: next.name,
                  fromBeginning: p.beginning,
                  fromEnding: p.ending,
                  toBeginning: rawPStart,
                  toEnding: rawPEnd,
                  action: "trim",
                });
              }
            }
          }
        }

        // Check activities that participate the system component
        const existingComp = dataset.individuals.get(next.id);
        let oldEffStart = existingComp ? normalizeStart(existingComp.beginning) : effectiveStart;
        let oldEffEnd = existingComp ? normalizeEnd(existingComp.ending) : effectiveEnd;
        let parentSystemName = undefined;
        if (existingComp?.installedIn) {
          const parentSystem = dataset.individuals.get(existingComp.installedIn);
          if (parentSystem && getEntityTypeIdFromIndividual(parentSystem) === ENTITY_TYPE_IDS.SYSTEM) {
            oldEffStart = Math.max(oldEffStart, normalizeStart(parentSystem.beginning));
            oldEffEnd = Math.min(oldEffEnd, normalizeEnd(parentSystem.ending));
            parentSystemName = parentSystem.name;
          }
        }
        if (!parentSystemName && next.installedIn) {
          const newSys = dataset.individuals.get(next.installedIn);
          if (newSys && getEntityTypeIdFromIndividual(newSys) === ENTITY_TYPE_IDS.SYSTEM) {
            parentSystemName = newSys.name;
          }
        }

        const compAffectedActivities: AffectedActivity[] = [];
        compAffectedActivities.push(...findAffectedActivities(next.id, next.name, effectiveStart, effectiveEnd, oldEffStart, oldEffEnd).map(a => ({...a, systemName: parentSystemName})));

        const componentBoundsById = new Map<string, { beginning: number; ending: number; dropped: boolean }>([
          [
            next.id,
            {
              beginning: effectiveStart,
              ending: effectiveEnd,
              dropped: effectiveEnd <= effectiveStart,
            },
          ],
        ]);

        // Also check activities for individuals installed in this component
        for (const ind of Array.from(dataset.individuals.values())) {
          const oldPeriods = getInstallationPeriods(ind);
          const isInstalledInComp = oldPeriods.some((p) => p.systemComponentId === next.id);
          if (!isInstalledInComp) continue;
          const newPeriods = applyInstallationBoundsToPeriods(
            oldPeriods,
            componentBoundsById
          );

          compAffectedActivities.push(
            ...markReturnToIndividualChanges(
              findAffectedActivitiesForInstallationPeriods(
                ind.id,
                ind.name,
                oldPeriods,
                newPeriods
              )
            )
          );
        }

        // De-duplicate by activityId+participationKey
        const seenCompActKeys = new Set<string>();
        const dedupedCompActivities = compAffectedActivities.filter((aa) => {
          const key = aa.activityId + ":" + (aa.participationKey ?? aa.individualId);
          if (seenCompActKeys.has(key)) return false;
          seenCompActKeys.add(key);
          return true;
        });

        if (affectedInstalls.length > 0 || dedupedCompActivities.length > 0) {
          const pending = { ...next };

          setCascadeWarning({
            entityName: next.name,
            affectedComponents: [],
            affectedComponentOfSystems: [],
            affectedInstallations: affectedInstalls,
            affectedActivities: annotateActivityOutcomes(dedupedCompActivities),
            pendingIndividual: pending,
            applyTrim: () => {
              updateDataset((d: Model) => {
                // Save the system component itself
                saveIndividualToModel(d, pending);

                // Trim affected installations
                const installsByIndividual = new Map<string, AffectedInstallation[]>();
                for (const ai of affectedInstalls) {
                  const list = installsByIndividual.get(ai.individualId) ?? [];
                  list.push(ai);
                  installsByIndividual.set(ai.individualId, list);
                }

                Array.from(installsByIndividual.entries()).forEach(([indId, affectedPeriods]) => {
                  const ind = d.individuals.get(indId);
                  if (!ind) return;
                  const periods = getInstallationPeriods(ind)
                    .map((p) => {
                      const match = affectedPeriods.find((a: AffectedInstallation) => a.periodId === p.id);
                      if (match && match.action === "trim" && match.toBeginning !== undefined && match.toEnding !== undefined) {
                        return { ...p, beginning: match.toBeginning, ending: match.toEnding };
                      }
                      if (match && match.action === "drop") return null;
                      return p;
                    })
                    .filter((p): p is InstallationPeriod => !!p);
                  saveIndividualToModelWithoutReconcile(d, syncLegacyInstallationFields({
                    ...ind,
                    installedIn: undefined,
                    installedBeginning: undefined,
                    installedEnding: undefined,
                    installations: periods,
                  }));
                });

                applyAffectedActivityChanges(
                  d,
                  dedupedCompActivities.filter(
                    (affectedActivity) =>
                      !(
                        affectedActivity.action === "drop" &&
                        affectedActivity.keepStrategy === "return-to-individual"
                      )
                  )
                );

                Array.from(installsByIndividual.keys()).forEach((indId) => {
                  const ind = d.individuals.get(indId);
                  if (ind) {
                    d.reconcileParticipationsForInstallations(ind);
                  }
                });

                return d;
              });

              setShowCascadeWarningModal(false);
              setCascadeWarning(null);
              handleClose();
            },
            applyRemove: () => {
              updateDataset((d: Model) => {
                // Save the system component itself
                saveIndividualToModel(d, pending);

                // Remove all affected installations
                const installsToRemove = new Set(affectedInstalls.map((ai) => ai.periodId));
                for (const ind of Array.from(d.individuals.values())) {
                  const periods = getInstallationPeriods(ind);
                  const hasAffected = periods.some((p) => installsToRemove.has(p.id));
                  if (hasAffected) {
                    const kept = periods.filter((p) => !installsToRemove.has(p.id));
                    saveIndividualToModelWithoutReconcile(d, syncLegacyInstallationFields({
                      ...ind,
                      installedIn: undefined,
                      installedBeginning: undefined,
                      installedEnding: undefined,
                      installations: kept,
                    }));
                  }
                }

                applyAffectedActivityChanges(
                  d,
                  dedupedCompActivities.filter(
                    (affectedActivity) =>
                      !(
                        affectedActivity.action === "drop" &&
                        affectedActivity.keepStrategy === "return-to-individual"
                      )
                  )
                );

                Array.from(d.individuals.values()).forEach((ind) => {
                  if (getInstallationPeriods(ind).length > 0) {
                    d.reconcileParticipationsForInstallations(ind);
                  }
                });

                return d;
              });

              setShowCascadeWarningModal(false);
              setCascadeWarning(null);
              handleClose();
            },
          });
          setShowCascadeWarningModal(true);
          return;
        }
      }
    }

    commitIndividualSave(next);
  };

  const confirmBoundsAdjustment = () => {
    if (!pendingSaveIndividual) {
      setShowBoundsWarningModal(false);
      return;
    }
    const selectedAffectedActivities = pendingAffectedActivities.filter((aa) =>
      selectedAffectedActivityKeys.has(getAffectedActivitySelectionKey(aa))
    );
    // Always apply auto-removable entries (participations whose installation
    // was removed but the individual still participates via another)
    const allToApply = [
      ...pendingAutoRemoveActivities,
      ...(pendingActivityAction === "remove" ? selectedAffectedActivities : []),
    ];
    if (allToApply.length > 0) {
      updateDataset((d: Model) => {
        saveIndividualToModel(d, pendingSaveIndividual);
        applyAffectedActivityChanges(d, allToApply);
      });
      handleClose();
    } else {
      commitIndividualSave(pendingSaveIndividual);
    }
  };

  const confirmBoundsDeleteAffected = () => {
    if (!pendingRemoveIndividual) {
      setShowBoundsWarningModal(false);
      return;
    }
    const selectedAffectedActivities = pendingAffectedActivities.filter((aa) =>
      selectedAffectedActivityKeys.has(getAffectedActivitySelectionKey(aa))
    );
    // Always include auto-removable entries alongside user-selected ones
    const allToApply = [
      ...pendingAutoRemoveActivities,
      ...(pendingActivityAction === "remove" ? selectedAffectedActivities : []),
    ];
    if (allToApply.length > 0) {
      updateDataset((d: Model) => {
        saveIndividualToModel(d, pendingRemoveIndividual);
        const affectedActivityIds = new Set<string>();
        for (const aa of allToApply) {
          const act = d.activities.get(aa.activityId);
          if (act) {
            const pKey = resolveCurrentAffectedParticipationKey(act, aa);
            act.participations.delete(pKey);
          }
          affectedActivityIds.add(aa.activityId);
        }
        shrinkActivitiesToRemainingParticipants(d, affectedActivityIds);
      });
      handleClose();
    } else {
      commitIndividualSave(pendingRemoveIndividual);
    }
  };

  const handleDelete = () => {
    setPendingActivityAction("keep");
    setSelectedAffectedActivityKeys(new Set());
    setCascadeWarning(buildDeleteCascadeWarning(inputs));
    setShowCascadeWarningModal(true);
  };

  const confirmCascadeDelete = () => {
    if (!cascadeWarning) {
      return;
    }

    if (cascadeWarning.mode !== "delete") {
      cascadeWarning.applyRemove();
      return;
    }

    const selectedOptionalActivities = cascadeWarning.affectedActivities.filter(
      (affectedActivity) =>
        affectedActivity.deleteChoice === "optional" &&
        selectedAffectedActivityKeys.has(getAffectedActivitySelectionKey(affectedActivity))
    );
    const keptOptionalActivities = cascadeWarning.affectedActivities.filter(
      (affectedActivity) =>
        affectedActivity.deleteChoice === "optional" &&
        !selectedAffectedActivityKeys.has(getAffectedActivitySelectionKey(affectedActivity))
    );

    updateDataset((d: Model) => {
      d.removeIndividual(cascadeWarning.pendingIndividual.id);

      if (pendingActivityAction === "remove" && selectedOptionalActivities.length > 0) {
        const affectedActivityIds = new Set<string>();

        selectedOptionalActivities.forEach((affectedActivity) => {
          const activity = d.activities.get(affectedActivity.activityId);
          if (!activity) return;
          const pKey = resolveCurrentAffectedParticipationKey(activity, affectedActivity);
          activity.participations.delete(pKey);
          affectedActivityIds.add(affectedActivity.activityId);
        });

        shrinkActivitiesToRemainingParticipants(d, affectedActivityIds);
      }
    });

    setShowCascadeWarningModal(false);
    setCascadeWarning(null);
    setPendingActivityAction("keep");
    setSelectedAffectedActivityKeys(new Set());
    handleClose();
  };

  const openInstallationsModal = () => {
    const rows = getInstallationPeriods(inputs).map((period) => ({
      id: period.id,
      systemComponentId: period.systemComponentId,
      beginningText: String(period.beginning),
      endingText: period.ending >= Model.END_OF_TIME ? "" : String(period.ending),
    }));
    setInstallationRows(
      rows.length > 0
        ? rows
        : [
            {
              id: uuidv4(),
              systemComponentId: "",
              beginningText: "0",
              endingText: "",
            },
          ]
    );
    setInstallationErrors([]);
    setShowInstallationsModal(true);
  };

  const addInstallationRow = () => {
    setInstallationRows((previous) => [
      ...previous,
      {
        id: uuidv4(),
        systemComponentId: "",
        beginningText: "0",
        endingText: "",
      },
    ]);
  };

  const removeInstallationRow = (rowId: string) => {
    setInstallationRows((previous) => {
      const nextRows = previous.filter((row) => row.id !== rowId);
      if (nextRows.length === 0) {
        setInstallationErrors([]);
      } else {
        const { rowErrors } = normalizeInstallationRows(nextRows);
        setInstallationErrors(rowErrors);
      }
      return nextRows;
    });
  };

  const updateInstallationRow = (
    rowId: string,
    key: keyof InstallationRow,
    value: string
  ) => {
    setInstallationRows((previous) =>
      previous.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  };

  const normalizeInstallationRows = (rows: InstallationRow[]) => {
    const rowErrors: string[] = [];
    const normalized: NormalizedInstallationRow[] = [];

    rows.forEach((row, index) => {
      const rowPrefix = `Row ${index + 1}`;

      if (!row.systemComponentId) {
        rowErrors.push(`${rowPrefix}: System Component is required`);
        return;
      }

      const component = dataset.individuals.get(row.systemComponentId);
      if (
        !component ||
        getEntityTypeIdFromIndividual(component) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT
      ) {
        rowErrors.push(`${rowPrefix}: Selected System Component is invalid`);
        return;
      }

      if (row.beginningText.trim() === "") {
        rowErrors.push(`${rowPrefix}: Beginning is required`);
        return;
      }

      const beginning = Math.trunc(Number(row.beginningText));

      let ending =
        row.endingText.trim() === ""
          ? Model.END_OF_TIME
          : Math.trunc(Number(row.endingText));
      if (ending <= 0) ending = Model.END_OF_TIME;

      if (!Number.isFinite(beginning) || beginning < 0) {
        rowErrors.push(`${rowPrefix}: Beginning must be 0 or greater`);
        return;
      }

      if (!Number.isFinite(ending) || ending <= beginning) {
        rowErrors.push(`${rowPrefix}: Ending must be after Beginning`);
        return;
      }

      const logicalComponentStart =
        component.beginning === -1 ? -Infinity : component.beginning;
      const logicalComponentEnd =
        component.ending >= Model.END_OF_TIME ? Infinity : component.ending;
      const logicalBeginning = beginning;
      const logicalEnding = ending >= Model.END_OF_TIME ? Infinity : ending;

      if (logicalBeginning < logicalComponentStart) {
        rowErrors.push(
          `${rowPrefix}: Beginning must be within ${component.name} bounds`
        );
      }
      if (logicalEnding > logicalComponentEnd) {
        rowErrors.push(`${rowPrefix}: Ending must be within ${component.name} bounds`);
      }

      const logicalOwnStart = inputs.beginning === -1 ? -Infinity : inputs.beginning;
      const logicalOwnEnd = inputs.ending >= Model.END_OF_TIME ? Infinity : inputs.ending;
      
      if (logicalBeginning < logicalOwnStart) {
        rowErrors.push(`${rowPrefix}: Beginning must be within entity bounds`);
      }
      if (logicalEnding > logicalOwnEnd) {
        rowErrors.push(`${rowPrefix}: Ending must be within entity bounds`);
      }

      normalized.push({
        id: row.id,
        systemComponentId: row.systemComponentId,
        beginning,
        ending,
      });
    });

    for (let first = 0; first < normalized.length; first += 1) {
      for (let second = first + 1; second < normalized.length; second += 1) {
        const a = normalized[first];
        const b = normalized[second];
        if (a.systemComponentId !== b.systemComponentId) continue;

        const overlap = a.beginning < b.ending && b.beginning < a.ending;
        if (!overlap) continue;

        rowErrors.push(
          `Rows ${first + 1} and ${second + 1} overlap within the same system component`
        );
      }
    }

    normalized.forEach((candidate, index) => {
      const overlappingOther = Array.from(dataset.individuals.values())
        .filter((other) => other.id !== inputs.id)
        .some((other) =>
          getInstallationPeriods(other).some((period) => {
            if (period.systemComponentId !== candidate.systemComponentId) {
              return false;
            }
            return (
              candidate.beginning < period.ending &&
              period.beginning < candidate.ending
            );
          })
        );

      if (overlappingOther) {
        rowErrors.push(
          `Row ${index + 1} overlaps another individual in the same system component slot`
        );
      }
    });

    return { normalized, rowErrors };
  };

  useEffect(() => {
    if (!showInstallationsModal) return;
    const { rowErrors } = normalizeInstallationRows(installationRows);
    setInstallationErrors(rowErrors);
  }, [installationRows, showInstallationsModal]);

  const saveInstallations = () => {
    if (installationRows.length === 0) {
      const synced = syncLegacyInstallationFields({
        ...inputs,
        installedIn: undefined,
        installedBeginning: undefined,
        installedEnding: undefined,
        installations: [],
      });

      setInputs(synced);
      setDirty(true);
      setShowInstallationsModal(false);
      setInstallationErrors([]);
      return;
    }

    const { normalized, rowErrors } = normalizeInstallationRows(installationRows);
    if (rowErrors.length > 0) {
      setInstallationErrors(rowErrors);
      return;
    }

    const nextInstallations: InstallationPeriod[] = normalized
      .sort((first, second) => first.beginning - second.beginning)
      .map((row) => ({
        id: row.id,
        systemComponentId: row.systemComponentId,
        beginning: row.beginning,
        ending: row.ending,
      }));

    const synced = syncLegacyInstallationFields({
      ...inputs,
      // Clear legacy fields so getInstallationPeriods inside sync
      // uses only the explicit installations array, not stale legacy values.
      installedIn: undefined,
      installedBeginning: undefined,
      installedEnding: undefined,
      installations: nextInstallations,
    });

    setInputs(synced);
    setDirty(true);
    setShowInstallationsModal(false);
    setInstallationErrors([]);
  };

  const getAvailabilityForRow = (row: InstallationRow) => {
    if (!row.systemComponentId) return null;

    const component = dataset.individuals.get(row.systemComponentId);
    if (!component) return null;

    const start = normalizeStart(component.beginning);
    const end = normalizeEnd(component.ending);

    const occupied = installationRows
      .filter((entry) => entry.id !== row.id)
      .map((entry) => {
        if (!entry.systemComponentId) return undefined;

        const isSameSlot = entry.systemComponentId === row.systemComponentId;

        if (!isSameSlot) {
          return undefined;
        }

        const from = Math.trunc(Number(entry.beginningText));
        const until =
          entry.endingText.trim() === ""
            ? Model.END_OF_TIME
            : Math.trunc(Number(entry.endingText));

        if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) {
          return undefined;
        }

        return { from, until };
      })
      .filter(
        (value): value is { from: number; until: number } =>
          !!value && value.until > start && value.from < end
      )
      .map((value) => ({
        from: Math.max(start, value.from),
        until: Math.min(end, value.until),
      }));

    const occupiedByDataset = Array.from(dataset.individuals.values())
      .filter((other) => other.id !== inputs.id)
      .flatMap((other) =>
        getInstallationPeriods(other)
          .map((period) => {
            if (period.systemComponentId !== row.systemComponentId) {
              return undefined;
            }
            return {
              from: Math.max(start, period.beginning),
              until: Math.min(end, period.ending),
            };
          })
          .filter(
            (value): value is { from: number; until: number } =>
              !!value && value.until > value.from
          )
      );

    const combinedOccupied = [...occupied, ...occupiedByDataset]
      .sort((first, second) => first.from - second.from);

    const merged: Array<{ from: number; until: number }> = [];
    combinedOccupied.forEach((slot) => {
      const previous = merged[merged.length - 1];
      if (!previous || slot.from > previous.until) {
        merged.push({ ...slot });
        return;
      }
      previous.until = Math.max(previous.until, slot.until);
    });

    const available: Array<{ from: number; until: number }> = [];
    let cursor = start;
    merged.forEach((slot) => {
      if (slot.from > cursor) {
        available.push({ from: cursor, until: slot.from });
      }
      cursor = Math.max(cursor, slot.until);
    });
    if (cursor < end) {
      available.push({ from: cursor, until: end });
    }

    const formatIntervals = (intervals: Array<{ from: number; until: number }>) =>
      intervals.length === 0
        ? "None"
        : intervals
            .map((interval) =>
              interval.until >= Model.END_OF_TIME
                ? `${interval.from}-∞`
                : `${interval.from}-${interval.until}`
            )
            .join(", ");

    return {
      occupied: formatIntervals(merged),
      available: formatIntervals(available),
    };
  };

  const hasPendingPeriodTrimAction = pendingBoundsChanges.some(
    (change) => change.action === "trim"
  );
  const hasPendingPeriodDropAction = pendingBoundsChanges.some(
    (change) => change.action === "drop"
  );
  const hasPendingActivityEffects = pendingAffectedActivities.length > 0;
  const hasSelectedAffectedActivities = selectedAffectedActivityKeys.size > 0;
  const canApplyBoundsAction =
    pendingActivityAction !== "remove" ||
    !hasPendingActivityEffects ||
    hasSelectedAffectedActivities;
  const primaryBoundsActionLabel =
    pendingActivityAction === "keep"
      ? "Apply Changes (Keep Activities)"
      : hasPendingPeriodTrimAction
      ? "Resolve Affected Periods"
      : "Apply Selected Activity Changes";
  const dangerBoundsActionLabel = hasPendingPeriodDropAction
    ? pendingActivityAction === "remove"
      ? "Delete Affected Periods + Selected Activities"
      : "Delete Affected Periods"
    : "Remove Selected Activities";
  const showDangerBoundsAction =
    hasPendingPeriodDropAction || pendingActivityAction === "remove";
  const canUseDangerBoundsAction = hasPendingPeriodDropAction
    ? canApplyBoundsAction
    : pendingActivityAction === "remove" && hasSelectedAffectedActivities;
  const boundsWarningLeadText =
    pendingChangeScope === "installations"
      ? "Changing the installation periods for"
      : pendingChangeScope === "both"
      ? "Changing the bounds or installation periods for"
      : "Changing the bounds of";
  const cascadeHasTrimAction =
    !!cascadeWarning &&
    (
      cascadeWarning.affectedComponents.some((item) => item.action === "trim") ||
      cascadeWarning.affectedInstallations.some((item) => item.action === "trim") ||
      cascadeWarning.affectedActivities.some((item) => item.action === "trim")
    );
  const cascadeHasDropAction =
    !!cascadeWarning &&
    (
      cascadeWarning.affectedComponents.some((item) => item.action === "drop") ||
      cascadeWarning.affectedComponentOfSystems.some((item) => item.action === "drop") ||
      cascadeWarning.affectedInstallations.some((item) => item.action === "drop") ||
      cascadeWarning.affectedActivities.some((item) => item.action === "drop")
    );
  const cascadeOptionalActivities = cascadeWarning?.affectedActivities.filter(
    (item) => item.deleteChoice === "optional"
  ) ?? [];
  const cascadeHasOptionalActivities =
    cascadeWarning?.mode === "delete" && cascadeOptionalActivities.length > 0;
  const isOptionalDeleteActivitySelected = (affectedActivity: AffectedActivity) =>
    affectedActivity.deleteChoice === "optional" &&
    selectedAffectedActivityKeys.has(getAffectedActivitySelectionKey(affectedActivity));
  const cascadeDeleteButtonLabel =
    cascadeWarning?.mode === "delete"
      ? pendingActivityAction === "remove" && selectedAffectedActivityKeys.size > 0
        ? `${cascadeWarning.removeButtonLabel ?? "Delete Entity"} + Remove Selected Activities`
        : `${cascadeWarning.removeButtonLabel ?? "Delete Entity"} (Keep Activities)`
      : cascadeWarning?.removeButtonLabel ?? "Delete All Affected Periods";
  const cascadeCanRemove = !!cascadeWarning && (cascadeWarning.mode === "delete" || cascadeHasDropAction);

  return (
    <>
      {showTrigger ? (
        <Button variant={triggerVariant} onClick={() => setShow(true)} className={triggerClassName}>
          Add Entity
        </Button>
      ) : null}

      <Modal dialogAs={DraggableModalDialog} 
        show={
          show &&
          !showInstallationsModal &&
          !showBoundsWarningModal &&
          !showCascadeWarningModal
        }
        onHide={handleModalHide}
      >
        <Modal.Header closeButton>
          <Modal.Title>{isEditMode ? "Edit Entity" : "Add Entity"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSave}>
            <Form.Group className="mb-3" controlId="formEntityCategory">
              <Form.Label>Entity Type</Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {ENTITY_TYPE_OPTIONS.map((option) => {
                  const selected = selectedEntityTypeId === option.id;
                  const disabled = isEditMode && !selected;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={selected ? "primary" : "outline-secondary"}
                      disabled={disabled}
                      onClick={() => handleEntityType(option.id)}
                    >
                      {option.glyph} {option.label}
                    </Button>
                  );
                })}
              </div>
            </Form.Group>

            <Form.Group className="mb-3" controlId="formEntityName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={inputs.name}
                onChange={handleChangeText}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formEntityType">
              <Form.Label>Type</Form.Label>
              <div
                ref={typeDropdownRef}
                className="position-relative"
                style={{ zIndex: 1050 }}
              >
                <button
                  type="button"
                  className="w-100 btn btn-outline-secondary d-flex justify-content-between align-items-center"
                  onClick={() => setTypeOpen((s) => !s)}
                >
                  <span className="text-truncate">
                    {inputs?.type?.name || "Select type..."}
                  </span>
                  <span style={{ marginLeft: 8 }}>▾</span>
                </button>

                {typeOpen && (
                  <div
                    className="card mt-1 themed-selector-menu"
                    style={{ maxHeight: 300, overflow: "hidden" }}
                  >
                    <div className="card-body p-2 border-bottom">
                      <input
                        className="form-control form-control-sm"
                        placeholder="Search or create type..."
                        value={typeSearch}
                        onChange={(e) => setTypeSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && showCreateTypeOption) {
                            e.preventDefault();
                            handleCreateTypeFromSearch();
                            return;
                          }
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            moveHighlight(1);
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            moveHighlight(-1);
                            return;
                          }
                          if (e.key === "Escape") {
                            setTypeOpen(false);
                            return;
                          }
                          if (e.key === "Enter" && filteredTypes.length > 0 && !showCreateTypeOption) {
                            e.preventDefault();
                            selectHighlighted();
                            return;
                          }
                        }}
                        autoFocus
                      />
                    </div>

                    <div style={{ maxHeight: 180, overflow: "auto" }}>
                      {filteredTypes.map((t, idx) => (
                        <div
                          key={t.id}
                          ref={(el) => {
                            if (itemRefs.current) itemRefs.current[idx] = el;
                          }}
                          tabIndex={-1}
                          className={`themed-selector-item d-flex align-items-center justify-content-between px-3 py-2 ${
                            highlightedIndex === idx
                              ? "bg-primary text-white"
                              : ""
                          }`}
                          style={{ cursor: "pointer" }}
                          onClick={() => handleSelectType(t.id)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") selectHighlighted();
                            if (e.key === "Escape") setTypeOpen(false);
                          }}
                        >
                          {editingTypeId === t.id ? (
                            <div className="d-flex align-items-center w-100">
                              <input
                                className="form-control form-control-sm me-2"
                                value={editingTypeValue}
                                onChange={(e) =>
                                  setEditingTypeValue(e.target.value)
                                }
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditType();
                                  if (e.key === "Escape") cancelEditType();
                                  e.stopPropagation(); // prevent parent from handling
                                }}
                                autoFocus
                              />
                              <div className="d-flex align-items-center">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success me-1"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    saveEditType();
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    cancelEditType();
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-grow-1">{t.name}</div>
                              <div className="d-flex align-items-center">
                                {inputs?.type?.id === t.id && (
                                  <span className="me-2">✓</span>
                                )}
                                <button
                                  type="button"
                                  className={`btn btn-sm btn-link p-0 ${
                                    highlightedIndex === idx
                                      ? "text-white"
                                      : ""
                                  }`}
                                  onClick={(e) =>
                                    startEditType(t.id, t.name, e)
                                  }
                                >
                                  edit
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {showCreateTypeOption && (
                        <div
                          className="themed-selector-create px-3 py-2 text-primary fw-medium border-top"
                          style={{ cursor: "pointer" }}
                          onClick={handleCreateTypeFromSearch}
                        >
                          Create &quot;{typeSearch}&quot;
                        </div>
                      )}

                      {filteredTypes.length === 0 && !showCreateTypeOption && (
                        <div className="themed-selector-empty p-3 small">
                          No results found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Form.Group>

            {selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM_COMPONENT && (
              <Form.Group className="mb-3" controlId="formSystemComponentParent">
                <Form.Label>Component Of System</Form.Label>
                <Form.Select
                  value={inputs.installedIn ?? ""}
                  onChange={(event) => {
                    const systemId = event.target.value || undefined;
                    setInputs((previous) => ({
                      ...previous,
                      installedIn: systemId,
                    }));
                    setDirty(true);
                  }}
                >
                  <option value="">Select system...</option>
                  {systems.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.name}
                    </option>
                  ))}
                </Form.Select>
                {systems.length === 0 && (
                  <Form.Text className="text-danger">
                    Create a System entity before adding a Component Of System.
                  </Form.Text>
                )}
                {systemComponentSlotHints && (
                  <Form.Text className="text-muted d-block mt-1">
                    System bounds: {systemComponentSlotHints.bounds} | Multiple system components can share the same slot range.
                  </Form.Text>
                )}
              </Form.Group>
            )}

            <Form.Group className="mb-3" controlId="formEntityBeginning">
              <Form.Label>Beginning</Form.Label>
              <Form.Control
                type="number"
                min="0" step="any"
                value={beginningText}
                onChange={handleBeginChange}
                disabled={
                  selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL &&
                  inputs.beginsWithParticipant
                }
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formEntityEnding">
              <Form.Label>Ending</Form.Label>
              <Form.Control
                type="number"
                min="0" step="any"
                value={endingText}
                onChange={handleEndChange}
                disabled={
                  selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL &&
                  inputs.endsWithParticipant
                }
              />
            </Form.Group>

            {selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL && (
              <>
                <Form.Group className="mb-2" controlId="formBeginWithParticipant">
                  <Form.Check
                    type="switch"
                    label="Begins With Participant"
                    checked={!!inputs.beginsWithParticipant}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      const nextBeginning = checked
                        ? dataset.earliestParticipantBeginning(inputs.id)
                        : -1;

                      setBeginningText(asInputText(nextBeginning, true));
                      setInputs((previous) => ({
                        ...previous,
                        beginsWithParticipant: checked,
                        beginning: nextBeginning,
                      }));
                      setDirty(true);
                    }}
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="formEndWithParticipant">
                  <Form.Check
                    type="switch"
                    label="Ends With Participant"
                    checked={!!inputs.endsWithParticipant}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      const nextEnding = checked
                        ? dataset.lastParticipantEnding(inputs.id)
                        : Model.END_OF_TIME;

                      setEndingText(asInputText(nextEnding, false));
                      setInputs((previous) => ({
                        ...previous,
                        endsWithParticipant: checked,
                        ending: nextEnding,
                      }));
                      setDirty(true);
                    }}
                  />
                </Form.Group>
              </>
            )}

            {isEditMode && selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL && (
              <Card className="mb-3">
                <Card.Body className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold">Installations</div>
                    <div className="text-muted">
                      {getInstallationPeriods(inputs).length === 0
                        ? "Not installed in any slot yet."
                        : `${getInstallationPeriods(inputs).length} total installation${
                            getInstallationPeriods(inputs).length > 1 ? "s" : ""
                          }`}
                    </div>
                  </div>
                  <Button variant="primary" onClick={openInstallationsModal}>
                    {getInstallationPeriods(inputs).length > 0
                      ? `Add/Edit Installation${getInstallationPeriods(inputs).length > 1 ? "s" : ""}`
                      : "Add Installation"}
                  </Button>
                </Card.Body>
              </Card>
            )}

            <Form.Group className="mb-3" controlId="formEntityDescription">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                name="description"
                value={inputs.description ?? ""}
                onChange={handleChangeText}
              />
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <div className="w-100 d-flex justify-content-between align-items-center">
            <div>
              <Button
                variant="danger"
                onClick={handleDelete}
                className={isEditMode ? "d-inline-block" : "d-none"}
              >
                Delete
              </Button>
            </div>
            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={!dirty}>
                Save
              </Button>
            </div>
          </div>

          {errors.length > 0 && (
            <Alert variant="danger" className="w-100 p-2 m-0 mt-2">
              {errors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </Alert>
          )}
        </Modal.Footer>
      </Modal>

      <Modal dialogAs={DraggableModalDialog} 
        show={showInstallationsModal}
        onHide={handleInstallationsModalHide}
        size="xl"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Add Installation for {inputs.name || "Entity"} ({inputs.beginning === -1 ? "0" : inputs.beginning} - {inputs.ending >= Model.END_OF_TIME ? "∞" : inputs.ending})
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table bordered responsive>
            <thead>
              <tr>
                <th>#</th>
                <th>System Component *</th>
                <th>From *</th>
                <th>Until</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {installationRows.map((row, index) => {
                const availability = getAvailabilityForRow(row);
                return (
                  <tr key={row.id} className="installation-row">
                    <td>{index + 1}</td>
                    <td>
                      <Form.Select
                        className={`installation-select${
                          row.systemComponentId ? " has-selection" : ""
                        }`}
                        value={row.systemComponentId}
                        onChange={(event) =>
                          updateInstallationRow(
                            row.id,
                            "systemComponentId",
                            event.target.value
                          )
                        }
                      >
                        <option value="">-- Select slot --</option>
                        {systemComponents.map((component) => {
                          const system = component.installedIn
                            ? dataset.individuals.get(component.installedIn)
                            : undefined;
                          const begin = normalizeStart(component.beginning);
                          const end = normalizeEnd(component.ending);
                          return (
                            <option key={component.id} value={component.id}>
                              {`${component.name}${
                                system ? ` (in ${system.name})` : ""
                              } (${begin}-${
                                end >= Model.END_OF_TIME ? "∞" : String(end)
                              })`}
                            </option>
                          );
                        })}
                      </Form.Select>
                      {availability && (
                        <Form.Text className="text-muted d-block mt-1">
                          Occupied: {availability.occupied} | Available: {availability.available}
                        </Form.Text>
                      )}
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        min="0" step="any"
                        value={row.beginningText}
                        onChange={(event) =>
                          updateInstallationRow(row.id, "beginningText", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        min="0" step="any"
                        placeholder="∞"
                        value={row.endingText}
                        onChange={(event) =>
                          updateInstallationRow(row.id, "endingText", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <Button
                        variant="outline-danger"
                        onClick={() => removeInstallationRow(row.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <Button variant="primary" onClick={addInstallationRow}>
            + Add Another Installation Period
          </Button>

          {installationErrors.length > 0 && (
            <Alert variant="danger" className="mt-3 mb-0">
              {installationErrors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="w-100 d-flex justify-content-between align-items-center">
            <div className="text-muted">
              {installationRows.length} total installation
              {installationRows.length === 1 ? "" : "s"}
            </div>
            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={() => setShowInstallationsModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveInstallations}>
                Save
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>

      <Modal dialogAs={DraggableModalDialog} 
        show={showBoundsWarningModal}
        onHide={() => {
          setShowBoundsWarningModal(false);
          setPendingActivityAction("keep");
          setSelectedAffectedActivityKeys(new Set());
        }}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Affected Items — {inputs.name || "Entity"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {boundsWarningLeadText} <strong>{inputs.name || "Entity"}</strong> will
            affect the following items:
          </p>
          {pendingBoundsChanges.length > 0 && (
            <div className="mb-3">
              <div className="cascade-section-title">Installation Periods</div>
              <div className="cascade-badges-wrap" style={{ maxHeight: "220px", overflowY: "auto" }}>
                {[...pendingBoundsChanges].sort((a, b) => a.fromBeginning - b.fromBeginning).map((change) => (
                  <span
                    key={change.periodId}
                    className={`cascade-badge ${change.action === "trim" ? "cascade-badge-trim" : "cascade-badge-remove"}`}
                  >
                    {change.systemComponentName}
                    {" ("}
                    {formatBound(change.fromBeginning, true)}-{formatBound(change.fromEnding, false)}
                    {change.action === "trim"
                      ? ` → ${formatBound(change.toBeginning ?? change.fromBeginning, true)}-${formatBound(change.toEnding ?? change.fromEnding, false)}`
                      : ""}
                    {")"}
                  </span>
                ))}
              </div>
            </div>
          )}
          {pendingAffectedActivities.length > 0 && (
            <div className="mb-3">
              <div className="cascade-section-title">Participation In Activities</div>
              <Form.Group className="mb-2 cascade-activity-handling" controlId="boundsActivitiesAction">
                <Form.Label className="small text-muted mb-1">
                  Activity handling
                </Form.Label>
                <div>
                  <Form.Check
                    inline
                    type="radio"
                    name="boundsActivitiesAction"
                    id="boundsActivitiesKeep"
                    label="Keep activities (default)"
                    checked={pendingActivityAction === "keep"}
                    onChange={() => setPendingActivityAction("keep")}
                  />
                  <Form.Check
                    inline
                    type="radio"
                    name="boundsActivitiesAction"
                    id="boundsActivitiesRemove"
                    label="Remove affected activities"
                    checked={pendingActivityAction === "remove"}
                    onChange={() => setPendingActivityAction("remove")}
                  />
                </div>
              </Form.Group>
              {pendingActivityAction === "remove" && (
                <div className="mb-2 d-flex align-items-center justify-content-between">
                  <div className="small text-muted">
                    Selected for removal: {selectedAffectedActivityKeys.size} of {pendingAffectedActivities.length}
                  </div>
                  <div className="d-flex gap-2">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => {
                        setSelectedAffectedActivityKeys(
                          new Set(
                            pendingAffectedActivities.map((aa) =>
                              getAffectedActivitySelectionKey(aa)
                            )
                          )
                        );
                      }}
                    >
                      Select all
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => setSelectedAffectedActivityKeys(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
              <div style={{ maxHeight: "260px", overflowY: "auto" }}>
                {(() => {
                  // Group affected activities by activityId
                  const grouped = new Map<string, { activityName: string; fromBeginning: number; fromEnding: number; entries: AffectedActivity[] }>();
                  [...pendingAffectedActivities]
                    .sort((a, b) => a.fromBeginning - b.fromBeginning)
                    .forEach((aa) => {
                      const existing = grouped.get(aa.activityId);
                      if (existing) {
                        existing.entries.push(aa);
                      } else {
                        grouped.set(aa.activityId, {
                          activityName: aa.activityName,
                          fromBeginning: aa.fromBeginning,
                          fromEnding: aa.fromEnding,
                          entries: [aa],
                        });
                      }
                    });
                  return Array.from(grouped.entries()).map(([activityId, group]) => (
                    <div key={activityId} className="cascade-activity-row">
                      <div className="cascade-activity-line">
                        <div className="cascade-activity-header">
                          {group.activityName} ({formatBound(group.fromBeginning, true)}-{formatBound(group.fromEnding, false)}):
                        </div>
                        <div className="cascade-badges-wrap">
                        {group.entries.map((aa) => {
                          const selectionKey = getAffectedActivitySelectionKey(aa);
                          const isSelectedForRemoval =
                            pendingActivityAction === "remove" &&
                            selectedAffectedActivityKeys.has(selectionKey);
                          const isSelectable = pendingActivityAction === "remove";

                          let badgeClass: string;
                          if (isSelectedForRemoval) {
                            badgeClass = "cascade-badge-remove";
                          } else if (aa.action === "drop") {
                            badgeClass = "cascade-badge-detached";
                          } else if (aa.action === "trim" && pendingActivityAction === "remove") {
                            badgeClass = "cascade-badge-trim";
                          } else {
                            badgeClass = "cascade-badge-keep";
                          }

                          const participantLabel = getAffectedActivityParticipantLabel(aa);

                          return (
                            <div key={`${aa.activityId}:${aa.participationKey ?? aa.individualId}`} className="cascade-badge-row">
                              {isSelectable && (
                                <Form.Check
                                  checked={isSelectedForRemoval}
                                  onChange={(event) => {
                                    setSelectedAffectedActivityKeys((prev) => {
                                      const next = new Set(prev);
                                      if (event.target.checked) next.add(selectionKey);
                                      else next.delete(selectionKey);
                                      return next;
                                    });
                                  }}
                                />
                              )}
                              <span className={`cascade-badge ${badgeClass}`}>
                                {participantLabel}
                              </span>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {pendingAffectedActivities.length > 0 && (
            <div className="cascade-footer-info">
              <div className="cascade-legend mb-0">
                <span className="cascade-legend-item">
                  <span className="cascade-legend-swatch cascade-legend-swatch-remove" /> Removed
                </span>
                <span className="cascade-legend-item">
                  <span className="cascade-legend-swatch cascade-legend-swatch-trim" /> Trimmed
                </span>
                <span className="cascade-legend-item">
                  <span className="cascade-legend-swatch cascade-legend-swatch-keep" /> Removed due to no overlap, participation will return to parent entity
                </span>
              </div>
            </div>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setShowBoundsWarningModal(false);
              setPendingActivityAction("keep");
              setSelectedAffectedActivityKeys(new Set());
            }}
          >
            Cancel
          </Button>
          {showDangerBoundsAction && (
            <Button
              variant="danger"
              onClick={confirmBoundsDeleteAffected}
              disabled={!canUseDangerBoundsAction}
            >
              {dangerBoundsActionLabel}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={confirmBoundsAdjustment}
            disabled={!canApplyBoundsAction}
          >
            {primaryBoundsActionLabel}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cascade warning modal for System / System Component bounds changes */}
      <Modal dialogAs={DraggableModalDialog} 
        show={showCascadeWarningModal}
        onHide={() => {
          setShowCascadeWarningModal(false);
          setCascadeWarning(null);
          setPendingActivityAction("keep");
          setSelectedAffectedActivityKeys(new Set());
        }}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Affected Items — {cascadeWarning?.entityName ?? "Entity"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {cascadeWarning?.leadText ?? "Changing the bounds of"} <strong>{cascadeWarning?.entityName}</strong>
            {cascadeWarning?.mode === "delete"
              ? " will remove it and affect the following items:"
              : " will affect the following items:"}
          </p>

          {cascadeWarning?.mode === "delete" &&
            cascadeWarning.affectedComponents.length === 0 &&
            cascadeWarning.affectedComponentOfSystems.length === 0 &&
            cascadeWarning.affectedInstallations.length === 0 &&
            cascadeWarning.affectedActivities.length === 0 && (
              <p className="text-muted small">
                No additional related items will be removed.
              </p>
            )}

          {cascadeWarning && cascadeWarning.affectedComponents.length > 0 && (
            <div className="mb-3">
              <div className="cascade-section-title">System Components</div>
              <div className="cascade-badges-wrap" style={{ maxHeight: "180px", overflowY: "auto" }}>
                {[...cascadeWarning.affectedComponents].sort((a, b) => a.fromBeginning - b.fromBeginning).map((ac) => (
                  <span
                    key={ac.id}
                    className={`cascade-badge ${ac.action === "trim" ? "cascade-badge-trim" : "cascade-badge-remove"}`}
                  >
                    {ac.name} ({formatBound(ac.fromBeginning, true)}-{formatBound(ac.fromEnding, false)}
                    {ac.action === "trim"
                      ? ` → ${formatBound(ac.toBeginning ?? ac.fromBeginning, true)}-${formatBound(ac.toEnding ?? ac.fromEnding, false)}`
                      : ""}
                    )
                  </span>
                ))}
              </div>
            </div>
          )}

          {cascadeWarning && cascadeWarning.affectedComponentOfSystems.length > 0 && (
            <div className="mb-3">
              <div className="cascade-section-title">Component Of System</div>
              <div className="cascade-badges-wrap" style={{ maxHeight: "180px", overflowY: "auto" }}>
                {[...cascadeWarning.affectedComponentOfSystems]
                  .sort((a, b) => a.fromBeginning - b.fromBeginning)
                  .map((item) => (
                    <span
                      key={`${item.componentId}:${item.systemId}:${item.fromBeginning}:${item.fromEnding}`}
                      className="cascade-badge cascade-badge-remove"
                    >
                      {item.componentName} [component of {item.systemName} ({formatBound(item.fromBeginning, true)}-{formatBound(item.fromEnding, false)})]
                    </span>
                  ))}
              </div>
            </div>
          )}

          {cascadeWarning && cascadeWarning.affectedInstallations.length > 0 && (
            <div className="mb-3">
              <div className="cascade-section-title">Installation Periods</div>
              <div className="cascade-badges-wrap" style={{ maxHeight: "220px", overflowY: "auto" }}>
                {[...cascadeWarning.affectedInstallations].sort((a, b) => a.fromBeginning - b.fromBeginning).map((ai) => (
                  <span
                    key={ai.periodId}
                    className={`cascade-badge ${ai.action === "trim" ? "cascade-badge-trim" : "cascade-badge-remove"}`}
                  >
                    {ai.individualName} [installed in {ai.systemComponentName} ({formatBound(ai.fromBeginning, true)}-{formatBound(ai.fromEnding, false)}
                    {ai.action === "trim"
                      ? ` → ${formatBound(ai.toBeginning ?? ai.fromBeginning, true)}-${formatBound(ai.toEnding ?? ai.fromEnding, false)}`
                      : ""}
                    )]
                  </span>
                ))}
              </div>
            </div>
          )}

          {cascadeWarning && cascadeWarning.affectedActivities.length > 0 && (
            <div className="mb-3">
              <div className="cascade-section-title">Participation In Activities</div>
              {cascadeHasOptionalActivities && (
                <>
                  <Form.Group className="mb-2 cascade-activity-handling" controlId="cascadeActivitiesAction">
                    <Form.Label className="small text-muted mb-1">
                      Activity handling
                    </Form.Label>
                    <div>
                      <Form.Check
                        inline
                        type="radio"
                        name="cascadeActivitiesAction"
                        id="cascadeActivitiesKeep"
                        label="Keep affected activities (default)"
                        checked={pendingActivityAction === "keep"}
                        onChange={() => setPendingActivityAction("keep")}
                      />
                      <Form.Check
                        inline
                        type="radio"
                        name="cascadeActivitiesAction"
                        id="cascadeActivitiesRemove"
                        label="Remove affected activities"
                        checked={pendingActivityAction === "remove"}
                        onChange={() => setPendingActivityAction("remove")}
                      />
                    </div>
                  </Form.Group>
                  {pendingActivityAction === "remove" && (
                    <div className="mb-2 d-flex align-items-center justify-content-between">
                      <div className="small text-muted">
                        Selected for removal: {selectedAffectedActivityKeys.size} of {cascadeOptionalActivities.length}
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => {
                            setSelectedAffectedActivityKeys(
                              new Set(
                                cascadeOptionalActivities.map((aa) =>
                                  getAffectedActivitySelectionKey(aa)
                                )
                              )
                            );
                          }}
                        >
                          Select all
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => setSelectedAffectedActivityKeys(new Set())}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div style={{ maxHeight: "260px", overflowY: "auto" }}>
                {(() => {
                  // Group affected activities by activityId
                  const grouped = new Map<string, { activityName: string; fromBeginning: number; fromEnding: number; entries: AffectedActivity[] }>();
                  [...cascadeWarning.affectedActivities]
                    .sort((a, b) => a.fromBeginning - b.fromBeginning)
                    .forEach((aa) => {
                      const existing = grouped.get(aa.activityId);
                      if (existing) {
                        existing.entries.push(aa);
                      } else {
                        grouped.set(aa.activityId, {
                          activityName: aa.activityName,
                          fromBeginning: aa.fromBeginning,
                          fromEnding: aa.fromEnding,
                          entries: [aa],
                        });
                      }
                    });
                  return Array.from(grouped.entries()).map(([activityId, group]) => {
                    // Determine whether all entries for this activity are required-drop (entire activity removed)
                    const allRequiredDrop = group.entries.every(
                      (e) => e.deleteChoice === "required" && e.action === "drop" && e.activityOutcomeText
                    );
                    return (
                      <div key={activityId} className="cascade-activity-row">
                        <div className="cascade-activity-line">
                          <div className="cascade-activity-header">
                            {group.activityName} ({formatBound(group.fromBeginning, true)}-{formatBound(group.fromEnding, false)}):
                            {allRequiredDrop && (
                              <span className="text-danger small ms-2">— activity removed (no participants remain)</span>
                            )}
                          </div>
                          <div className="cascade-badges-wrap">
                          {group.entries.map((aa) => {
                            const selectionKey = getAffectedActivitySelectionKey(aa);
                            const isKept =
                              aa.deleteChoice === "optional" &&
                              (pendingActivityAction !== "remove" || !selectedAffectedActivityKeys.has(selectionKey));
                            const isSelectedForRemoval =
                              aa.deleteChoice === "optional" &&
                              pendingActivityAction === "remove" &&
                              selectedAffectedActivityKeys.has(selectionKey);
                            const isSelectableForRemoval =
                              aa.deleteChoice === "optional" && pendingActivityAction === "remove";

                            let badgeClass: string;
                            if (aa.deleteChoice === "required") {
                              badgeClass = aa.action === "trim" ? "cascade-badge-trim" : "cascade-badge-remove";
                            } else if (isSelectedForRemoval) {
                              badgeClass = "cascade-badge-remove";
                            } else if (isKept && aa.action === "drop") {
                              badgeClass = "cascade-badge-detached";
                            } else if (isKept) {
                              badgeClass = "cascade-badge-keep";
                            } else {
                              badgeClass = "cascade-badge-keep";
                            }

                            // Build the label
                            const participantLabel = getAffectedActivityParticipantLabel(aa);

                            return (
                              <div key={`${aa.activityId}:${aa.participationKey ?? aa.individualId}`} className="cascade-badge-row">
                                {isSelectableForRemoval && (
                                  <Form.Check
                                    checked={isSelectedForRemoval}
                                    onChange={(event) => {
                                      setSelectedAffectedActivityKeys((prev) => {
                                        const next = new Set(prev);
                                        if (event.target.checked) next.add(selectionKey);
                                        else next.delete(selectionKey);
                                        return next;
                                      });
                                    }}
                                  />
                                )}
                                <span className={`cascade-badge ${badgeClass}`}>
                                  {participantLabel}
                                </span>
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {cascadeWarning?.affectedActivities.length ? (
            <div className="cascade-footer-info">
              <div className="cascade-legend mb-0">
                <span className="cascade-legend-item">
                  <span className="cascade-legend-swatch cascade-legend-swatch-remove" /> Removed
                </span>
                <span className="cascade-legend-item">
                  <span className="cascade-legend-swatch cascade-legend-swatch-trim" /> Trimmed
                </span>
                <span className="cascade-legend-item">
                  <span className="cascade-legend-swatch cascade-legend-swatch-keep" /> Removed due to no overlap, participation will return to parent entity
                </span>
              </div>
            </div>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => {
              setShowCascadeWarningModal(false);
              setCascadeWarning(null);
              setPendingActivityAction("keep");
              setSelectedAffectedActivityKeys(new Set());
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={confirmCascadeDelete}
            disabled={!cascadeCanRemove}
          >
            {cascadeDeleteButtonLabel}
          </Button>
          {cascadeWarning?.mode !== "delete" && (
            <Button
              variant="primary"
              onClick={() => cascadeWarning?.applyTrim()}
              disabled={!cascadeHasTrimAction}
            >
              {cascadeWarning?.trimButtonLabel ?? "Resolve Affected Periods"}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SetIndividual;
