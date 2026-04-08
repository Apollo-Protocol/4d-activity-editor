import { Activity, InstallationPeriod, findParticipationsForIndividual, participationMapKey } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import { normalizeEnd, normalizeStart } from "@/utils/installations";
import type { AffectedActivity } from "@/types/setIndividualTypes";

export function formatBound(value: number, isBeginning: boolean) {
  if (isBeginning && value <= 0) return "0";
  if (!isBeginning && value >= Model.END_OF_TIME) return "∞";
  return String(value);
}

export function resolveCurrentAffectedParticipationKey(
  activity: Activity,
  affectedActivity: AffectedActivity
) {
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
}

export function findAffectedActivities(
  dataset: Model,
  entityId: string,
  entityName: string,
  newStart: number,
  newEnd: number,
  oldStart?: number,
  oldEnd?: number,
): AffectedActivity[] {
  const result: AffectedActivity[] = [];
  for (const act of Array.from(dataset.activities.values())) {
    const entries = findParticipationsForIndividual(act.participations, entityId);
    if (entries.length === 0) continue;
    for (const [pKey, participation] of entries) {
      const actStart = normalizeStart(participation?.beginning ?? act.beginning);
      const actEnd = normalizeEnd(participation?.ending ?? act.ending);
      const clampedStart = Math.max(actStart, newStart);
      const clampedEnd = Math.min(actEnd, newEnd);

      if (oldStart !== undefined && oldEnd !== undefined) {
        const oldClampedStart = Math.max(actStart, oldStart);
        const oldClampedEnd = Math.min(actEnd, oldEnd);
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
}

export function findAffectedActivitiesForInstallationPeriods(
  dataset: Model,
  entityId: string,
  entityName: string,
  oldPeriods: InstallationPeriod[],
  newPeriods: InstallationPeriod[]
): AffectedActivity[] {
  const result: AffectedActivity[] = [];

  for (const activity of Array.from(dataset.activities.values())) {
    const entries = findParticipationsForIndividual(activity.participations, entityId);
    if (entries.length === 0) continue;

    for (const [pKey, participation] of entries) {
      const activityStart = normalizeStart(
        participation?.beginning ?? activity.beginning
      );
      const activityEnd = normalizeEnd(participation?.ending ?? activity.ending);

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
}

export function markReturnToIndividualChanges(
  affectedActivities: AffectedActivity[]
): AffectedActivity[] {
  return affectedActivities.map((affectedActivity) =>
    affectedActivity.action === "drop"
      ? {
          ...affectedActivity,
          keepStrategy: "return-to-individual" as const,
        }
      : affectedActivity
  );
}

export function applyInstallationBoundsToPeriods(
  periods: InstallationPeriod[],
  componentBoundsById: Map<
    string,
    { beginning: number; ending: number; dropped: boolean }
  >
): InstallationPeriod[] {
  return periods.flatMap((period) => {
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
}

export function mergeAffectedActivities(
  ...activityGroups: AffectedActivity[][]
): AffectedActivity[] {
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
}

export function annotateActivityOutcomes(
  dataset: Model,
  affectedActivities: AffectedActivity[]
): AffectedActivity[] {
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
          "Activity itself will be removed (no remaining participants).",
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
          "Activity itself will be removed (no remaining participants).",
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
}

export function applyAffectedActivityChanges(
  model: Model,
  affectedActivities: AffectedActivity[]
) {
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
}

export function shrinkActivitiesToRemainingParticipants(
  model: Model,
  activityIds: Iterable<string>
) {
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
}
