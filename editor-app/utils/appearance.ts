export const APPEARANCE_TYPOGRAPHY_KEY = "app-typography-profile";

export type TypographyProfileKey = "default" | "apollo";

type TypographyProfile = {
  heading: string;
  subheading: string;
  body: string;
  diagram: string;
};

const DEFAULT_TYPOGRAPHY_PROFILE: TypographyProfile = {
  heading: '"Roboto", Arial, sans-serif',
  subheading: '"Roboto", Arial, sans-serif',
  body: '"Roboto", Arial, sans-serif',
  diagram: '"Roboto", Arial, sans-serif',
};

const APOLLO_TYPOGRAPHY_PROFILE: TypographyProfile = {
  heading: '"Jost", "Segoe UI", sans-serif',
  subheading: '"Merriweather", Georgia, serif',
  body: '"Source Sans 3", "Segoe UI", sans-serif',
  diagram: '"Source Sans 3", "Segoe UI", sans-serif',
};

const TYPOGRAPHY_PROFILES: Record<TypographyProfileKey, TypographyProfile> = {
  default: DEFAULT_TYPOGRAPHY_PROFILE,
  apollo: APOLLO_TYPOGRAPHY_PROFILE,
};

export function isTypographyProfileKey(
  value: string | null | undefined
): value is TypographyProfileKey {
  return value === "default" || value === "apollo";
}

export function getStoredTypographyProfile(): TypographyProfileKey {
  if (typeof window === "undefined") {
    return "default";
  }

  const stored = localStorage.getItem(APPEARANCE_TYPOGRAPHY_KEY);
  return isTypographyProfileKey(stored) ? stored : "default";
}

export function applyTypographyProfile(profileKey: TypographyProfileKey) {
  if (typeof document === "undefined") {
    return;
  }

  const profile = TYPOGRAPHY_PROFILES[profileKey] ?? DEFAULT_TYPOGRAPHY_PROFILE;
  const root = document.documentElement;

  root.style.setProperty("--app-font-heading", profile.heading);
  root.style.setProperty("--app-font-subheading", profile.subheading);
  root.style.setProperty("--app-font-body", profile.body);
  root.style.setProperty("--app-font-diagram", profile.diagram);

  if (typeof window !== "undefined") {
    localStorage.setItem(APPEARANCE_TYPOGRAPHY_KEY, profileKey);
  }
}

export function getResolvedCssVariable(variableName: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();

  return value || fallback;
}

export function getHeadingFontFamily() {
  return getResolvedCssVariable(
    "--app-font-heading",
    DEFAULT_TYPOGRAPHY_PROFILE.heading
  );
}

export function getSubheadingFontFamily() {
  return getResolvedCssVariable(
    "--app-font-subheading",
    DEFAULT_TYPOGRAPHY_PROFILE.subheading
  );
}

export function getBodyFontFamily() {
  return getResolvedCssVariable("--app-font-body", DEFAULT_TYPOGRAPHY_PROFILE.body);
}

export function getDiagramFontFamily() {
  return getResolvedCssVariable(
    "--app-font-diagram",
    DEFAULT_TYPOGRAPHY_PROFILE.diagram
  );
}