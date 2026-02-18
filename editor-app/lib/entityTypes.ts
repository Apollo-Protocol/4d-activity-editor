import { HQDM_NS } from "@apollo-protocol/hqdm-lib";
import type { Kind } from "./Model";
import type { Individual } from "./Schema";

export const ENTITY_CATEGORY = {
  INDIVIDUAL: "individual",
  SYSTEM: "system",
  SYSTEM_COMPONENT: "system_component",
} as const;

export type EntityCategory =
  (typeof ENTITY_CATEGORY)[keyof typeof ENTITY_CATEGORY];

export const ENTITY_TYPE_IDS = {
  INDIVIDUAL: HQDM_NS + "person",
  SYSTEM: HQDM_NS + "organization",
  SYSTEM_COMPONENT: HQDM_NS + "ordinary_physical_object",
} as const;

export type EntityTypeId =
  (typeof ENTITY_TYPE_IDS)[keyof typeof ENTITY_TYPE_IDS];

export const ENTITY_TYPE_OPTIONS: Array<{
  id: EntityTypeId;
  label: string;
  glyph: string;
}> = [
  { id: ENTITY_TYPE_IDS.INDIVIDUAL, label: "Individual", glyph: "○" },
  { id: ENTITY_TYPE_IDS.SYSTEM, label: "System", glyph: "▣" },
  {
    id: ENTITY_TYPE_IDS.SYSTEM_COMPONENT,
    label: "System Component",
    glyph: "◇",
  },
];

export const getEntityTypeId = (
  kind?: Kind | null,
  installedIn?: string,
  entityType?: EntityCategory
): EntityTypeId => {
  if (entityType === ENTITY_CATEGORY.SYSTEM) {
    return ENTITY_TYPE_IDS.SYSTEM;
  }
  if (entityType === ENTITY_CATEGORY.SYSTEM_COMPONENT) {
    return ENTITY_TYPE_IDS.SYSTEM_COMPONENT;
  }

  const id = kind?.id;
  if (id === ENTITY_TYPE_IDS.SYSTEM) return ENTITY_TYPE_IDS.SYSTEM;
  if (id === ENTITY_TYPE_IDS.SYSTEM_COMPONENT && installedIn)
    return ENTITY_TYPE_IDS.SYSTEM_COMPONENT;
  return ENTITY_TYPE_IDS.INDIVIDUAL;
};

export const getEntityTypeIdFromIndividual = (
  individual?: Pick<Individual, "type" | "installedIn" | "entityType"> | null
): EntityTypeId => {
  return getEntityTypeId(
    individual?.type,
    individual?.installedIn,
    individual?.entityType
  );
};

export const getEntityTypeLabel = (
  kind?: Kind | null,
  installedIn?: string,
  entityType?: EntityCategory
): string => {
  const typeId = getEntityTypeId(kind, installedIn, entityType);
  return ENTITY_TYPE_OPTIONS.find((option) => option.id === typeId)?.label ??
    "Individual";
};

export const getEntityTypeGlyph = (
  kind?: Kind | null,
  installedIn?: string,
  entityType?: EntityCategory
): string => {
  const typeId = getEntityTypeId(kind, installedIn, entityType);
  return ENTITY_TYPE_OPTIONS.find((option) => option.id === typeId)?.glyph ?? "○";
};

export const getEntityCategoryFromTypeId = (
  typeId: EntityTypeId
): EntityCategory => {
  if (typeId === ENTITY_TYPE_IDS.SYSTEM) {
    return ENTITY_CATEGORY.SYSTEM;
  }
  if (typeId === ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
    return ENTITY_CATEGORY.SYSTEM_COMPONENT;
  }
  return ENTITY_CATEGORY.INDIVIDUAL;
};
