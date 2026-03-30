import { Activity, Individual, InstallationPeriod } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import { ENTITY_TYPE_IDS, getEntityTypeIdFromIndividual } from "@/lib/entityTypes";

export const normalizeStart = (value: number | undefined) =>
  Number.isFinite(value) && (value as number) >= 0 ? (value as number) : 0;

export const normalizeEnd = (value: number | undefined) =>
  Number.isFinite(value) && (value as number) > 0
    ? (value as number)
    : Model.END_OF_TIME;

export function getInstallationPeriods(individual: Individual): InstallationPeriod[] {
  if (individual.installations && individual.installations.length > 0) {
    return [...individual.installations]
      .filter(
        (period) =>
          !!period.systemComponentId &&
          Number.isFinite(period.beginning) &&
          Number.isFinite(period.ending) &&
          period.ending > period.beginning
      )
      .sort((first, second) => first.beginning - second.beginning);
  }

  if (!individual.installedIn) return [];

  const beginning = normalizeStart(
    individual.installedBeginning ??
      (Number.isFinite(individual.beginning) ? individual.beginning : 0)
  );
  const ending = normalizeEnd(
    individual.installedEnding ??
      (Number.isFinite(individual.ending) ? individual.ending : Model.END_OF_TIME)
  );

  if (ending <= beginning) return [];

  return [
    {
      id: `${individual.id}::legacy-installation`,
      systemComponentId: individual.installedIn,
      beginning,
      ending,
    },
  ];
}

export function syncLegacyInstallationFields(individual: Individual): Individual {
  const periods = getInstallationPeriods(individual);
  if (periods.length === 0) {
    return {
      ...individual,
      installedIn: undefined,
      installedBeginning: undefined,
      installedEnding: undefined,
      installations: [],
    };
  }

  const primary = periods[0];
  return {
    ...individual,
    installedIn: primary.systemComponentId,
    installedBeginning: primary.beginning,
    installedEnding: primary.ending,
    installations: periods,
  };
}

export function getActiveInstallationForActivity(
  individual: Individual,
  activity: Activity
): InstallationPeriod | undefined {
  const periods = getInstallationPeriods(individual);
  const participation = activity.participations.get(individual.id);
  const participationBeginning = normalizeStart(
    participation?.beginning ?? activity.beginning
  );
  const participationEnding = normalizeEnd(
    participation?.ending ?? activity.ending
  );

  return periods.find(
    (period) =>
      participationBeginning >= period.beginning && participationEnding <= period.ending
  );
}

export function getIndividualInstallationBounds(individual: Individual) {
  const periods = getInstallationPeriods(individual);
  if (periods.length === 0) return { periods, beginning: undefined, ending: undefined };
  return {
    periods,
    beginning: Math.min(...periods.map((period) => period.beginning)),
    ending: Math.max(...periods.map((period) => period.ending)),
  };
}

export function isInstalledInSystemComponent(
  individual: Individual,
  individualsById: Map<string, Individual>
) {
  const periods = getInstallationPeriods(individual);
  if (periods.length === 0) return false;

  return periods.some((period) => {
    const component = individualsById.get(period.systemComponentId);
    return (
      !!component &&
      getEntityTypeIdFromIndividual(component) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT
    );
  });
}

export function isActivityInsideAnyInstallation(individual: Individual, activity: Activity) {
  return !!getActiveInstallationForActivity(individual, activity);
}

/** A time-slice of a participation, optionally tied to an installation period. */
export interface ParticipationSegment {
  beginning: number;
  ending: number;
  /** When set, this segment falls during the given installation period. */
  installationPeriod?: InstallationPeriod;
}

/**
 * Split a participation's effective time range into segments aligned with
 * installation periods.  Segments that overlap an installation carry the
 * `installationPeriod` reference; gap segments do not.
 *
 * If the individual has no overlapping installations the function returns a
 * single segment covering the whole participation.
 */
export function splitParticipationByInstallations(
  individual: Individual,
  activity: Activity
): ParticipationSegment[] {
  const periods = getInstallationPeriods(individual);
  const participation = activity.participations.get(individual.id);
  const partBegin = normalizeStart(participation?.beginning ?? activity.beginning);
  const partEnd = normalizeEnd(participation?.ending ?? activity.ending);

  if (partEnd <= partBegin) return [{ beginning: partBegin, ending: partEnd }];

  const overlapping = periods
    .filter((p) => p.beginning < partEnd && p.ending > partBegin)
    .sort((a, b) => a.beginning - b.beginning);

  if (overlapping.length === 0) {
    return [{ beginning: partBegin, ending: partEnd }];
  }

  const segments: ParticipationSegment[] = [];
  let cursor = partBegin;

  for (const period of overlapping) {
    const overlapStart = Math.max(cursor, period.beginning);
    const overlapEnd = Math.min(partEnd, period.ending);

    // Gap before this installation
    if (cursor < overlapStart) {
      segments.push({ beginning: cursor, ending: overlapStart });
    }

    // Installation overlap segment
    if (overlapStart < overlapEnd) {
      segments.push({
        beginning: overlapStart,
        ending: overlapEnd,
        installationPeriod: period,
      });
    }

    cursor = overlapEnd;
  }

  // Remaining time after all installations
  if (cursor < partEnd) {
    segments.push({ beginning: cursor, ending: partEnd });
  }

  return segments;
}
