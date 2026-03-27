import { useCallback, useEffect, useState, useRef, Dispatch } from "react";
import Link from "next/link";
import { config } from "@/diagram/config";
import SetIndividual from "@/components/SetIndividual";
import SetActivity from "@/components/SetActivity";
import SetConfig from "@/components/SetConfig";
import ActivityDiagram from "@/components/ActivityDiagram";
import Container from "react-bootstrap/Container";
import DiagramPersistence from "@/components/DiagramPersistence";
import SortIndividuals from "./SortIndividuals";
import SetParticipation from "./SetParticipation";
import Undo, { HistoryEntry } from "./Undo";
import { Model } from "@/lib/Model";
import { Activity, Id, Individual, Maybe, Participation } from "@/lib/Schema";
import {
  ENTITY_TYPE_IDS,
  getEntityTypeIdFromIndividual,
  getEntityTypeLabel,
} from "@/lib/entityTypes";
import {
  getInstallationPeriods,
  normalizeEnd,
  normalizeStart,
  syncLegacyInstallationFields,
} from "@/utils/installations";
import { save as saveTTL, load as loadTTL } from "@/lib/ActivityLib";
import ExportJson from "./ExportJson";
import ExportSvg from "./ExportSvg";
import HideIndividuals from "./HideIndividuals";
import DiagramLegend from "./DiagramLegend";
import EntityTypeLegend from "./EntityTypeLegend";

const SESSION_KEY = "activity-editor-session";
const HISTORY_SESSION_KEY = "activity-editor-history";

type SerializedHistoryEntry = {
  modelTtl: string;
  category: string;
  description: string;
  undoLabel: string;
  redoLabel: string;
};

const normalizeConfigData = (storedConfig: Partial<typeof config>) => ({
  ...config,
  ...storedConfig,
  viewPort: {
    ...config.viewPort,
    ...storedConfig.viewPort,
  },
  layout: {
    ...config.layout,
    ...storedConfig.layout,
    individual: {
      ...config.layout.individual,
      ...storedConfig.layout?.individual,
    },
    system: {
      ...config.layout.system,
      ...storedConfig.layout?.system,
    },
  },
  presentation: {
    ...config.presentation,
    ...storedConfig.presentation,
    individual: {
      ...config.presentation.individual,
      ...storedConfig.presentation?.individual,
    },
    activity: {
      ...config.presentation.activity,
      ...storedConfig.presentation?.activity,
    },
    participation: {
      ...config.presentation.participation,
      ...storedConfig.presentation?.participation,
    },
    axis: {
      ...config.presentation.axis,
      ...storedConfig.presentation?.axis,
    },
  },
  labels: {
    ...config.labels,
    ...storedConfig.labels,
    individual: {
      ...config.labels.individual,
      ...storedConfig.labels?.individual,
    },
    activity: {
      ...config.labels.activity,
      ...storedConfig.labels?.activity,
    },
  },
});

function createHistoryDetails(
  category: string,
  description: string,
  undoLabel: string,
  redoLabel: string
): Omit<HistoryEntry<Model>, "model"> {
  return {
    category,
    description,
    undoLabel,
    redoLabel,
  };
}

function buildCascadingHistoryDescription(
  prefixFragments: string[],
  primaryFragment: string,
  sideEffectFragments: string[]
) {
  if (sideEffectFragments.length === 0) {
    return [...prefixFragments, primaryFragment].join("; ");
  }

  const prefixText = prefixFragments.length > 0 ? `${prefixFragments.join("\n")}\n` : "";
  return `${prefixText}${primaryFragment} which:\n- ${sideEffectFragments.join("\n- ")}`;
}

function isCascadeDriverFragment(fragment: string) {
  return (
    fragment.startsWith("Changed timing of ") ||
    fragment.startsWith("Added installation ") ||
    fragment.startsWith("Removed installation ") ||
    fragment.startsWith("Moved installation ") ||
    fragment.startsWith("Changed installation ") ||
    fragment.startsWith("Updated installations ")
  );
}

function getKindLabel(name: string | undefined) {
  return name || "Unknown type";
}

function getActivityLabel(model: Model, activityId: string | undefined) {
  if (!activityId) return "top level";
  return model.activities.get(activityId)?.name || activityId;
}

function getIndividualLabel(model: Model, individualId: string | undefined) {
  if (!individualId) return "Unknown individual";
  return model.individuals.get(individualId)?.name || individualId;
}

function getEntityHistoryCopy(individual: Individual | undefined, fallbackId: string) {
  const typeLabel = getEntityTypeLabel(
    individual?.type,
    individual?.installedIn,
    individual?.entityType
  );
  const typeNoun = typeLabel.toLowerCase();

  return {
    category: typeLabel,
    noun: typeNoun,
    name: individual?.name || fallbackId,
  };
}

function formatExtentRange(beginning: number, ending: number) {
  return `(${formatRange(beginning, ending)})`;
}

function getIndividualPlacementCopy(model: Model, individual: Individual | undefined) {
  if (!individual) return "";

  if (
    getEntityTypeIdFromIndividual(individual) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
    individual.installedIn
  ) {
    return ` in system "${getIndividualLabel(model, individual.installedIn)}"`;
  }

  return "";
}

function getActivityParticipantsCopy(model: Model, activity: Activity | undefined) {
  if (!activity || activity.participations.size === 0) {
    return "with no participants";
  }

  const participantNames = Array.from(activity.participations.keys()).map((participantId) =>
    `"${getIndividualLabel(model, participantId)}"`
  );

  return `with participants ${participantNames.join(", ")}`;
}

function formatQuotedList(items: string[]) {
  return items.map((item) => `"${item}"`).join(", ");
}

function formatEntityWithExtent(model: Model, individualId: string) {
  const individual = model.individuals.get(individualId);
  const name = getIndividualLabel(model, individualId);
  return `"${name}" ${formatExtentRange(
    individual?.beginning ?? 0,
    individual?.ending ?? Model.END_OF_TIME
  )}`;
}

function summarizeRemovedInstallations(
  model: Model,
  removedInstallations: ReturnType<typeof getRemovalCascadeCopy>["removedInstallations"]
) {
  const installationsByIndividual = new Map<string, string[]>();

  removedInstallations.forEach((installation) => {
    const ownerName = getIndividualLabel(model, installation.individualId);
    const componentName = getIndividualLabel(model, installation.systemComponentId);
    const existing = installationsByIndividual.get(ownerName) || [];
    existing.push(
      `"${componentName}" (${formatRange(installation.beginning, installation.ending)})`
    );
    installationsByIndividual.set(ownerName, existing);
  });

  return Array.from(installationsByIndividual.entries()).map(
    ([ownerName, installations]) =>
      `Removed installations for "${ownerName}": ${installations.join(", ")}`
  );
}

function getRemovalCascadeCopy(model: Model, removedId: string) {
  const cascade = model.getIndividualRemovalCascade(removedId);
  const removedIndividual = model.individuals.get(removedId);

  const removedComponentNames = cascade.deletedIndividualIds
    .filter((id) => id !== removedId)
    .filter((id) => {
      const individual = model.individuals.get(id);
      return (
        !!individual &&
        getEntityTypeIdFromIndividual(individual) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT
      );
    })
    .map((id) => formatEntityWithExtent(model, id));

  const removedActivities = cascade.removedActivityIds.map((activityId) =>
    getActivityLabel(model, activityId)
  );

  const removedInstallations = cascade.removedInstallations.filter((installation) => {
    const owner = model.individuals.get(installation.individualId);
    return (
      !!owner &&
      getEntityTypeIdFromIndividual(owner) === ENTITY_TYPE_IDS.INDIVIDUAL
    );
  });

  return {
    removedIndividual,
    removedComponentNames,
    removedInstallations,
    removedActivities,
  };
}

function buildRemovalHistoryDetails(model: Model, removedId: string) {
  const entityCopy = getEntityHistoryCopy(model.individuals.get(removedId), removedId);
  const cascade = getRemovalCascadeCopy(model, removedId);
  const detailParts = [
    `Removed ${entityCopy.noun} ${formatEntityWithExtent(model, removedId)}`,
  ];
  const summaryParts: string[] = [];

  if (cascade.removedComponentNames.length > 0) {
    detailParts.push(
      `Removed system components ${formatQuotedList(cascade.removedComponentNames)}`
    );
    summaryParts.push(
      `${cascade.removedComponentNames.length} system component${cascade.removedComponentNames.length === 1 ? "" : "s"}`
    );
  }

  if (cascade.removedInstallations.length > 0) {
    detailParts.push(...summarizeRemovedInstallations(model, cascade.removedInstallations));
    summaryParts.push(
      `${cascade.removedInstallations.length} installation${cascade.removedInstallations.length === 1 ? "" : "s"}`
    );
  }

  if (cascade.removedActivities.length > 0) {
    detailParts.push(`Removed activities ${formatQuotedList(cascade.removedActivities)}`);
    summaryParts.push(
      `${cascade.removedActivities.length} activit${cascade.removedActivities.length === 1 ? "y" : "ies"}`
    );
  }

  const summaryText =
    summaryParts.length > 0 ? ` and ${summaryParts.join(", ")}` : "";

  return createHistoryDetails(
    entityCopy.category,
    detailParts.join("; "),
    `Restore ${entityCopy.noun} "${entityCopy.name}"${summaryText}`,
    `Remove ${entityCopy.noun} "${entityCopy.name}"${summaryText}`
  );
}

function formatRange(beginning: number, ending: number) {
  const normalizedBeginning = normalizeStart(beginning);
  const normalizedEnding = normalizeEnd(ending);
  return `${normalizedBeginning}-${
    normalizedEnding >= Model.END_OF_TIME ? "∞" : normalizedEnding
  }`;
}

function formatInstallationPeriodSummary(
  model: Model,
  period: ReturnType<typeof getInstallationPeriods>[number]
) {
  const componentName = getIndividualLabel(model, period.systemComponentId);
  return `"${componentName}" (${formatRange(period.beginning, period.ending)})`;
}

function summarizePeriodsByComponent(
  model: Model,
  periods: ReturnType<typeof getInstallationPeriods>
) {
  const rangesByComponent = new Map<string, string[]>();

  periods.forEach((period) => {
    const componentName = getIndividualLabel(model, period.systemComponentId);
    const ranges = rangesByComponent.get(componentName) || [];
    ranges.push(formatRange(period.beginning, period.ending));
    rangesByComponent.set(componentName, ranges);
  });

  return Array.from(rangesByComponent.entries()).map(
    ([componentName, ranges]) => `"${componentName}" (${ranges.join(", ")})`
  );
}

function getEffectiveActivityColor(model: Model, activityId: string) {
  const activity = model.activities.get(activityId);
  if (!activity) return config.presentation.activity.fill[0] || "#440099";
  if (activity.color) return activity.color;

  const palette = config.presentation.activity.fill;
  if (palette.length === 0) return "#440099";

  const siblingIds = Array.from(model.activities.values())
    .filter((candidate) => candidate.partOf === activity.partOf)
    .map((candidate) => candidate.id);
  const index = siblingIds.indexOf(activityId);
  if (index < 0) return palette[0];
  return palette[index % palette.length];
}

function describeEntityReorder(oldModel: Model, newModel: Model) {
  const oldIds = Array.from(oldModel.individuals.keys());
  const newIds = Array.from(newModel.individuals.keys());

  if (oldIds.length !== newIds.length) return undefined;

  const oldSet = new Set(oldIds);
  if (newIds.some((id) => !oldSet.has(id))) return undefined;
  if (oldIds.every((id, index) => id === newIds[index])) return undefined;

  const oldIndexById = new Map(oldIds.map((id, index) => [id, index]));
  const arraysEqual = (left: string[], right: string[]) =>
    left.length === right.length && left.every((id, index) => id === right[index]);

  let movedId: string | undefined;
  let fromIndex: number | undefined;
  let toIndex: number | undefined;

  for (let i = 0; i < oldIds.length; i++) {
    const candidateId = oldIds[i];
    const candidateNewIndex = newIds.indexOf(candidateId);
    if (candidateNewIndex < 0 || candidateNewIndex === i) continue;

    const withoutCandidate = oldIds.filter((id) => id !== candidateId);
    const simulated = [...withoutCandidate];
    simulated.splice(candidateNewIndex, 0, candidateId);

    if (arraysEqual(simulated, newIds)) {
      movedId = candidateId;
      fromIndex = i;
      toIndex = candidateNewIndex;
      break;
    }
  }

  if (!movedId || fromIndex === undefined || toIndex === undefined) {
    movedId = newIds.find((id, newIndex) => oldIndexById.get(id) !== newIndex);
    if (!movedId) return undefined;
    fromIndex = oldIndexById.get(movedId);
    toIndex = newIds.indexOf(movedId);
    if (fromIndex === undefined || toIndex < 0) return undefined;
  }

  const movedName = getIndividualLabel(newModel, movedId);

  const movedOld = oldModel.individuals.get(movedId);
  const movedNew = newModel.individuals.get(movedId);
  const movedType = movedNew
    ? getEntityTypeIdFromIndividual(movedNew)
    : movedOld
      ? getEntityTypeIdFromIndividual(movedOld)
      : undefined;

  const getCollapsedPositionIds = (model: Model, ids: string[]) => {
    const systemIds = new Set(
      ids.filter((id) => {
        const individual = model.individuals.get(id);
        return !!individual && getEntityTypeIdFromIndividual(individual) === ENTITY_TYPE_IDS.SYSTEM;
      })
    );

    return ids.filter((id) => {
      const individual = model.individuals.get(id);
      if (!individual) return false;
      if (getEntityTypeIdFromIndividual(individual) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        return true;
      }
      return !individual.installedIn || !systemIds.has(individual.installedIn);
    });
  };

  if (
    movedType === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
    movedNew?.installedIn &&
    movedOld?.installedIn === movedNew.installedIn
  ) {
    const systemId = movedNew.installedIn;
    const systemName = getIndividualLabel(newModel, systemId);

    const oldWithinSystemIds = oldIds.filter((id) => {
      const individual = oldModel.individuals.get(id);
      return (
        !!individual &&
        getEntityTypeIdFromIndividual(individual) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
        individual.installedIn === systemId
      );
    });

    const newWithinSystemIds = newIds.filter((id) => {
      const individual = newModel.individuals.get(id);
      return (
        !!individual &&
        getEntityTypeIdFromIndividual(individual) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
        individual.installedIn === systemId
      );
    });

    const fromWithinIndex = oldWithinSystemIds.indexOf(movedId);
    const toWithinIndex = newWithinSystemIds.indexOf(movedId);

    if (fromWithinIndex >= 0 && toWithinIndex >= 0) {
      return createHistoryDetails(
        "Sort Entities",
        `Reordered system component "${movedName}" in system "${systemName}" from position ${fromWithinIndex + 1} to ${toWithinIndex + 1}`,
        `Move "${movedName}" back to position ${fromWithinIndex + 1} in system "${systemName}"`,
        `Move "${movedName}" to position ${toWithinIndex + 1} in system "${systemName}"`
      );
    }
  }

  const oldCollapsedIds = getCollapsedPositionIds(oldModel, oldIds);
  const newCollapsedIds = getCollapsedPositionIds(newModel, newIds);
  const fromCollapsedIndex = oldCollapsedIds.indexOf(movedId);
  const toCollapsedIndex = newCollapsedIds.indexOf(movedId);

  if (fromCollapsedIndex >= 0 && toCollapsedIndex >= 0) {
    return createHistoryDetails(
      "Sort Entities",
      `Reordered entity "${movedName}" from position ${fromCollapsedIndex + 1} to ${toCollapsedIndex + 1}`,
      `Move "${movedName}" back to position ${fromCollapsedIndex + 1}`,
      `Move "${movedName}" to position ${toCollapsedIndex + 1}`
    );
  }

  return createHistoryDetails(
    "Sort Entities",
    `Reordered entity "${movedName}" from position ${fromIndex + 1} to ${toIndex + 1}`,
    `Move "${movedName}" back to position ${fromIndex + 1}`,
    `Move "${movedName}" to position ${toIndex + 1}`
  );
}

function summarizeInstallationChangeForIndividual(
  oldModel: Model,
  newModel: Model,
  individualId: string
) {
  const oldIndividual = oldModel.individuals.get(individualId);
  const newIndividual = newModel.individuals.get(individualId);
  if (!oldIndividual || !newIndividual) return undefined;

  if (getEntityTypeIdFromIndividual(newIndividual) !== ENTITY_TYPE_IDS.INDIVIDUAL) {
    return undefined;
  }

  const oldPeriods = getInstallationPeriods(oldIndividual);
  const newPeriods = getInstallationPeriods(newIndividual);
  const oldById = new Map(oldPeriods.map((period) => [period.id, period]));
  const newById = new Map(newPeriods.map((period) => [period.id, period]));
  const added = newPeriods.filter((period) => !oldById.has(period.id));
  const removed = oldPeriods.filter((period) => !newById.has(period.id));
  const changed = newPeriods
    .map((period) => {
      const previous = oldById.get(period.id);
      if (!previous) return undefined;
      if (
        previous.systemComponentId === period.systemComponentId &&
        previous.beginning === period.beginning &&
        previous.ending === period.ending
      ) {
        return undefined;
      }
      return { previous, next: period };
    })
    .filter((item): item is { previous: ReturnType<typeof getInstallationPeriods>[number]; next: ReturnType<typeof getInstallationPeriods>[number] } => !!item);

  const individualName = newIndividual.name || oldIndividual.name || individualId;

  if (added.length === 1 && removed.length === 0 && changed.length === 0) {
    const period = added[0];
    const componentName = getIndividualLabel(newModel, period.systemComponentId);
    return createHistoryDetails(
      "Installation",
      `Added installation for "${individualName}" in "${componentName}" (${formatRange(period.beginning, period.ending)})`,
      `Remove installation for "${individualName}" from "${componentName}"`,
      `Add installation for "${individualName}" in "${componentName}"`
    );
  }

  if (removed.length === 1 && added.length === 0 && changed.length === 0) {
    const period = removed[0];
    const componentName = getIndividualLabel(oldModel, period.systemComponentId);
    return createHistoryDetails(
      "Installation",
      `Removed installation for "${individualName}" from "${componentName}" (${formatRange(period.beginning, period.ending)})`,
      `Restore installation for "${individualName}" in "${componentName}"`,
      `Remove installation for "${individualName}" from "${componentName}"`
    );
  }

  if (changed.length === 1 && added.length === 0 && removed.length === 0) {
    const { previous, next } = changed[0];
    const previousComponentName = getIndividualLabel(oldModel, previous.systemComponentId);
    const nextComponentName = getIndividualLabel(newModel, next.systemComponentId);
    if (previous.systemComponentId !== next.systemComponentId) {
      return createHistoryDetails(
        "Installation",
        `Moved installation for "${individualName}" from "${previousComponentName}" (${formatRange(previous.beginning, previous.ending)}) to "${nextComponentName}" (${formatRange(next.beginning, next.ending)})`,
        `Move installation for "${individualName}" back to "${previousComponentName}" (${formatRange(previous.beginning, previous.ending)})`,
        `Move installation for "${individualName}" to "${nextComponentName}" (${formatRange(next.beginning, next.ending)})`
      );
    }

    const beginningChanged = previous.beginning !== next.beginning;
    const endingChanged = previous.ending !== next.ending;
    if (beginningChanged && !endingChanged) {
      return createHistoryDetails(
        "Installation",
        `Changed installation beginning for "${individualName}" in "${nextComponentName}" (${normalizeStart(previous.beginning)} → ${normalizeStart(next.beginning)})`,
        `Restore installation beginning for "${individualName}" to ${normalizeStart(previous.beginning)}`,
        `Set installation beginning for "${individualName}" to ${normalizeStart(next.beginning)}`
      );
    }
    if (!beginningChanged && endingChanged) {
      return createHistoryDetails(
        "Installation",
        `Changed installation ending for "${individualName}" in "${nextComponentName}" (${normalizeEnd(previous.ending) >= Model.END_OF_TIME ? "∞" : normalizeEnd(previous.ending)} → ${normalizeEnd(next.ending) >= Model.END_OF_TIME ? "∞" : normalizeEnd(next.ending)})`,
        `Restore installation ending for "${individualName}" to ${normalizeEnd(previous.ending) >= Model.END_OF_TIME ? "∞" : normalizeEnd(previous.ending)}`,
        `Set installation ending for "${individualName}" to ${normalizeEnd(next.ending) >= Model.END_OF_TIME ? "∞" : normalizeEnd(next.ending)}`
      );
    }

    return createHistoryDetails(
      "Installation",
      `Changed installation timing for "${individualName}" in "${nextComponentName}" (beginning ${normalizeStart(previous.beginning)} → ${normalizeStart(next.beginning)}, ending ${normalizeEnd(previous.ending) >= Model.END_OF_TIME ? "∞" : normalizeEnd(previous.ending)} → ${normalizeEnd(next.ending) >= Model.END_OF_TIME ? "∞" : normalizeEnd(next.ending)})`,
      `Restore previous installation timing for "${individualName}"`,
      `Apply new installation timing for "${individualName}"`
    );
  }

  if (added.length > 0 || removed.length > 0 || changed.length > 0) {
    const parts: string[] = [];
    if (added.length > 0) parts.push(`${added.length} added`);
    if (removed.length > 0) parts.push(`${removed.length} removed`);
    if (changed.length > 0) parts.push(`${changed.length} updated`);

    const detailParts: string[] = [];
    const groupedAdded = summarizePeriodsByComponent(newModel, added);
    if (groupedAdded.length > 0) {
      detailParts.push(`added ${groupedAdded.join("; ")}`);
    }

    const groupedRemoved = summarizePeriodsByComponent(oldModel, removed);
    if (groupedRemoved.length > 0) {
      detailParts.push(`removed ${groupedRemoved.join("; ")}`);
    }

    changed.forEach(({ previous, next }) => {
      detailParts.push(
        `updated ${formatInstallationPeriodSummary(oldModel, previous)} → ${formatInstallationPeriodSummary(newModel, next)}`
      );
    });

    const detailsText = detailParts.length > 0 ? `: ${detailParts.join("; ")}` : "";
    return createHistoryDetails(
      "Installation",
      `Updated installations for "${individualName}" (${parts.join(", ")})${detailsText}`,
      `Restore previous installations for "${individualName}"`,
      `Reapply installation updates for "${individualName}"`
    );
  }

  return undefined;
}

function summarizeCombinedIndividualChange(oldModel: Model, newModel: Model) {
  const activitySideEffectFragments: string[] = [];

  // Detect activity timing changes
  for (const id of Array.from(newModel.activities.keys())) {
    if (!oldModel.activities.has(id)) continue;
    const oldActivity = oldModel.activities.get(id);
    const newActivity = newModel.activities.get(id);
    if (!oldActivity || !newActivity) continue;
    if (
      oldActivity.beginning !== newActivity.beginning ||
      oldActivity.ending !== newActivity.ending
    ) {
      activitySideEffectFragments.push(
        `Changed timing of activity "${newActivity.name}" (${formatRange(oldActivity.beginning, oldActivity.ending)} → ${formatRange(newActivity.beginning, newActivity.ending)})`
      );
    }
  }

  // Detect activity removals (e.g. deleted because zero remaining participants)
  for (const id of Array.from(oldModel.activities.keys())) {
    if (!newModel.activities.has(id)) {
      const act = oldModel.activities.get(id);
      activitySideEffectFragments.push(
        `Removed activity "${act?.name || id}" (${formatRange(act?.beginning ?? 0, act?.ending ?? Model.END_OF_TIME)})`
      );
    }
  }

  const commonIndividualIds = Array.from(newModel.individuals.keys()).filter((id) =>
    oldModel.individuals.has(id)
  );

  const combinedFragments: string[] = [];
  let primaryEntity:
    | {
        category: string;
        name: string;
        priority: number;
        directFragments: string[];
      }
    | undefined;

  for (let i = 0; i < commonIndividualIds.length; i++) {
    const id = commonIndividualIds[i];
    const oldIndividual = oldModel.individuals.get(id);
    const newIndividual = newModel.individuals.get(id);
    if (!oldIndividual || !newIndividual) continue;

    const fragments: string[] = [];
    const directFragments: string[] = [];
    let priority = 3;

    if (oldIndividual.name !== newIndividual.name) {
      const entityCopy = getEntityHistoryCopy(newIndividual, id);
      const fragment = `Renamed ${entityCopy.noun} "${oldIndividual.name}" to "${newIndividual.name}"`;
      fragments.push(fragment);
      directFragments.push(fragment);
      priority = Math.min(priority, 0);
    }

    if ((oldIndividual.type?.id || "") !== (newIndividual.type?.id || "")) {
      const entityCopy = getEntityHistoryCopy(newIndividual, id);
      const fragment = `Changed type of ${entityCopy.noun} "${entityCopy.name}" from "${getKindLabel(oldIndividual.type?.name)}" to "${getKindLabel(newIndividual.type?.name)}"`;
      fragments.push(fragment);
      directFragments.push(fragment);
      priority = Math.min(priority, 0);
    }

    const installationChange = summarizeInstallationChangeForIndividual(oldModel, newModel, id);
    if (installationChange) {
      fragments.push(installationChange.description);
      directFragments.push(installationChange.description);
      priority = Math.min(priority, 1);
    }

    if (oldIndividual.beginning !== newIndividual.beginning || oldIndividual.ending !== newIndividual.ending) {
      const entityCopy = getEntityHistoryCopy(newIndividual, id);
      const fragment = `Changed timing of ${entityCopy.noun} "${entityCopy.name}" (${formatRange(oldIndividual.beginning, oldIndividual.ending)} → ${formatRange(newIndividual.beginning, newIndividual.ending)})`;
      fragments.push(fragment);
      directFragments.push(fragment);
      priority = Math.min(priority, 0);
    }

    const participationFragments = getParticipationChangeFragmentsForIndividual(oldModel, newModel, id);
    if (participationFragments.length > 0) {
      priority = Math.min(priority, 2);
      fragments.push(...participationFragments);
    }

    if (fragments.length === 0) {
      continue;
    }

    fragments.forEach((fragment) => {
      if (!combinedFragments.includes(fragment)) {
        combinedFragments.push(fragment);
      }
    });

    if (!primaryEntity || priority < primaryEntity.priority) {
      const entityCopy = getEntityHistoryCopy(newIndividual, id);
      primaryEntity = {
        category: entityCopy.category,
        name: entityCopy.name,
        priority,
        directFragments,
      };
    }
  }

  if (combinedFragments.length >= 1) {
    activitySideEffectFragments.forEach((fragment) => {
      if (!combinedFragments.includes(fragment)) {
        combinedFragments.push(fragment);
      }
    });
  }

  if (primaryEntity && combinedFragments.length >= 2) {
    const primaryDirectFragments = primaryEntity.directFragments.filter((fragment) =>
      combinedFragments.includes(fragment)
    );

    const cascadeDriverFragments = primaryDirectFragments.filter(isCascadeDriverFragment);

    if (cascadeDriverFragments.length === 1) {
      const primaryFragment = cascadeDriverFragments[0];
      const prefixFragments = primaryDirectFragments.filter((fragment) => fragment !== primaryFragment);
      const sideEffectFragments = combinedFragments.filter(
        (fragment) => !primaryDirectFragments.includes(fragment)
      );

      if (sideEffectFragments.length > 0) {
        return createHistoryDetails(
          primaryEntity.category,
          buildCascadingHistoryDescription(prefixFragments, primaryFragment, sideEffectFragments),
          `Restore previous edits for "${primaryEntity.name}"`,
          `Reapply edits for "${primaryEntity.name}"`
        );
      }
    }

    if (primaryDirectFragments.length === 1) {
      const primaryFragment = primaryDirectFragments[0];
      const sideEffectFragments = combinedFragments.filter((fragment) => fragment !== primaryFragment);
      return createHistoryDetails(
        primaryEntity.category,
        buildCascadingHistoryDescription([], primaryFragment, sideEffectFragments),
        `Restore previous edits for "${primaryEntity.name}"`,
        `Reapply edits for "${primaryEntity.name}"`
      );
    }

    return createHistoryDetails(
      primaryEntity.category,
      combinedFragments.join("; "),
      `Restore previous edits for "${primaryEntity.name}"`,
      `Reapply edits for "${primaryEntity.name}"`
    );
  }

  return undefined;
}

function getParticipationEffectiveRange(
  activity: Activity,
  participation: Participation | undefined
) {
  return {
    beginning: participation?.beginning ?? activity.beginning,
    ending: participation?.ending ?? activity.ending,
  };
}

function hasExplicitParticipationTiming(participation: Participation | undefined) {
  return participation?.beginning !== undefined || participation?.ending !== undefined;
}

function getParticipationChangeFragmentsForIndividual(
  oldModel: Model,
  newModel: Model,
  individualId: string
) {
  const fragments: string[] = [];
  const oldIndividual = oldModel.individuals.get(individualId);
  const newIndividual = newModel.individuals.get(individualId);
  const individualName = newIndividual?.name || oldIndividual?.name || individualId;

  const activityIds = Array.from(
    new Set([
      ...Array.from(oldModel.activities.keys()),
      ...Array.from(newModel.activities.keys()),
    ])
  );

  activityIds.forEach((activityId) => {
    const oldActivity = oldModel.activities.get(activityId);
    const newActivity = newModel.activities.get(activityId);
    const oldParticipation = oldActivity?.participations.get(individualId);
    const newParticipation = newActivity?.participations.get(individualId);
    const activityName = newActivity?.name || oldActivity?.name || activityId;

    if (oldParticipation && !newParticipation) {
      if (!oldActivity) {
        return;
      }
      const oldRange = getParticipationEffectiveRange(oldActivity, oldParticipation);
      fragments.push(
        `Removed participant "${individualName}" from "${activityName}" (${formatRange(oldRange.beginning, oldRange.ending)})`
      );
      return;
    }

    if (!oldParticipation && newParticipation) {
      fragments.push(`Added participant "${individualName}" to "${activityName}"`);
      return;
    }

    if (!oldParticipation || !newParticipation || !oldActivity || !newActivity) {
      return;
    }

    const oldHasExplicitTiming = hasExplicitParticipationTiming(oldParticipation);
    const newHasExplicitTiming = hasExplicitParticipationTiming(newParticipation);

    if (
      !oldHasExplicitTiming &&
      !newHasExplicitTiming &&
      (
        oldActivity.beginning !== newActivity.beginning ||
        oldActivity.ending !== newActivity.ending
      )
    ) {
      return;
    }

    const oldRange = getParticipationEffectiveRange(oldActivity, oldParticipation);
    const newRange = getParticipationEffectiveRange(newActivity, newParticipation);

    if (
      oldRange.beginning !== newRange.beginning ||
      oldRange.ending !== newRange.ending
    ) {
      fragments.push(
        `Changed participation timing for "${individualName}" in "${activityName}" (${formatRange(oldRange.beginning, oldRange.ending)} → ${formatRange(newRange.beginning, newRange.ending)})`
      );
    }
  });

  return fragments;
}

function summarizeParticipationTimingChange(oldModel: Model, newModel: Model) {
  const commonIndividualIds = Array.from(newModel.individuals.keys()).filter((id) =>
    oldModel.individuals.has(id)
  );

  for (let i = 0; i < commonIndividualIds.length; i++) {
    const individualId = commonIndividualIds[i];
    const fragments = getParticipationChangeFragmentsForIndividual(
      oldModel,
      newModel,
      individualId
    );
    const timingFragment = fragments.find((fragment) =>
      fragment.startsWith("Changed participation timing")
    );

    if (!timingFragment) continue;

    const individualName = getIndividualLabel(newModel, individualId);
    return createHistoryDetails(
      "Participation",
      timingFragment,
      `Restore previous participation timing for "${individualName}"`,
      `Apply participation timing change for "${individualName}"`
    );
  }

  return undefined;
}

function describeAsCausedBySystemComponentMove(
  description: string,
  componentName: string,
  oldParentName: string,
  newParentName: string
) {
  return `${description} because system component "${componentName}" moved from system "${oldParentName}" to system "${newParentName}"`;
}

function summarizeSystemComponentParentChange(oldModel: Model, newModel: Model) {
  const commonIndividualIds = Array.from(newModel.individuals.keys()).filter((id) =>
    oldModel.individuals.has(id)
  );

  for (let i = 0; i < commonIndividualIds.length; i++) {
    const id = commonIndividualIds[i];
    const oldIndividual = oldModel.individuals.get(id);
    const newIndividual = newModel.individuals.get(id);
    if (!oldIndividual || !newIndividual) continue;

    if (
      getEntityTypeIdFromIndividual(newIndividual) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT ||
      oldIndividual.installedIn === newIndividual.installedIn
    ) {
      continue;
    }

    const oldParentName = oldIndividual.installedIn
      ? getIndividualLabel(oldModel, oldIndividual.installedIn)
      : "No system";
    const newParentName = newIndividual.installedIn
      ? getIndividualLabel(newModel, newIndividual.installedIn)
      : "No system";
    const entityCopy = getEntityHistoryCopy(newIndividual, id);
    const fragments: string[] = [
      `Moved system component "${entityCopy.name}" from system "${oldParentName}" to system "${newParentName}" ${formatExtentRange(newIndividual.beginning, newIndividual.ending)}`,
    ];

    if (
      oldIndividual.beginning !== newIndividual.beginning ||
      oldIndividual.ending !== newIndividual.ending
    ) {
      fragments.push(
        `Changed timing of ${entityCopy.noun} "${entityCopy.name}" (${formatRange(oldIndividual.beginning, oldIndividual.ending)} → ${formatRange(newIndividual.beginning, newIndividual.ending)})`
      );
    }

    commonIndividualIds.forEach((otherId) => {
      if (otherId === id) return;

      const installationChange = summarizeInstallationChangeForIndividual(
        oldModel,
        newModel,
        otherId
      );
      if (installationChange) {
        fragments.push(
          describeAsCausedBySystemComponentMove(
            installationChange.description,
            entityCopy.name,
            oldParentName,
            newParentName
          )
        );
      }

      fragments.push(
        ...getParticipationChangeFragmentsForIndividual(oldModel, newModel, otherId).map(
          (fragment) =>
            describeAsCausedBySystemComponentMove(
              fragment,
              entityCopy.name,
              oldParentName,
              newParentName
            )
        )
      );
    });

    const uniqueFragments = fragments.filter(
      (fragment, index) => fragments.indexOf(fragment) === index
    );

    return createHistoryDetails(
      entityCopy.category,
      uniqueFragments.join("; "),
      uniqueFragments.length > 1
        ? `Restore previous edits for "${entityCopy.name}"`
        : `Move system component "${entityCopy.name}" back to system "${oldParentName}"`,
      uniqueFragments.length > 1
        ? `Reapply edits for "${entityCopy.name}"`
        : `Move system component "${entityCopy.name}" to system "${newParentName}"`
    );
  }

  return undefined;
}

function summarizeInstallationChange(oldModel: Model, newModel: Model) {
  const commonIndividualIds = Array.from(newModel.individuals.keys()).filter((id) =>
    oldModel.individuals.has(id)
  );

  for (let i = 0; i < commonIndividualIds.length; i++) {
    const change = summarizeInstallationChangeForIndividual(oldModel, newModel, commonIndividualIds[i]);
    if (change) return change;
  }

  return undefined;
}

function generateHistoryDetails(oldModel: Model, newModel: Model): Omit<HistoryEntry<Model>, "model"> {
  const oldIndIds = Array.from(oldModel.individuals.keys());
  const newIndIds = Array.from(newModel.individuals.keys());
  const oldIndSet = new Set(oldIndIds);
  const newIndSet = new Set(newIndIds);

  for (let i = 0; i < newIndIds.length; i++) {
    const id = newIndIds[i];
    if (!oldIndSet.has(id)) {
      const ind = newModel.individuals.get(id);
      const entityCopy = getEntityHistoryCopy(ind, id);
      return createHistoryDetails(
        entityCopy.category,
        `Added ${entityCopy.noun} "${entityCopy.name}" ${formatExtentRange(ind?.beginning ?? 0, ind?.ending ?? Model.END_OF_TIME)}${getIndividualPlacementCopy(newModel, ind)}`,
        `Remove ${entityCopy.noun} "${entityCopy.name}"`,
        `Add ${entityCopy.noun} "${entityCopy.name}"`
      );
    }
  }
  for (let i = 0; i < oldIndIds.length; i++) {
    const id = oldIndIds[i];
    if (!newIndSet.has(id)) {
      return buildRemovalHistoryDetails(oldModel, id);
    }
  }

  const combinedIndividualChange = summarizeCombinedIndividualChange(oldModel, newModel);
  if (combinedIndividualChange) return combinedIndividualChange;

  const oldActIds = Array.from(oldModel.activities.keys());
  const newActIds = Array.from(newModel.activities.keys());
  const oldActSet = new Set(oldActIds);
  const newActSet = new Set(newActIds);

  for (let i = 0; i < newActIds.length; i++) {
    const id = newActIds[i];
    if (!oldActSet.has(id)) {
      const act = newModel.activities.get(id);
      const parentName = getActivityLabel(newModel, act?.partOf as string | undefined);
      if (act?.partOf) {
        return createHistoryDetails(
          "Sub-activity",
          `Created sub-task "${act?.name || id}" under "${parentName}" ${formatExtentRange(act?.beginning ?? 0, act?.ending ?? Model.END_OF_TIME)} ${getActivityParticipantsCopy(newModel, act)}`,
          `Delete sub-task "${act?.name || id}" from "${parentName}"`,
          `Create sub-task "${act?.name || id}" under "${parentName}"`
        );
      }
      return createHistoryDetails(
        "Activity",
        `Added activity "${act?.name || id}" ${formatExtentRange(act?.beginning ?? 0, act?.ending ?? Model.END_OF_TIME)} ${getActivityParticipantsCopy(newModel, act)}`,
        `Remove activity "${act?.name || id}"`,
        `Add activity "${act?.name || id}"`
      );
    }
  }
  for (let i = 0; i < oldActIds.length; i++) {
    const id = oldActIds[i];
    if (!newActSet.has(id)) {
      const act = oldModel.activities.get(id);
      const parentName = getActivityLabel(oldModel, act?.partOf as string | undefined);
      if (act?.partOf) {
        return createHistoryDetails(
          "Sub-activity",
          `Deleted sub-task "${act?.name || id}" from "${parentName}" ${formatExtentRange(act?.beginning ?? 0, act?.ending ?? Model.END_OF_TIME)}`,
          `Restore sub-task "${act?.name || id}" under "${parentName}"`,
          `Delete sub-task "${act?.name || id}" from "${parentName}"`
        );
      }
      return createHistoryDetails(
        "Activity",
        `Removed activity "${act?.name || id}" ${formatExtentRange(act?.beginning ?? 0, act?.ending ?? Model.END_OF_TIME)}`,
        `Restore activity "${act?.name || id}"`,
        `Remove activity "${act?.name || id}"`
      );
    }
  }

  const systemComponentParentChange = summarizeSystemComponentParentChange(oldModel, newModel);
  if (systemComponentParentChange) return systemComponentParentChange;

  for (let i = 0; i < newIndIds.length; i++) {
    const id = newIndIds[i];
    if (oldIndSet.has(id)) {
      const oldInd = oldModel.individuals.get(id);
      const newInd = newModel.individuals.get(id);
      if (oldInd && newInd && (oldInd.type?.id || "") !== (newInd.type?.id || "")) {
        const entityCopy = getEntityHistoryCopy(newInd, id);
        return createHistoryDetails(
          entityCopy.category,
          `Changed type of ${entityCopy.noun} "${entityCopy.name}" from "${getKindLabel(oldInd.type?.name)}" to "${getKindLabel(newInd.type?.name)}"`,
          `Restore type of ${entityCopy.noun} "${entityCopy.name}" to "${getKindLabel(oldInd.type?.name)}"`,
          `Set type of ${entityCopy.noun} "${entityCopy.name}" to "${getKindLabel(newInd.type?.name)}"`
        );
      }
      if (oldInd && newInd && oldInd.name !== newInd.name) {
        const entityCopy = getEntityHistoryCopy(newInd, id);
        return createHistoryDetails(
          entityCopy.category,
          `Renamed ${entityCopy.noun} "${oldInd.name}" to "${newInd.name}"`,
          `Rename ${entityCopy.noun} "${newInd.name}" back to "${oldInd.name}"`,
          `Rename ${entityCopy.noun} "${oldInd.name}" to "${newInd.name}"`
        );
      }
    }
  }

  for (let i = 0; i < newActIds.length; i++) {
    const id = newActIds[i];
    if (oldActSet.has(id)) {
      const oldAct = oldModel.activities.get(id);
      const newAct = newModel.activities.get(id);
      if (oldAct && newAct && (oldAct.type?.id || "") !== (newAct.type?.id || "")) {
        return createHistoryDetails(
          "Activity",
          `Changed type of activity "${newAct.name}" from "${getKindLabel(oldAct.type?.name)}" to "${getKindLabel(newAct.type?.name)}"`,
          `Restore type of activity "${newAct.name}" to "${getKindLabel(oldAct.type?.name)}"`,
          `Set type of activity "${newAct.name}" to "${getKindLabel(newAct.type?.name)}"`
        );
      }
      if (oldAct && newAct && oldAct.name !== newAct.name) {
        return createHistoryDetails(
          "Activity",
          `Renamed activity "${oldAct.name}" to "${newAct.name}"`,
          `Rename activity "${newAct.name}" back to "${oldAct.name}"`,
          `Rename activity "${oldAct.name}" to "${newAct.name}"`
        );
      }
      if (oldAct && newAct && oldAct.partOf !== newAct.partOf) {
        const oldParentName = getActivityLabel(oldModel, oldAct.partOf as string | undefined);
        const newParentName = getActivityLabel(newModel, newAct.partOf as string | undefined);
        if (!oldAct.partOf && newAct.partOf) {
          return createHistoryDetails(
            "Sub-activity",
            `Changed parent of activity "${newAct.name}" to "${newParentName}" as a sub-task`,
            `Move activity "${newAct.name}" back to top level`,
            `Move activity "${newAct.name}" under "${newParentName}" as a sub-task`
          );
        }
        if (oldAct.partOf && !newAct.partOf) {
          return createHistoryDetails(
            "Sub-activity",
            `Promoted sub-task "${newAct.name}" from "${oldParentName}" to top level`,
            `Move sub-task "${newAct.name}" back under "${oldParentName}"`,
            `Promote sub-task "${newAct.name}" to top level`
          );
        }
        return createHistoryDetails(
          "Sub-activity",
          `Changed parent of sub-task "${newAct.name}" from "${oldParentName}" to "${newParentName}"`,
          `Move sub-task "${newAct.name}" back to "${oldParentName}"`,
          `Move sub-task "${newAct.name}" to "${newParentName}"`
        );
      }
    }
  }

  const installationChange = summarizeInstallationChange(oldModel, newModel);
  if (installationChange) return installationChange;

  const reorderChange = describeEntityReorder(oldModel, newModel);
  if (reorderChange) return reorderChange;

  const participationTimingChange = summarizeParticipationTimingChange(oldModel, newModel);
  if (participationTimingChange) return participationTimingChange;

  for (let i = 0; i < newActIds.length; i++) {
    const id = newActIds[i];
    if (oldActSet.has(id)) {
      const oldAct = oldModel.activities.get(id);
      const newAct = newModel.activities.get(id);
      if (oldAct && newAct) {
        if ((oldAct.color || "") !== (newAct.color || "")) {
          const oldColor = getEffectiveActivityColor(oldModel, id);
          const newColor = getEffectiveActivityColor(newModel, id);
          return createHistoryDetails(
            "Activity Color",
            `Changed activity color for "${newAct.name}" (${oldColor} → ${newColor})`,
            `Restore activity color for "${newAct.name}" to ${oldColor}`,
            `Set activity color for "${newAct.name}" to ${newColor}`
          );
        }

        const oldParticipantIds = new Set(oldAct.participations.keys());
        const newParticipantIds = new Set(newAct.participations.keys());
        const addedParticipantId = Array.from(newParticipantIds).find(
          (participantId) => !oldParticipantIds.has(participantId)
        );
        if (addedParticipantId) {
          const participantName = getIndividualLabel(newModel, addedParticipantId);
          return createHistoryDetails(
            "Participation",
            `Added participant "${participantName}" to "${newAct.name}"`,
            `Remove participant "${participantName}" from "${newAct.name}"`,
            `Add participant "${participantName}" to "${newAct.name}"`
          );
        }
        const removedParticipantId = Array.from(oldParticipantIds).find(
          (participantId) => !newParticipantIds.has(participantId)
        );
        if (removedParticipantId) {
          const participantName = getIndividualLabel(oldModel, removedParticipantId);
          const oldParticipation = oldAct.participations.get(removedParticipantId);
          const oldRange = getParticipationEffectiveRange(oldAct, oldParticipation);
          return createHistoryDetails(
            "Participation",
            `Removed participant "${participantName}" from "${oldAct.name}" (${formatRange(oldRange.beginning, oldRange.ending)})`,
            `Restore participant "${participantName}" in "${oldAct.name}"`,
            `Remove participant "${participantName}" from "${oldAct.name}"`
          );
        }
      }
    }
  }

  for (let i = 0; i < newIndIds.length; i++) {
    const id = newIndIds[i];
    if (oldIndSet.has(id)) {
      const oldInd = oldModel.individuals.get(id);
      const newInd = newModel.individuals.get(id);
      if (oldInd && newInd) {
        if (oldInd.beginning !== newInd.beginning || oldInd.ending !== newInd.ending) {
          const entityCopy = getEntityHistoryCopy(newInd, id);
          return createHistoryDetails(
            "Timing",
            `Changed timing of ${entityCopy.noun} "${entityCopy.name}" (${formatRange(oldInd.beginning, oldInd.ending)} → ${formatRange(newInd.beginning, newInd.ending)})`,
            `Restore previous timing for ${entityCopy.noun} "${entityCopy.name}"`,
            `Apply timing change for ${entityCopy.noun} "${entityCopy.name}"`
          );
        }
      }
    }
  }

  for (let i = 0; i < newActIds.length; i++) {
    const id = newActIds[i];
    if (oldActSet.has(id)) {
      const oldAct = oldModel.activities.get(id);
      const newAct = newModel.activities.get(id);
      if (oldAct && newAct) {
        if (oldAct.beginning !== newAct.beginning || oldAct.ending !== newAct.ending) {
          return createHistoryDetails(
            "Timing",
            `Changed timing of activity "${newAct.name}" (${formatRange(oldAct.beginning, oldAct.ending)} → ${formatRange(newAct.beginning, newAct.ending)})`,
            `Restore previous timing for activity "${newAct.name}"`,
            `Apply timing change for activity "${newAct.name}"`
          );
        }
      }
    }
  }

  return createHistoryDetails(
    "Diagram",
    "Edited diagram",
    "Restore previous diagram state",
    "Reapply diagram edit"
  );
}

function serializeHistoryEntry(entry: HistoryEntry<Model>): SerializedHistoryEntry {
  return {
    modelTtl: saveTTL(entry.model),
    category: entry.category,
    description: entry.description,
    undoLabel: entry.undoLabel,
    redoLabel: entry.redoLabel,
  };
}

function deserializeHistoryEntry(entry: SerializedHistoryEntry): HistoryEntry<Model> | undefined {
  const restored = loadTTL(entry.modelTtl);
  if (restored instanceof Error) {
    console.warn("Failed to restore history entry:", restored);
    return undefined;
  }

  return {
    model: restored,
    category: entry.category,
    description: entry.description,
    undoLabel: entry.undoLabel,
    redoLabel: entry.redoLabel,
  };
}

/* XXX Most of this component needs refactoring into a Controller class,
 * leaving the react component as just the View. */
export default function ActivityDiagramWrap() {
  // compactMode hides individuals that participate in zero activities
  const [compactMode, setCompactMode] = useState(false);
  const model = new Model();
  const [dataset, setDataset] = useState(model);
  const [dirty, setDirty] = useState(false);
  const [activityContext, setActivityContext] = useState<Maybe<Id>>(undefined);
  const [undoHistory, setUndoHistory] = useState<HistoryEntry<Model>[]>([]);
  const [redoHistory, setRedoHistory] = useState<HistoryEntry<Model>[]>([]);
  const [showIndividual, setShowIndividual] = useState(false);
  const [selectedIndividual, setSelectedIndividual] = useState<
    Individual | undefined
  >(undefined);
  const [showActivity, setShowActivity] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<
    Activity | undefined
  >(undefined);
  const [showParticipation, setShowParticipation] = useState(false);
  const [selectedParticipation, setSelectedParticipation] = useState<
    Participation | undefined
  >(undefined);
  const [configData, setConfigData] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("activity-editor-config");
        if (stored) return normalizeConfigData(JSON.parse(stored));
      } catch (e) {
        console.warn("Failed to restore config from session map:", e);
      }
    }
    return config;
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSortIndividuals, setShowSortIndividuals] = useState(false);
  const [highlightedActivityId, setHighlightedActivityId] = useState<string | null>(null);

  // Restore from sessionStorage on mount
  const didRestore = useRef(false);
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const restored = loadTTL(stored);
        if (restored instanceof Error) {
          console.warn("Failed to restore session data:", restored);
        } else {
          setDataset(restored);
        }
      }

      const storedHistory = sessionStorage.getItem(HISTORY_SESSION_KEY);
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory) as {
          undoHistory?: SerializedHistoryEntry[];
          redoHistory?: SerializedHistoryEntry[];
        };
        const restoredUndoHistory = (parsed.undoHistory || [])
          .map(deserializeHistoryEntry)
          .filter((entry): entry is HistoryEntry<Model> => !!entry);
        const restoredRedoHistory = (parsed.redoHistory || [])
          .map(deserializeHistoryEntry)
          .filter((entry): entry is HistoryEntry<Model> => !!entry);
        setUndoHistory(restoredUndoHistory);
        setRedoHistory(restoredRedoHistory);
      }
    } catch (e) {
      console.warn("Failed to read session storage:", e);
    }
  }, []);

  // Persist to sessionStorage whenever dataset changes
  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    try {
      const ttl = saveTTL(dataset);
      sessionStorage.setItem(SESSION_KEY, ttl);
    } catch (e) {
      console.warn("Failed to save session storage:", e);
    }
  }, [dataset]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("activity-editor-config", JSON.stringify(configData));
      } catch (e) {
        console.warn("Failed to save config session storage:", e);
      }
    }
  }, [configData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        HISTORY_SESSION_KEY,
        JSON.stringify({
          undoHistory: undoHistory.map(serializeHistoryEntry),
          redoHistory: redoHistory.map(serializeHistoryEntry),
        })
      );
    } catch (e) {
      console.warn("Failed to save history session storage:", e);
    }
  }, [undoHistory, redoHistory]);

  useEffect(() => {
    setHighlightedActivityId(null);
  }, [activityContext]);

  const updateDataset = useCallback((updater: Dispatch<Model>) => {
    setDataset((prevDataset) => {
      const d = prevDataset.clone();
      updater(d);
      const details = generateHistoryDetails(prevDataset, d);
      setUndoHistory((prevHistory) => {
        if (prevHistory.length > 0 && prevHistory[0].model === prevDataset) return prevHistory;
        return [{ model: prevDataset, ...details }, ...prevHistory.slice(0, 49)];
      });
      setRedoHistory([]);
      setDirty(true);
      return d;
    });
  }, []);
  /* Callers of this function must also handle the dirty flag. */
  const replaceDataset = (d: Model) => {
    setUndoHistory([]);
    setRedoHistory([]);
    setActivityContext(undefined);
    setDataset(d);
  };
  const undo = () => {
    if (undoHistory.length === 0) return;
    const [entry, ...remainingHistory] = undoHistory;
    setRedoHistory((prevHistory) => [{ ...entry, model: dataset }, ...prevHistory.slice(0, 49)]);
    setDataset(entry.model);
    setUndoHistory(remainingHistory);
    setDirty(true);
  };
  const redo = () => {
    if (redoHistory.length === 0) return;
    const [entry, ...remainingHistory] = redoHistory;
    setUndoHistory((prevHistory) => [{ ...entry, model: dataset }, ...prevHistory.slice(0, 49)]);
    setDataset(entry.model);
    setRedoHistory(remainingHistory);
    setDirty(true);
  };
  const undoTo = (index: number) => {
    if (index < 0 || index >= undoHistory.length) return;
    const newRedoEntries: HistoryEntry<Model>[] = [];
    let currentModel = dataset;
    for (let j = 0; j <= index; j++) {
      newRedoEntries.unshift({ ...undoHistory[j], model: currentModel });
      currentModel = undoHistory[j].model;
    }
    setRedoHistory((prev) => [...newRedoEntries, ...prev].slice(0, 50));
    setDataset(currentModel);
    setUndoHistory((prev) => prev.slice(index + 1));
    setDirty(true);
  };
  const redoTo = (index: number) => {
    if (index < 0 || index >= redoHistory.length) return;
    const newUndoEntries: HistoryEntry<Model>[] = [];
    let currentModel = dataset;
    for (let j = 0; j <= index; j++) {
      newUndoEntries.push({ ...redoHistory[j], model: currentModel });
      currentModel = redoHistory[j].model;
    }
    newUndoEntries.reverse();
    setUndoHistory((prev) => [...newUndoEntries, ...prev].slice(0, 50));
    setDataset(currentModel);
    setRedoHistory((prev) => prev.slice(index + 1));
    setDirty(true);
  };
  const clearDiagram = () => {
    if (dataset.individuals.size === 0 && dataset.activities.size === 0) return;

    const clearedModel = new Model();
    const clearedAt = new Date().toLocaleString();
    const details = createHistoryDetails(
      "Clear Diagram",
      `Cleared at ${clearedAt} (${dataset.individuals.size} ${dataset.individuals.size === 1 ? "entity" : "entities"}, ${dataset.activities.size} ${dataset.activities.size === 1 ? "activity" : "activities"})`,
      `Restore diagram cleared at ${clearedAt}`,
      `Apply clear from ${clearedAt}`
    );

    setUndoHistory((prevHistory) => [{ model: dataset, ...details }, ...prevHistory.slice(0, 49)]);
    setRedoHistory([]);
    setActivityContext(undefined);
    setDataset(clearedModel);
    setDirty(true);
  };

  const svgRef = useRef<SVGSVGElement>(null);

  const deleteIndividual = (id: string) => {
    updateDataset((d: Model) => d.removeIndividual(id));
  };

  const sanitizeAllInstallations = (d: Model) => {
    const allIndividuals = Array.from(d.individuals.values());

    allIndividuals.forEach((individual) => {
      if (getEntityTypeIdFromIndividual(individual) !== ENTITY_TYPE_IDS.INDIVIDUAL) {
        return;
      }

      const ownStart = normalizeStart(individual.beginning);
      const ownEnd = normalizeEnd(individual.ending);

      const sanitizedInstallations = getInstallationPeriods(individual)
        .map((period) => {
          const component = d.individuals.get(period.systemComponentId);
          if (
            !component ||
            getEntityTypeIdFromIndividual(component) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT
          ) {
            return null;
          }

          let validStart = normalizeStart(component.beginning);
          let validEnd = normalizeEnd(component.ending);

          // If component is hosted by a system, installation is only valid while
          // the host system exists.
          if (component.installedIn) {
            const host = d.individuals.get(component.installedIn);
            if (
              host &&
              getEntityTypeIdFromIndividual(host) === ENTITY_TYPE_IDS.SYSTEM
            ) {
              validStart = Math.max(validStart, normalizeStart(host.beginning));
              validEnd = Math.min(validEnd, normalizeEnd(host.ending));
            }
          }

          const beginning = Math.max(period.beginning, validStart, ownStart);
          const ending = Math.min(period.ending, validEnd, ownEnd);

          if (ending <= beginning) {
            return null;
          }

          return {
            ...period,
            beginning,
            ending,
          };
        })
        .filter((period): period is NonNullable<typeof period> => !!period)
        .sort((a, b) => a.beginning - b.beginning);

      const synced = syncLegacyInstallationFields({
        ...individual,
        installations: sanitizedInstallations,
      });

      d.addIndividual(synced);
    });
  };

  const setIndividual = (individual: Individual) => {
    updateDataset((d: Model) => {
      d.addIndividual(individual);
      sanitizeAllInstallations(d);
    });
  };
  const deleteActivity = (id: string) => {
    updateDataset((d: Model) => d.removeActivity(id));
  };
  const setActivity = (activity: Activity) => {
    updateDataset((d: Model) => d.addActivity(activity));
  };

  const clickIndividual = useCallback((i: Individual) => {
    setSelectedIndividual(i);
    setShowIndividual(true);
  }, []);
  const clickActivity = useCallback((a: Activity) => {
    setSelectedActivity(a);
    setShowActivity(true);
  }, []);
  const clickParticipation = useCallback((a: Activity, p: Participation) => {
    setSelectedActivity(a);
    setSelectedParticipation(p);
    setShowParticipation(true);
  }, []);

  const rightClickIndividual = useCallback((i: Individual) => {
    console.log("Individual right clicked. Functionality can be added here.");
  }, []);
  const rightClickActivity = useCallback((a: Activity) => {
    console.log("Activity right clicked. Functionality can be added here.");
  }, []);
  const rightClickParticipation = useCallback((a: Activity, p: Participation) => {
    console.log(
      "Participation right clicked. Functionality can be added here."
    );
  }, []);

  const individualsArray: Individual[] = [];
  dataset.individuals.forEach((i: Individual) => individualsArray.push(i));

  const activitiesArray: Activity[] = [];
  dataset.activities.forEach((a: Activity) => activitiesArray.push(a));

  const reorderIndividuals = useCallback((orderedIds: string[]) => {
    updateDataset((d: Model) => {
      const current = Array.from(d.individuals.values());
      const byId = new Map(current.map((individual) => [individual.id, individual]));
      const seen = new Set<string>();
      const reordered: Individual[] = [];

      orderedIds.forEach((id) => {
        const individual = byId.get(id);
        if (!individual) return;
        reordered.push(individual);
        seen.add(id);
      });

      current.forEach((individual) => {
        if (!seen.has(individual.id)) reordered.push(individual);
      });

      // Normalize: ensure system components stay grouped under their parent system
      const systems = new Set(
        reordered
          .filter((item) => getEntityTypeIdFromIndividual(item) === ENTITY_TYPE_IDS.SYSTEM)
          .map((item) => item.id)
      );

      const componentsBySystem = new Map<string, Individual[]>();
      reordered.forEach((item) => {
        if (getEntityTypeIdFromIndividual(item) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) return;
        if (!item.installedIn || !systems.has(item.installedIn)) return;
        const list = componentsBySystem.get(item.installedIn);
        if (list) list.push(item);
        else componentsBySystem.set(item.installedIn, [item]);
      });

      const normalized: Individual[] = [];
      const emitted = new Set<string>();
      reordered.forEach((item) => {
        if (emitted.has(item.id)) return;
        const type = getEntityTypeIdFromIndividual(item);
        if (
          type === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
          item.installedIn &&
          systems.has(item.installedIn)
        ) {
          return; // will be emitted after parent system
        }
        normalized.push(item);
        emitted.add(item.id);
        if (type === ENTITY_TYPE_IDS.SYSTEM) {
          (componentsBySystem.get(item.id) ?? []).forEach((child) => {
            if (!emitted.has(child.id)) {
              normalized.push(child);
              emitted.add(child.id);
            }
          });
        }
      });

      d.individuals.clear();
      normalized.forEach((individual) => {
        d.individuals.set(individual.id, individual);
      });
    });
  }, [updateDataset]);

  const renameIndividual = useCallback((id: string, newName: string) => {
    updateDataset((d: Model) => {
      const individual = d.individuals.get(id);
      if (individual) {
        d.addIndividual({ ...individual, name: newName });
      }
    });
  }, [updateDataset]);

  // Filter activities for the current context
  let activitiesInView: Activity[] = [];
  if (activityContext) {
    // Only include activities that are part of the current context
    activitiesInView = activitiesArray.filter(
      (a) => a.partOf === activityContext
    );
  } else {
    // Top-level activities (no parent)
    activitiesInView = activitiesArray.filter((a) => !a.partOf);
  }

  const partsCountMap: Record<string, number> = {};
  activitiesInView.forEach((a) => {
    partsCountMap[a.id] =
      typeof dataset.getPartsCount === "function"
        ? dataset.getPartsCount(a.id)
        : 0;
  });

  const selectedActivityIndex = selectedActivity
    ? activitiesInView.findIndex((a) => a.id === selectedActivity.id)
    : -1;
  const selectedActivityAutoColor =
    selectedActivityIndex >= 0
      ? configData.presentation.activity.fill[
          selectedActivityIndex % configData.presentation.activity.fill.length
        ]
      : configData.presentation.activity.fill[
          activitiesInView.length % configData.presentation.activity.fill.length
        ];

  const isDiagramEmpty = dataset.individuals.size === 0 && dataset.activities.size === 0;

  // render
  return (
    <>
      <Container fluid>
        <div className={`editor-layout ${isDiagramEmpty ? "is-empty" : ""}`}>
          <div className="editor-legend">
            <div className="legend-sticky">
              <EntityTypeLegend />
              <DiagramLegend
                activities={activitiesInView}
                activityColors={configData.presentation.activity.fill}
                partsCount={partsCountMap}
                onOpenActivity={(a) => {
                  setSelectedActivity(a);
                  setShowActivity(true);
                }}
                highlightedActivityId={highlightedActivityId}
                onHighlightActivity={(id) =>
                  setHighlightedActivityId((prev) => (prev === id ? null : id))
                }
              />
            </div>
          </div>
          <div className="editor-diagram">
            {isDiagramEmpty ? (
              <div className="editor-empty-shell w-100 h-100 overflow-auto">
                <div className="container py-3 py-md-4">
                  <div className="empty-state-stage">
                    <div className="empty-state-hero">
                      <div className="empty-state-card empty-state-surface mr-md-3 pt-3 px-3 pt-md-5 px-md-5 text-center overflow-hidden h-100">
                        <div className="my-3 p-3">
                          <h2 className="display-4">Activity Diagram Editor</h2>
                          <p className="lead">
                            Your diagram is empty, but the canvas does not have to stay quiet for long.
                            Start with an entity, pull in an example, or load a TTL file and bring the model to life.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="empty-state-illustration" aria-hidden="true">
                      <div className="empty-state-board empty-state-board-illustration">
                        <span className="empty-state-board-top">Top</span>
                        <span className="empty-state-board-axis empty-state-board-axis-y"></span>
                        <span className="empty-state-board-axis empty-state-board-axis-x"></span>
                        <span className="empty-state-board-label empty-state-board-label-space">Space</span>
                        <span className="empty-state-board-label empty-state-board-label-time">Time</span>
                        <div className="empty-state-board-chalk" aria-hidden="true">
                          <span className="empty-state-eraser"></span>
                          <span className="empty-state-chalk-stick empty-state-chalk-stick-1"></span>
                          <span className="empty-state-chalk-stick empty-state-chalk-stick-2"></span>
                          <span className="empty-state-chalk-stick empty-state-chalk-stick-3"></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="row pt-3 pt-md-4">
                    <div className="col-md">
                      <div className="empty-state-card empty-state-surface mr-md-3 pt-3 px-3 pt-md-5 px-md-5 text-center overflow-hidden h-100">
                        <div className="my-3 p-3">
                          <h2 className="display-5">Learn</h2>
                          <p className="lead">
                            Read the editor guide to learn terminology, settings,
                            navigation, and how to create your first model.
                          </p>
                          <Link href="/manual" className="btn btn-outline-secondary">
                            Open Editor Guide
                          </Link>
                        </div>
                        <div className="empty-state-card-accent box-shadow mx-auto"></div>
                      </div>
                    </div>
                    <div className="col-md">
                      <div className="empty-state-card empty-state-surface mr-md-3 pt-3 px-3 pt-md-5 px-md-5 text-center overflow-hidden h-100">
                        <div className="my-3 p-3">
                          <h2 className="display-5">Start Modelling</h2>
                          <p className="lead">
                            Create the first entity or load an existing model to populate the workspace.
                          </p>
                          <div className="empty-state-actions">
                            <SetIndividual
                              deleteIndividual={deleteIndividual}
                              setIndividual={setIndividual}
                              show={showIndividual}
                              setShow={setShowIndividual}
                              selectedIndividual={selectedIndividual}
                              setSelectedIndividual={setSelectedIndividual}
                              dataset={dataset}
                              updateDataset={updateDataset}
                              triggerVariant="outline-secondary"
                              triggerClassName=""
                            />
                            <DiagramPersistence
                              dataset={dataset}
                              setDataset={replaceDataset}
                              svgRef={svgRef}
                              setDirty={setDirty}
                              showSaveButton={false}
                              showReferenceToggle={false}
                              className="empty-persistence"
                              buttonVariant="outline-secondary"
                            />
                          </div>
                        </div>
                        <div className="empty-state-card-accent box-shadow mx-auto"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <ActivityDiagram
                dataset={dataset}
                configData={configData}
                setConfigData={setConfigData}
                activityContext={activityContext}
                setActivityContext={setActivityContext}
                clickIndividual={clickIndividual}
                clickActivity={clickActivity}
                clickParticipation={clickParticipation}
                rightClickIndividual={rightClickIndividual}
                rightClickActivity={rightClickActivity}
                rightClickParticipation={rightClickParticipation}
                svgRef={svgRef}
                hideNonParticipating={compactMode}
                highlightedActivityId={highlightedActivityId}
                onReorderIndividuals={reorderIndividuals}
                renameIndividual={renameIndividual}
              />
            )}
          </div>

          <div className={`editor-toolbar ${isDiagramEmpty ? "d-none" : ""}`}>
            <div className="toolbar-group">
            {!isDiagramEmpty && (
              <SetIndividual
                deleteIndividual={deleteIndividual}
                setIndividual={setIndividual}
                show={showIndividual}
                setShow={setShowIndividual}
                selectedIndividual={selectedIndividual}
                setSelectedIndividual={setSelectedIndividual}
                dataset={dataset}
                updateDataset={updateDataset}
              />
            )}
            <SetActivity
              show={showActivity}
              setShow={setShowActivity}
              selectedActivity={selectedActivity}
              setSelectedActivity={setSelectedActivity}
              individuals={individualsArray}
              dataset={dataset}
              updateDataset={updateDataset}
              activityContext={activityContext}
              setActivityContext={setActivityContext}
              autoActivityColor={selectedActivityAutoColor}
            />
            <SetParticipation
              setActivity={setActivity}
              show={showParticipation}
              setShow={setShowParticipation}
              selectedActivity={selectedActivity}
              setSelectedActivity={setSelectedActivity}
              selectedParticipation={selectedParticipation}
              setSelectedParticipation={setSelectedParticipation}
              dataset={dataset}
              updateDataset={updateDataset}
            />
            <SortIndividuals
              dataset={dataset}
              updateDataset={updateDataset}
              showSortIndividuals={showSortIndividuals}
              setShowSortIndividuals={setShowSortIndividuals}
            />
            <HideIndividuals
              compactMode={compactMode}
              setCompactMode={setCompactMode}
              dataset={dataset}
              activitiesInView={activitiesInView}
            />
            </div>

            <div className="toolbar-group toolbar-center">
              <DiagramPersistence
                dataset={dataset}
                setDataset={replaceDataset}
                svgRef={svgRef}
                setDirty={setDirty}
              />
            </div>

            <div className="toolbar-group">
              <Undo
                hasUndo={undoHistory.length > 0}
                hasRedo={redoHistory.length > 0}
                undo={undo}
                redo={redo}
                clearDiagram={clearDiagram}
                undoHistory={undoHistory}
                redoHistory={redoHistory}
                undoTo={undoTo}
                redoTo={redoTo}
              />
              <SetConfig
                configData={configData}
                setConfigData={setConfigData}
                showConfigModal={showConfigModal}
                setShowConfigModal={setShowConfigModal}
              />
              <ExportSvg dataset={dataset} svgRef={svgRef} />
              <ExportJson dataset={dataset} />
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}