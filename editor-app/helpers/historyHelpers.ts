import { config } from "@/diagram/config";
import { HistoryEntry } from "@/components/Undo";
import { Model } from "@/lib/Model";
import { Activity, Individual, Participation, findParticipationsForIndividual } from "@/lib/Schema";
import {
  ENTITY_TYPE_IDS,
  getEntityTypeIdFromIndividual,
  getEntityTypeLabel,
} from "@/lib/entityTypes";
import {
  getInstallationPeriods,
  normalizeEnd,
  normalizeStart,
} from "@/utils/installations";
import { save as saveTTL, load as loadTTL } from "@/lib/ActivityLib";

export type SerializedHistoryEntry = {
  modelTtl: string;
  category: string;
  description: string;
  undoLabel: string;
  redoLabel: string;
};

export function createHistoryDetails(
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
    fragment.startsWith("Changed bounds of ") ||
    fragment.startsWith("Added installation ") ||
    fragment.startsWith("Removed installation ") ||
    fragment.startsWith("Moved installation ") ||
    fragment.startsWith("Changed installation ") ||
    fragment.startsWith("Updated installations ")
  );
}

function isTimingCascadeDriverFragment(fragment: string) {
  return fragment.startsWith("Changed bounds of ");
}

function isInstallationCascadeDriverFragment(fragment: string) {
  return (
    fragment.startsWith("Added installation ") ||
    fragment.startsWith("Removed installation ") ||
    fragment.startsWith("Moved installation ") ||
    fragment.startsWith("Changed installation ") ||
    fragment.startsWith("Updated installations ")
  );
}

function getPreferredCascadeDriverFragment(fragments: string[]) {
  const timingFragment = fragments.find(isTimingCascadeDriverFragment);
  if (timingFragment) {
    return timingFragment;
  }

  return fragments.length === 1 ? fragments[0] : undefined;
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

function getResolvedIndividualLabel(
  primaryModel: Model,
  individualId: string | undefined,
  secondaryModel?: Model
) {
  if (!individualId) return "Unknown individual";

  const primaryName = primaryModel.individuals.get(individualId)?.name;
  if (primaryName) return primaryName;

  const secondaryName = secondaryModel?.individuals.get(individualId)?.name;
  if (secondaryName) return secondaryName;

  return individualId;
}

function getParticipationInstallationRanges(
  model: Model,
  participation: Participation,
  activity?: Activity
) {
  if (!participation.systemComponentId) {
    return undefined;
  }

  const individual = model.individuals.get(participation.individualId);
  if (!individual) {
    return undefined;
  }

  const componentPeriods = getInstallationPeriods(individual).filter(
    (period) => period.systemComponentId === participation.systemComponentId
  );

  if (componentPeriods.length === 0) {
    return undefined;
  }

  if (!activity) {
    return componentPeriods.map((period) => formatRange(period.beginning, period.ending));
  }

  const participationRange = getParticipationEffectiveRange(activity, participation);
  const matchingPeriods = componentPeriods.filter(
    (period) =>
      participationRange.beginning >= period.beginning &&
      participationRange.ending <= period.ending
  );

  const resolvedPeriods = matchingPeriods.length > 0 ? matchingPeriods : componentPeriods;
  return resolvedPeriods.map((period) => formatRange(period.beginning, period.ending));
}

function getParticipationHistoryLabel(
  model: Model,
  participation: Participation,
  activity?: Activity
) {
  const individualName = getIndividualLabel(model, participation.individualId);
  const individual = model.individuals.get(participation.individualId);

  if (!participation.systemComponentId) {
    if (!activity) {
      return `"${individualName}"`;
    }

    return `"${individualName} (${formatRange(
      individual?.beginning ?? 0,
      individual?.ending ?? Model.END_OF_TIME
    )})"`;
  }

  const component = model.individuals.get(participation.systemComponentId);
  const componentName = component?.name || participation.systemComponentId;
  const installationRanges = getParticipationInstallationRanges(
    model,
    participation,
    activity
  );
  const componentRange = installationRanges && installationRanges.length > 0
    ? installationRanges.join(", ")
    : formatRange(
        component?.beginning ?? 0,
        component?.ending ?? Model.END_OF_TIME
      );

  return `"${individualName}" installed in "${componentName}" (${componentRange})`;
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

export function formatExtentRange(beginning: number, ending: number) {
  return `(${formatRange(beginning, ending)})`;
}

function formatEntityWithTimeline(name: string, individual: Individual | undefined) {
  if (!individual) {
    return name;
  }
  return `${name} ${formatExtentRange(individual.beginning, individual.ending)}`;
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

  const participantNames = Array.from(activity.participations.values()).map((participation) =>
    getParticipationHistoryLabel(model, participation, activity)
  );

  return `with participants:\n${participantNames.join("\n")}`;
}

function formatParticipationChangeDescription(
  action: "Added" | "Removed",
  model: Model,
  activity: Activity,
  entries: Array<[string, Participation]>
) {
  const preposition = action === "Added" ? "to" : "from";
  const activityLabel = `activity "${activity.name}" (${formatRange(activity.beginning, activity.ending)})`;
  const labels = entries.map(([, participation]) =>
    getParticipationHistoryLabel(model, participation, activity)
  );

  if (labels.length === 1) {
    return `${action} participant ${labels[0]} ${preposition} ${activityLabel}`;
  }

  return `${action} participants ${preposition} ${activityLabel}:\n${labels.join("\n")}`;
}

type ParsedParticipationChangeFragment = {
  action: "Added" | "Removed";
  activityName: string;
  activityRange?: string;
  labels: string[];
};

function parseParticipationChangeFragment(fragment: string): ParsedParticipationChangeFragment | undefined {
  const multiMatch = fragment.match(
    /^(Added|Removed) participants (to|from) activity "([^"]+)"(?: \(([^)]+)\))?:\n([\s\S]+)$/
  );
  if (multiMatch) {
    const [, action, , activityName, activityRange, labelsBlock] = multiMatch;
    const labels = labelsBlock
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (labels.length === 0) {
      return undefined;
    }

    return {
      action: action as "Added" | "Removed",
      activityName,
      activityRange,
      labels,
    };
  }

  const singleMatch = fragment.match(
    /^(Added|Removed) participant (.+) (to|from) activity "([^"]+)"(?: \(([^)]+)\))?$/
  );
  if (singleMatch) {
    const [, action, label, , activityName, activityRange] = singleMatch;
    return {
      action: action as "Added" | "Removed",
      activityName,
      activityRange,
      labels: [label.trim()],
    };
  }

  return undefined;
}

function mergeParticipationChangeFragments(fragments: string[]) {
  const grouped = new Map<string, ParsedParticipationChangeFragment>();
  const mergedOrder: string[] = [];

  for (const fragment of fragments) {
    const parsed = parseParticipationChangeFragment(fragment);
    if (!parsed) {
      return undefined;
    }

    const groupKey = `${parsed.action}::${parsed.activityName}::${parsed.activityRange ?? ""}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        ...parsed,
        labels: [...parsed.labels],
      });
      mergedOrder.push(groupKey);
      continue;
    }

    const existing = grouped.get(groupKey)!;
    parsed.labels.forEach((label) => {
      if (!existing.labels.includes(label)) {
        existing.labels.push(label);
      }
    });
  }

  return mergedOrder.map((groupKey) => {
    const entry = grouped.get(groupKey)!;
    const preposition = entry.action === "Added" ? "to" : "from";
    const activityLabel = entry.activityRange
      ? `activity "${entry.activityName}" (${entry.activityRange})`
      : `activity "${entry.activityName}"`;

    if (entry.labels.length === 1) {
      return `${entry.action} participant ${entry.labels[0]} ${preposition} ${activityLabel}`;
    }

    return `${entry.action} participants ${preposition} ${activityLabel}:\n${entry.labels.join("\n")}`;
  });
}

export function formatQuotedList(items: string[]) {
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
      `Removed ${installations.length === 1 ? "installation" : "installations"} for "${ownerName}": ${installations.join(", ")}`
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

export function buildRemovalHistoryDetails(model: Model, removedId: string) {
  const entityCopy = getEntityHistoryCopy(model.individuals.get(removedId), removedId);
  const cascade = getRemovalCascadeCopy(model, removedId);
  const primaryFragment = `Removed ${entityCopy.noun} ${formatEntityWithExtent(model, removedId)}`;
  const sideEffectFragments: string[] = [];
  const summaryParts: string[] = [];

  if (cascade.removedComponentNames.length > 0) {
    sideEffectFragments.push(
      `Removed ${cascade.removedComponentNames.length === 1 ? "system component" : "system components"} ${formatQuotedList(cascade.removedComponentNames)}`
    );
    summaryParts.push(
      `${cascade.removedComponentNames.length} system component${cascade.removedComponentNames.length === 1 ? "" : "s"}`
    );
  }

  if (cascade.removedInstallations.length > 0) {
    sideEffectFragments.push(...summarizeRemovedInstallations(model, cascade.removedInstallations));
    summaryParts.push(
      `${cascade.removedInstallations.length} installation${cascade.removedInstallations.length === 1 ? "" : "s"}`
    );
  }

  if (cascade.removedActivities.length > 0) {
    sideEffectFragments.push(
      `Removed ${cascade.removedActivities.length === 1 ? "activity" : "activities"} ${formatQuotedList(cascade.removedActivities)}`
    );
    summaryParts.push(
      `${cascade.removedActivities.length} activit${cascade.removedActivities.length === 1 ? "y" : "ies"}`
    );
  }

  const summaryText =
    summaryParts.length > 0 ? ` and ${summaryParts.join(", ")}` : "";

  return createHistoryDetails(
    entityCopy.category,
    buildCascadingHistoryDescription([], primaryFragment, sideEffectFragments),
    `Restore ${entityCopy.noun} "${entityCopy.name}"${summaryText}`,
    `Remove ${entityCopy.noun} "${entityCopy.name}"${summaryText}`
  );
}

export function formatRange(beginning: number, ending: number) {
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

function formatInstallationPeriodSummaryAcrossModels(
  primaryModel: Model,
  period: ReturnType<typeof getInstallationPeriods>[number],
  secondaryModel?: Model
) {
  const componentName = getResolvedIndividualLabel(
    primaryModel,
    period.systemComponentId,
    secondaryModel
  );
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

function summarizePeriodsByComponentAcrossModels(
  primaryModel: Model,
  periods: ReturnType<typeof getInstallationPeriods>,
  secondaryModel?: Model
) {
  const rangesByComponent = new Map<string, string[]>();

  periods.forEach((period) => {
    const componentName = getResolvedIndividualLabel(
      primaryModel,
      period.systemComponentId,
      secondaryModel
    );
    const ranges = rangesByComponent.get(componentName) || [];
    ranges.push(formatRange(period.beginning, period.ending));
    rangesByComponent.set(componentName, ranges);
  });

  return Array.from(rangesByComponent.entries()).map(
    ([componentName, ranges]) => `"${componentName}" (${ranges.join(", ")})`
  );
}

export function getEffectiveActivityColor(model: Model, activityId: string) {
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
    const componentName = getResolvedIndividualLabel(
      newModel,
      period.systemComponentId,
      oldModel
    );
    return createHistoryDetails(
      "Installation",
      `Added installation for "${individualName}" in "${componentName}" (${formatRange(period.beginning, period.ending)})`,
      `Remove installation for "${individualName}" from "${componentName}"`,
      `Add installation for "${individualName}" in "${componentName}"`
    );
  }

  if (removed.length === 1 && added.length === 0 && changed.length === 0) {
    const period = removed[0];
    const componentName = getResolvedIndividualLabel(
      oldModel,
      period.systemComponentId,
      newModel
    );
    return createHistoryDetails(
      "Installation",
      `Removed installation for "${individualName}" from "${componentName}" (${formatRange(period.beginning, period.ending)})`,
      `Restore installation for "${individualName}" in "${componentName}"`,
      `Remove installation for "${individualName}" from "${componentName}"`
    );
  }

  if (changed.length === 1 && added.length === 0 && removed.length === 0) {
    const { previous, next } = changed[0];
    const previousComponentName = getResolvedIndividualLabel(
      oldModel,
      previous.systemComponentId,
      newModel
    );
    const nextComponentName = getResolvedIndividualLabel(
      newModel,
      next.systemComponentId,
      oldModel
    );
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
      `Changed installation period for "${individualName}" in "${nextComponentName}" (beginning ${normalizeStart(previous.beginning)} → ${normalizeStart(next.beginning)}, ending ${normalizeEnd(previous.ending) >= Model.END_OF_TIME ? "∞" : normalizeEnd(previous.ending)} → ${normalizeEnd(next.ending) >= Model.END_OF_TIME ? "∞" : normalizeEnd(next.ending)})`,
      `Restore previous installation period for "${individualName}"`,
      `Apply new installation period for "${individualName}"`
    );
  }

  if (added.length > 0 || removed.length > 0 || changed.length > 0) {
    const parts: string[] = [];
    if (added.length > 0) parts.push(`${added.length} added`);
    if (removed.length > 0) parts.push(`${removed.length} removed`);
    if (changed.length > 0) parts.push(`${changed.length} updated`);

    const detailParts: string[] = [];
    const groupedAdded = summarizePeriodsByComponentAcrossModels(newModel, added, oldModel);
    if (groupedAdded.length > 0) {
      detailParts.push(`added ${groupedAdded.join("; ")}`);
    }

    const groupedRemoved = summarizePeriodsByComponentAcrossModels(oldModel, removed, newModel);
    if (groupedRemoved.length > 0) {
      detailParts.push(`removed ${groupedRemoved.join("; ")}`);
    }

    changed.forEach(({ previous, next }) => {
      detailParts.push(
        `updated ${formatInstallationPeriodSummaryAcrossModels(oldModel, previous, newModel)} → ${formatInstallationPeriodSummaryAcrossModels(newModel, next, oldModel)}`
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
        `Changed bounds of activity "${newActivity.name}" (${formatRange(oldActivity.beginning, oldActivity.ending)} → ${formatRange(newActivity.beginning, newActivity.ending)})`
      );
    }
  }

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
      const fragment = `Changed bounds of ${entityCopy.noun} "${entityCopy.name}" (${formatRange(oldIndividual.beginning, oldIndividual.ending)} → ${formatRange(newIndividual.beginning, newIndividual.ending)})`;
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

  const mergedParticipationFragments = mergeParticipationChangeFragments(combinedFragments);
  if (mergedParticipationFragments && mergedParticipationFragments.length === 1) {
    return createHistoryDetails(
      "Participation",
      mergedParticipationFragments[0],
      "Restore previous participation edits",
      "Reapply participation edits"
    );
  }

  if (primaryEntity && combinedFragments.length >= 2) {
    const primaryDirectFragments = primaryEntity.directFragments.filter((fragment) =>
      combinedFragments.includes(fragment)
    );

    const cascadeDriverFragments = primaryDirectFragments.filter(isCascadeDriverFragment);

    const primaryFragment = getPreferredCascadeDriverFragment(cascadeDriverFragments);

    if (primaryFragment) {
      const installationSideEffects = isTimingCascadeDriverFragment(primaryFragment)
        ? primaryDirectFragments.filter(
            (fragment) =>
              fragment !== primaryFragment && isInstallationCascadeDriverFragment(fragment)
          )
        : [];

      const prefixFragments = primaryDirectFragments.filter(
        (fragment) => fragment !== primaryFragment && !installationSideEffects.includes(fragment)
      );
      const sideEffectFragments = [
        ...installationSideEffects,
        ...combinedFragments.filter((fragment) => !primaryDirectFragments.includes(fragment)),
      ].filter((fragment, index, list) => list.indexOf(fragment) === index);

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
    const oldEntries = oldActivity ? findParticipationsForIndividual(oldActivity.participations, individualId) : [];
    const newEntries = newActivity ? findParticipationsForIndividual(newActivity.participations, individualId) : [];
    const activityName = newActivity?.name || oldActivity?.name || activityId;
    const oldByKey = new Map(oldEntries);
    const newByKey = new Map(newEntries);
    const oldPlainEntry = oldEntries.find(([, participation]) => !participation.systemComponentId);
    const newPlainEntry = newEntries.find(([, participation]) => !participation.systemComponentId);
    const removedInstalledEntries = oldEntries.filter(
      ([key, participation]) => !!participation.systemComponentId && !newByKey.has(key)
    );
    const addedInstalledEntries = newEntries.filter(
      ([key, participation]) => !!participation.systemComponentId && !oldByKey.has(key)
    );

    if (oldEntries.length > 0 && newEntries.length === 0) {
      if (!oldActivity) {
        return;
      }
      fragments.push(
        formatParticipationChangeDescription("Removed", oldModel, oldActivity, oldEntries)
      );
      return;
    }

    if (oldEntries.length === 0 && newEntries.length > 0) {
      if (!newActivity) {
        return;
      }
      fragments.push(
        formatParticipationChangeDescription("Added", newModel, newActivity, newEntries)
      );
      return;
    }

    if (oldActivity && newActivity) {
      removedInstalledEntries.forEach(([, oldParticipation]) => {
        if (!newPlainEntry) return;

        const oldRange = getParticipationEffectiveRange(oldActivity, oldParticipation);
        const newRange = getParticipationEffectiveRange(newActivity, newPlainEntry[1]);

        if (
          oldRange.beginning === newRange.beginning &&
          oldRange.ending === newRange.ending
        ) {
          const fragment =
            `Kept participant "${individualName}" in "${activityName}" on the individual timeline (${formatRange(newRange.beginning, newRange.ending)})`;
          if (!fragments.includes(fragment)) {
            fragments.push(fragment);
          }
        }
      });

      addedInstalledEntries.forEach(([, newParticipation]) => {
        if (!oldPlainEntry) return;

        const oldRange = getParticipationEffectiveRange(oldActivity, oldPlainEntry[1]);
        const newRange = getParticipationEffectiveRange(newActivity, newParticipation);

        if (
          oldRange.beginning === newRange.beginning &&
          oldRange.ending === newRange.ending
        ) {
          const fragment =
            `Moved participant "${individualName}" in "${activityName}" into an installation timeline (${formatRange(newRange.beginning, newRange.ending)})`;
          if (!fragments.includes(fragment)) {
            fragments.push(fragment);
          }
        }
      });
    }

    if (oldEntries.length === 0 || newEntries.length === 0 || !oldActivity || !newActivity) {
      return;
    }

    const oldParticipation = oldEntries[0][1];
    const newParticipation = newEntries[0][1];

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
        `Changed participation bounds for "${individualName}" in "${activityName}" (${formatRange(oldRange.beginning, oldRange.ending)} → ${formatRange(newRange.beginning, newRange.ending)})`
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
      fragment.startsWith("Changed participation bounds")
    );

    if (!timingFragment) continue;

    const individualName = getIndividualLabel(newModel, individualId);
    return createHistoryDetails(
      "Participation",
      timingFragment,
      `Restore previous participation bounds for "${individualName}"`,
      `Apply participation bounds change for "${individualName}"`
    );
  }

  return undefined;
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

    const oldParent = oldIndividual.installedIn
      ? oldModel.individuals.get(oldIndividual.installedIn)
      : undefined;
    const newParent = newIndividual.installedIn
      ? newModel.individuals.get(newIndividual.installedIn)
      : undefined;
    const oldParentName = oldParent
      ? getIndividualLabel(oldModel, oldParent.id)
      : "No system";
    const newParentName = newParent
      ? getIndividualLabel(newModel, newParent.id)
      : "No system";
    const entityCopy = getEntityHistoryCopy(newIndividual, id);
    const primaryFragment = `Moved system component "${formatEntityWithTimeline(entityCopy.name, newIndividual)}" from system "${formatEntityWithTimeline(oldParentName, oldParent)}" to system "${formatEntityWithTimeline(newParentName, newParent)}"`;
    const sideEffectFragments: string[] = [];

    if (
      oldIndividual.beginning !== newIndividual.beginning ||
      oldIndividual.ending !== newIndividual.ending
    ) {
      sideEffectFragments.push(
        `Changed bounds of ${entityCopy.noun} "${entityCopy.name}" (${formatRange(oldIndividual.beginning, oldIndividual.ending)} → ${formatRange(newIndividual.beginning, newIndividual.ending)})`
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
        sideEffectFragments.push(installationChange.description);
      }

      sideEffectFragments.push(
        ...getParticipationChangeFragmentsForIndividual(oldModel, newModel, otherId)
      );
    });

    const uniqueSideEffectFragments = sideEffectFragments.filter(
      (fragment, index) => sideEffectFragments.indexOf(fragment) === index
    );

    return createHistoryDetails(
      entityCopy.category,
      buildCascadingHistoryDescription([], primaryFragment, uniqueSideEffectFragments),
      uniqueSideEffectFragments.length > 0
        ? `Restore previous edits for "${entityCopy.name}"`
        : `Move system component "${entityCopy.name}" back to system "${oldParentName}"`,
      uniqueSideEffectFragments.length > 0
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

export function generateHistoryDetails(oldModel: Model, newModel: Model): Omit<HistoryEntry<Model>, "model"> {
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

  const combinedIndividualChange = summarizeCombinedIndividualChange(oldModel, newModel);
  if (combinedIndividualChange) return combinedIndividualChange;

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

        const oldParticipantKeys = new Set(oldAct.participations.keys());
        const newParticipantKeys = new Set(newAct.participations.keys());
        const addedEntries = Array.from(newAct.participations.entries()).filter(
          ([key]) => !oldParticipantKeys.has(key)
        );
        if (addedEntries.length > 0) {
          const participantCountLabel = addedEntries.length === 1 ? "participant" : "participants";
          return createHistoryDetails(
            "Participation",
            formatParticipationChangeDescription("Added", newModel, newAct, addedEntries),
            `Remove ${participantCountLabel} from "${newAct.name}"`,
            `Add ${participantCountLabel} to "${newAct.name}"`
          );
        }
        const removedEntries = Array.from(oldAct.participations.entries()).filter(
          ([key]) => !newParticipantKeys.has(key)
        );
        if (removedEntries.length > 0) {
          const participantCountLabel = removedEntries.length === 1 ? "participant" : "participants";
          return createHistoryDetails(
            "Participation",
            formatParticipationChangeDescription("Removed", oldModel, oldAct, removedEntries),
            `Restore ${participantCountLabel} in "${oldAct.name}"`,
            `Remove ${participantCountLabel} from "${oldAct.name}"`
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
            "Bounds",
            `Changed bounds of ${entityCopy.noun} "${entityCopy.name}" (${formatRange(oldInd.beginning, oldInd.ending)} → ${formatRange(newInd.beginning, newInd.ending)})`,
            `Restore previous bounds for ${entityCopy.noun} "${entityCopy.name}"`,
            `Apply bounds change for ${entityCopy.noun} "${entityCopy.name}"`
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
            "Bounds",
            `Changed bounds of activity "${newAct.name}" (${formatRange(oldAct.beginning, oldAct.ending)} → ${formatRange(newAct.beginning, newAct.ending)})`,
            `Restore previous bounds for activity "${newAct.name}"`,
            `Apply bounds change for activity "${newAct.name}"`
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

export function serializeHistoryEntry(entry: HistoryEntry<Model>): SerializedHistoryEntry {
  return {
    modelTtl: saveTTL(entry.model),
    category: entry.category,
    description: entry.description,
    undoLabel: entry.undoLabel,
    redoLabel: entry.redoLabel,
  };
}

export function deserializeHistoryEntry(entry: SerializedHistoryEntry): HistoryEntry<Model> | undefined {
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
