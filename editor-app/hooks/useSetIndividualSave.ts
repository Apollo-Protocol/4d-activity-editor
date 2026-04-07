import { Dispatch, SetStateAction, useState } from "react";
import { Individual, InstallationPeriod } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import {
  ENTITY_TYPE_IDS,
  getEntityTypeIdFromIndividual,
} from "@/lib/entityTypes";
import {
  getInstallationPeriods,
  normalizeEnd,
  normalizeStart,
  syncLegacyInstallationFields,
} from "@/utils/installations";
import type {
  PendingBoundsChange,
  AffectedComponent,
  AffectedInstallation,
  AffectedComponentOfSystem,
  AffectedActivity,
  CascadeWarning,
} from "@/types/setIndividualTypes";
import {
  formatBound,
  resolveCurrentAffectedParticipationKey,
  findAffectedActivities,
  findAffectedActivitiesForInstallationPeriods,
  markReturnToIndividualChanges,
  applyInstallationBoundsToPeriods,
  mergeAffectedActivities,
  annotateActivityOutcomes,
  applyAffectedActivityChanges,
  shrinkActivitiesToRemainingParticipants,
} from "@/helpers/cascadeHelpers";
import { getAffectedActivitySelectionKey } from "@/helpers/warningModalHelpers";

export interface UseSetIndividualSaveParams {
  dataset: Model;
  inputs: Individual;
  dirty: boolean;
  selectedEntityTypeId: string;
  isEditMode: boolean;
  updateDataset: Dispatch<(d: Model) => Model | void>;
  deleteIndividual: (id: string) => void;
  setIndividual: (individual: Individual) => void;
  setErrors: Dispatch<SetStateAction<string[]>>;
  onDone: () => void;
}

function saveIndividualToModel(d: Model, individual: Individual) {
  d.addIndividual(individual);
  d.reconcileParticipationsForInstallations(individual);
}

function saveIndividualToModelWithoutReconcile(d: Model, individual: Individual) {
  d.addIndividual(individual);
}

export function useSetIndividualSave(params: UseSetIndividualSaveParams) {
  const { dataset, inputs, dirty, selectedEntityTypeId, isEditMode,
    updateDataset, deleteIndividual, setIndividual, setErrors, onDone } = params;

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
const [selectedBoundsChangeIds, setSelectedBoundsChangeIds] =
  useState<Set<string>>(new Set());
const [selectedCascadeComponentIds, setSelectedCascadeComponentIds] =
  useState<Set<string>>(new Set());
const [selectedCascadeInstallationIds, setSelectedCascadeInstallationIds] =
  useState<Set<string>>(new Set());
const [pendingChangeScope, setPendingChangeScope] =
  useState<"bounds" | "installations" | "both">("bounds");

const [showCascadeWarningModal, setShowCascadeWarningModal] = useState(false);
const [cascadeWarning, setCascadeWarning] = useState<CascadeWarning | null>(null);

  const resetWarningState = () => {
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
    setSelectedBoundsChangeIds(new Set());
    setSelectedCascadeComponentIds(new Set());
    setSelectedCascadeInstallationIds(new Set());
    setPendingChangeScope("bounds");
    setShowCascadeWarningModal(false);
    setCascadeWarning(null);
  };

  const completeAndClose = () => {
    resetWarningState();
    onDone();
  };

  const commitIndividualSave = (next: Individual) => {
    setIndividual(next);
    completeAndClose();
  };

const formatIndividualBounds = (individual: Pick<Individual, "beginning" | "ending">) =>
  `${formatBound(normalizeStart(individual.beginning), true)}-${formatBound(
    normalizeEnd(individual.ending),
    false
  )}`;

const formatBoundsChangeSummary = (
  previousIndividual: Pick<Individual, "beginning" | "ending">,
  nextIndividual: Pick<Individual, "beginning" | "ending">
) => `${formatIndividualBounds(previousIndividual)} -> ${formatIndividualBounds(nextIndividual)}`;

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

    // Deleted child system components are already listed under System Components.
    // Do not repeat their parent-system installation under Installation Periods.
    if (
      ownerType === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
      deletedIds.has(installation.individualId)
    ) {
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
        dataset,
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
    annotateActivityOutcomes(dataset, mergeAffectedActivities(optionalActivities)).map(
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
      completeAndClose();
    },
  };
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

        if (ownEnd < Model.END_OF_TIME && ownEnd > parentEnd) {
          runningErrors.push(
            `System Component ending cannot be after ${parentSystem.name}`
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
    completeAndClose();
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
    const ownBoundsChanged = ownStart !== oldOwnStart || ownEnd !== oldOwnEnd;

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
        dataset,
        next.id,
        next.name,
        ownStart,
        ownEnd,
        oldOwnStart,
        oldOwnEnd
      );
      const installationAffectedActivities =
        findAffectedActivitiesForInstallationPeriods(
          dataset,
          next.id,
          next.name,
          oldPeriods,
          periods
        );
      const indAffectedActivities = mergeAffectedActivities(
        boundsAffectedActivities,
        installationAffectedActivities
      );
      const warningScope = ownBoundsChanged
        ? "bounds"
        : boundsAffectedActivities.length > 0 && installationAffectedActivities.length > 0
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
      const annotated = annotateActivityOutcomes(dataset, indAffectedActivities);
      const autoRemovable = annotated.filter((aa) => aa.autoRemove);
      const userVisible = annotated.filter((aa) => !aa.autoRemove);
      setPendingAutoRemoveActivities(autoRemovable);
      setPendingAffectedActivities(userVisible);
      setPendingActivityAction("keep");
      setSelectedAffectedActivityKeys(new Set());
      setSelectedBoundsChangeIds(new Set());
      setPendingChangeScope(warningScope);
      setShowBoundsWarningModal(true);
      return;
    }

    const installationAffectedActivities =
      findAffectedActivitiesForInstallationPeriods(
        dataset,
        next.id,
        next.name,
        oldPeriods,
        periods
      );

    // Even without installation changes, check for affected activities
    {
      const boundsAffectedActivities = findAffectedActivities(
        dataset,
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
        const annotated = annotateActivityOutcomes(dataset, indAffectedActivities);
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
          completeAndClose();
          return;
        }

        const warningScope = ownBoundsChanged
          ? "bounds"
          : boundsAffectedActivities.length > 0 && installationAffectedActivities.length > 0
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
        setSelectedBoundsChangeIds(new Set());
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
      affectedActivities.push(...findAffectedActivities(dataset, next.id, next.name, newStart, newEnd, oldStart, oldEnd));
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
          affectedActivities.push(...findAffectedActivities(dataset, comp.id, comp.name, compEffStart, compEffEnd, oldCompEffStart, oldCompEffEnd).map(a => ({...a, systemName: next.name})));
        } else {
          affectedActivities.push(...findAffectedActivities(dataset, comp.id, comp.name, compEffStart, compEffStart, oldCompEffStart, oldCompEffEnd).map(a => ({...a, systemName: next.name})));
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
              dataset,
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
        completeAndClose();
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
          entityBoundsText: oldSystem
            ? formatBoundsChangeSummary(oldSystem, pending)
            : undefined,
          affectedComponents: affectedComps,
          affectedComponentOfSystems: [],
          affectedInstallations: affectedInstalls,
          affectedActivities: annotateActivityOutcomes(dataset, dedupedActivities),
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
            completeAndClose();
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
            completeAndClose();
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
      const existingComp = dataset.individuals.get(next.id);
      const oldParentSystem = existingComp?.installedIn
        ? dataset.individuals.get(existingComp.installedIn)
        : undefined;
      const newParentSystem = next.installedIn
        ? dataset.individuals.get(next.installedIn)
        : undefined;

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
      compAffectedActivities.push(...findAffectedActivities(dataset, next.id, next.name, effectiveStart, effectiveEnd, oldEffStart, oldEffEnd).map(a => ({...a, systemName: parentSystemName})));

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
              dataset,
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
        const parentSwitchSummary =
          existingComp &&
          oldParentSystem &&
          newParentSystem &&
          oldParentSystem.id !== newParentSystem.id
            ? {
                componentBoundsText: formatIndividualBounds(pending),
                oldParentName: oldParentSystem.name,
                oldParentBoundsText: formatIndividualBounds(oldParentSystem),
                newParentName: newParentSystem.name,
                newParentBoundsText: formatIndividualBounds(newParentSystem),
              }
            : undefined;

        setCascadeWarning({
          entityName: next.name,
          entityBoundsText: parentSwitchSummary
            ? undefined
            : existingComp
            ? formatBoundsChangeSummary(existingComp, pending)
            : undefined,
          parentSwitchSummary,
          affectedComponents: [],
          affectedComponentOfSystems: [],
          affectedInstallations: affectedInstalls,
          affectedActivities: annotateActivityOutcomes(dataset, dedupedCompActivities),
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
            completeAndClose();
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
            completeAndClose();
          },
        });
        setShowCascadeWarningModal(true);
        return;
      }
    }
  }

  commitIndividualSave(next);
};

const confirmBoundsApply = () => {
  const individual = pendingSaveIndividual;
  if (!individual) {
    setShowBoundsWarningModal(false);
    return;
  }

  // Resolve installation periods: trim-items toggled to delete get removed
  let resolvedIndividual = individual;
  if (pendingBoundsChanges.length > 0 && selectedBoundsChangeIds.size > 0) {
    const currentPeriods = getInstallationPeriods(individual);
    const resolvedPeriods = currentPeriods.filter(
      (p) => !selectedBoundsChangeIds.has(p.id)
    );
    resolvedIndividual = syncLegacyInstallationFields({
      ...individual,
      installedIn: undefined,
      installedBeginning: undefined,
      installedEnding: undefined,
      installations: resolvedPeriods,
    });
  }

  // Build consolidated list: auto-removable + user-visible with toggled actions
  const allChanges: AffectedActivity[] = [
    ...pendingAutoRemoveActivities,
    ...pendingAffectedActivities.map((aa) => {
      // Trim items toggled to delete become drop
      if (
        aa.action === "trim" &&
        selectedAffectedActivityKeys.has(getAffectedActivitySelectionKey(aa))
      ) {
        return { ...aa, action: "drop" as const };
      }
      return aa;
    }),
  ];
  if (allChanges.length > 0) {
    updateDataset((d: Model) => {
      saveIndividualToModel(d, resolvedIndividual);
      applyAffectedActivityChanges(d, allChanges);
    });
    completeAndClose();
  } else {
    commitIndividualSave(resolvedIndividual);
  }
};

const handleDelete = () => {
  setPendingActivityAction("keep");
  setSelectedAffectedActivityKeys(new Set());
  setSelectedCascadeComponentIds(new Set());
  setSelectedCascadeInstallationIds(new Set());
  const warning = buildDeleteCascadeWarning(inputs);
  const hasCascadeEffects =
    warning.affectedComponents.length > 0 ||
    warning.affectedComponentOfSystems.length > 0 ||
    warning.affectedInstallations.length > 0 ||
    warning.affectedActivities.length > 0;

  if (!hasCascadeEffects) {
    deleteIndividual(inputs.id);
    completeAndClose();
    return;
  }

  setCascadeWarning(warning);
  setShowCascadeWarningModal(true);
};

const confirmCascadeDelete = () => {
  if (!cascadeWarning) {
    return;
  }

  if (cascadeWarning.mode !== "delete") {
    const resolvedAffectedComponents = cascadeWarning.affectedComponents.map(
      (affectedComponent) => {
        if (
          affectedComponent.action === "trim" &&
          selectedCascadeComponentIds.has(affectedComponent.id)
        ) {
          return {
            ...affectedComponent,
            action: "drop" as const,
            toBeginning: undefined,
            toEnding: undefined,
          };
        }

        return affectedComponent;
      }
    );

    const resolvedAffectedInstallations = cascadeWarning.affectedInstallations.map(
      (affectedInstallation) => {
        if (
          affectedInstallation.action === "trim" &&
          selectedCascadeInstallationIds.has(affectedInstallation.periodId)
        ) {
          return {
            ...affectedInstallation,
            action: "drop" as const,
            toBeginning: undefined,
            toEnding: undefined,
          };
        }

        return affectedInstallation;
      }
    );

    updateDataset((d: Model) => {
      saveIndividualToModel(d, cascadeWarning.pendingIndividual);

      for (const affectedComponent of resolvedAffectedComponents) {
        const component = d.individuals.get(affectedComponent.id);
        if (!component) continue;

        if (
          affectedComponent.action === "trim" &&
          affectedComponent.toBeginning !== undefined &&
          affectedComponent.toEnding !== undefined
        ) {
          d.addIndividual({
            ...component,
            beginning: affectedComponent.toBeginning,
            ending: affectedComponent.toEnding,
          });
        }

        if (affectedComponent.action === "drop") {
          d.individuals.delete(affectedComponent.id);
        }
      }

      const installsByIndividual = new Map<string, AffectedInstallation[]>();
      for (const affectedInstallation of resolvedAffectedInstallations) {
        const list = installsByIndividual.get(affectedInstallation.individualId) ?? [];
        list.push(affectedInstallation);
        installsByIndividual.set(affectedInstallation.individualId, list);
      }

      Array.from(installsByIndividual.entries()).forEach(([individualId, affectedPeriods]) => {
        const individual = d.individuals.get(individualId);
        if (!individual) return;

        const droppedComponentIds = new Set(
          resolvedAffectedComponents
            .filter((component) => component.action === "drop")
            .map((component) => component.id)
        );

        let periods = getInstallationPeriods(individual).filter(
          (period) => !droppedComponentIds.has(period.systemComponentId)
        );

        periods = periods
          .map((period) => {
            const match = affectedPeriods.find(
              (affectedInstallation) => affectedInstallation.periodId === period.id
            );
            if (
              match &&
              match.action === "trim" &&
              match.toBeginning !== undefined &&
              match.toEnding !== undefined
            ) {
              return {
                ...period,
                beginning: match.toBeginning,
                ending: match.toEnding,
              };
            }
            if (match && match.action === "drop") return null;
            return period;
          })
          .filter((period): period is InstallationPeriod => !!period);

        saveIndividualToModelWithoutReconcile(
          d,
          syncLegacyInstallationFields({
            ...individual,
            installedIn: undefined,
            installedBeginning: undefined,
            installedEnding: undefined,
            installations: periods,
          })
        );
      });

      applyAffectedActivityChanges(
        d,
        cascadeWarning.affectedActivities.filter(
          (affectedActivity) =>
            !(
              affectedActivity.action === "drop" &&
              affectedActivity.keepStrategy === "return-to-individual"
            )
        )
      );

      Array.from(installsByIndividual.keys()).forEach((individualId) => {
        const individual = d.individuals.get(individualId);
        if (individual) {
          d.reconcileParticipationsForInstallations(individual);
        }
      });

      return d;
    });

    setShowCascadeWarningModal(false);
    setCascadeWarning(null);
    setPendingActivityAction("keep");
    setSelectedAffectedActivityKeys(new Set());
    setSelectedCascadeComponentIds(new Set());
    setSelectedCascadeInstallationIds(new Set());
    completeAndClose();
    return;
  }

  const selectedOptionalActivities = cascadeWarning.affectedActivities.filter(
    (affectedActivity) =>
      affectedActivity.deleteChoice === "optional" &&
      selectedAffectedActivityKeys.has(getAffectedActivitySelectionKey(affectedActivity))
  );

  updateDataset((d: Model) => {
    d.removeIndividual(cascadeWarning.pendingIndividual.id);

    if (selectedOptionalActivities.length > 0) {
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
  setSelectedCascadeComponentIds(new Set());
  setSelectedCascadeInstallationIds(new Set());
  completeAndClose();
};

const boundsWarningLeadText =
  pendingChangeScope === "installations"
    ? "Changing the installation periods for"
    : pendingChangeScope === "both"
    ? "Changing the bounds or installation periods for"
    : "Changing the bounds of";
const boundsChangeSummary = (() => {
  if (pendingChangeScope === "installations") return null;
  if (!pendingSaveIndividual?.id) return null;

  const originalIndividual = dataset.individuals.get(pendingSaveIndividual.id);
  if (!originalIndividual) return null;

  const originalBounds = `${formatBound(normalizeStart(originalIndividual.beginning), true)}-${formatBound(
    normalizeEnd(originalIndividual.ending),
    false
  )}`;
  const nextBounds = `${formatBound(normalizeStart(pendingSaveIndividual.beginning), true)}-${formatBound(
    normalizeEnd(pendingSaveIndividual.ending),
    false
  )}`;

  if (originalBounds === nextBounds) return null;

  return `${originalBounds} -> ${nextBounds}`;
})();
const installationPeriodChangeSummaries = (() => {
  if (pendingChangeScope === "bounds") return [] as string[];
  if (!pendingSaveIndividual?.id) return [] as string[];

  const originalIndividual = dataset.individuals.get(pendingSaveIndividual.id);
  if (!originalIndividual) return [] as string[];

  const originalById = new Map(
    getInstallationPeriods(originalIndividual).map((period) => [period.id, period])
  );
  const changes = getInstallationPeriods(pendingSaveIndividual)
    .map((nextPeriod) => {
      const originalPeriod = originalById.get(nextPeriod.id);
      if (!originalPeriod) return null;

      const sameComponent =
        originalPeriod.systemComponentId === nextPeriod.systemComponentId;
      const sameBounds =
        originalPeriod.beginning === nextPeriod.beginning &&
        originalPeriod.ending === nextPeriod.ending;
      if (sameComponent && sameBounds) return null;

      const originalComponentName =
        dataset.individuals.get(originalPeriod.systemComponentId)?.name ??
        originalPeriod.systemComponentId;
      const nextComponentName =
        dataset.individuals.get(nextPeriod.systemComponentId)?.name ??
        nextPeriod.systemComponentId;
      const originalRange = `${formatBound(originalPeriod.beginning, true)}-${formatBound(
        originalPeriod.ending,
        false
      )}`;
      const nextRange = `${formatBound(nextPeriod.beginning, true)}-${formatBound(
        nextPeriod.ending,
        false
      )}`;

      if (sameComponent) {
        return `(${nextComponentName} ${originalRange} -> ${nextRange})`;
      }

      return `(${originalComponentName} ${originalRange} -> ${nextComponentName} ${nextRange})`;
    })
    .filter((value): value is string => !!value)
    .sort((left, right) => left.localeCompare(right));

  return changes;
})();

  const hideBoundsWarningModal = () => {
    setShowBoundsWarningModal(false);
    setPendingActivityAction("keep");
    setSelectedAffectedActivityKeys(new Set());
    setSelectedBoundsChangeIds(new Set());
  };

  const hideCascadeWarningModal = () => {
    setShowCascadeWarningModal(false);
    setCascadeWarning(null);
    setPendingActivityAction("keep");
    setSelectedAffectedActivityKeys(new Set());
    setSelectedCascadeComponentIds(new Set());
    setSelectedCascadeInstallationIds(new Set());
  };

  return {
    showBoundsWarningModal,
    showCascadeWarningModal,
    cascadeWarning,
    pendingBoundsChanges,
    pendingAffectedActivities,
    selectedAffectedActivityKeys,
    setSelectedAffectedActivityKeys,
    selectedBoundsChangeIds,
    setSelectedBoundsChangeIds,
    selectedCascadeComponentIds,
    setSelectedCascadeComponentIds,
    selectedCascadeInstallationIds,
    setSelectedCascadeInstallationIds,
    boundsWarningLeadText,
    boundsChangeSummary,
    installationPeriodChangeSummaries,
    handleSave,
    handleDelete,
    confirmBoundsApply,
    confirmCascadeDelete,
    resetWarningState,
    hideBoundsWarningModal,
    hideCascadeWarningModal,
  };
}
