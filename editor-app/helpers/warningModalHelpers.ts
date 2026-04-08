import { formatBound } from "@/helpers/cascadeHelpers";
import { resolveCurrentAffectedParticipationKey } from "@/helpers/cascadeHelpers";
import type { AffectedActivity } from "@/types/setIndividualTypes";
import { Model } from "@/lib/Model";

export function getAffectedActivitySelectionKey(aa: AffectedActivity): string {
  return `${aa.activityId}:${aa.participationKey ?? aa.individualId}`;
}

export function getAffectedActivityParticipantLabel(aa: AffectedActivity, dataset: Model): string {
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
}

export function getActivityHeaderLabel(
  activityName: string,
  fromBeginning: number,
  fromEnding: number
) {
  return `${activityName} (${formatBound(fromBeginning, true)}-${formatBound(fromEnding, false)}):`;
}

export function getActivityHeaderWidthCh(
  groups: Array<{ activityName: string; fromBeginning: number; fromEnding: number }>
) {
  const longestLabelLength = groups.reduce((maxLength, group) => {
    const labelLength = getActivityHeaderLabel(
      group.activityName,
      group.fromBeginning,
      group.fromEnding
    ).length;
    return Math.max(maxLength, labelLength);
  }, 0);

  return `${Math.min(Math.max(longestLabelLength + 1, 10), 34)}ch`;
}
