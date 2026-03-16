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
  return periods.find(
    (period) =>
      activity.beginning >= period.beginning && activity.ending <= period.ending
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
