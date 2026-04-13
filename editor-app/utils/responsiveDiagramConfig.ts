import { config as defaultConfig, ConfigData } from "@/diagram/config";

export const MOBILE_DIAGRAM_BREAKPOINT = 767.98;
export const HAMBURGER_NAV_BREAKPOINT = 991.98;
export const LAPTOP_DIAGRAM_BREAKPOINT = 1599.98;

type ResponsiveRule = {
  path: string;
  laptop?: number | string;
  mobile?: number | string;
};

const RESPONSIVE_RULES: ResponsiveRule[] = [
  { path: "layout.individual.topMargin", laptop: 30, mobile: 40 },
  { path: "layout.individual.bottomMargin", laptop: 38, mobile: 50 },
  { path: "layout.individual.height", laptop: 28, mobile: 50 },
  { path: "layout.individual.gap", laptop: 13, mobile: 23 },
  { path: "layout.individual.xMargin", laptop: 52, mobile: 64 },
  { path: "layout.individual.textLength", mobile: 132 },
  { path: "layout.system.componentGap", laptop: 12, mobile: 18 },
  { path: "layout.system.hostComponentPadding", laptop: 10, mobile: 15 },
  { path: "presentation.axis.width", laptop: 17, mobile: 20 },
  { path: "presentation.axis.margin", laptop: 22, mobile: 26 },
  { path: "presentation.axis.textOffsetX", laptop: 6, mobile: 7 },
  { path: "presentation.axis.textOffsetY", laptop: 5, mobile: 6 },
  { path: "presentation.axis.endMargin", laptop: 32, mobile: 36 },
  { path: "presentation.axis.fontSize", laptop: "0.92em", mobile: "1.18em" },
  { path: "labels.individual.fontSize", laptop: "1em", mobile: "1.32em" },
  { path: "labels.individual.maxChars", mobile: 28 },
  { path: "labels.activity.fontSize", laptop: "0.85em", mobile: "1.15em" },
];

function getValueAtPath(source: Record<string, any>, path: string) {
  return path.split(".").reduce<any>((current, segment) => current?.[segment], source);
}

function setValueAtPath(source: Record<string, any>, path: string, value: unknown) {
  const segments = path.split(".");
  const lastSegment = segments.pop();
  if (!lastSegment) return;

  const parent = segments.reduce<Record<string, any>>((current, segment) => {
    if (!current[segment] || typeof current[segment] !== "object") {
      current[segment] = {};
    }
    return current[segment];
  }, source);

  parent[lastSegment] = value;
}

function getResponsiveMode(viewportWidth: number): "desktop" | "laptop" | "mobile" {
  if (viewportWidth <= HAMBURGER_NAV_BREAKPOINT) return "mobile";
  if (viewportWidth <= LAPTOP_DIAGRAM_BREAKPOINT) return "laptop";
  return "desktop";
}

function getResponsiveDefault<T>(value: T, defaultValue: T, responsiveValue: T) {
  return value === defaultValue ? responsiveValue : value;
}

export function getResponsiveDiagramConfig(
  configData: ConfigData,
  viewportWidth: number
): ConfigData {
  const responsiveMode = getResponsiveMode(viewportWidth);
  const isHamburgerNavLayout = responsiveMode === "mobile";
  const isLaptopDiagramLayout = responsiveMode === "laptop";

  if (!isHamburgerNavLayout && !isLaptopDiagramLayout) {
    return configData;
  }

  if (isLaptopDiagramLayout) {
    return {
      ...configData,
      layout: {
        ...configData.layout,
        individual: {
          ...configData.layout.individual,
          topMargin: getResponsiveDefault(
            configData.layout.individual.topMargin,
            defaultConfig.layout.individual.topMargin,
            30
          ),
          bottomMargin: getResponsiveDefault(
            configData.layout.individual.bottomMargin,
            defaultConfig.layout.individual.bottomMargin,
            38
          ),
          height: getResponsiveDefault(
            configData.layout.individual.height,
            defaultConfig.layout.individual.height,
            28
          ),
          gap: getResponsiveDefault(
            configData.layout.individual.gap,
            defaultConfig.layout.individual.gap,
            13
          ),
          xMargin: getResponsiveDefault(
            configData.layout.individual.xMargin,
            defaultConfig.layout.individual.xMargin,
            52
          ),
        },
        system: {
          ...configData.layout.system,
          componentGap: getResponsiveDefault(
            configData.layout.system.componentGap,
            defaultConfig.layout.system.componentGap,
            12
          ),
          hostComponentPadding: getResponsiveDefault(
            configData.layout.system.hostComponentPadding,
            defaultConfig.layout.system.hostComponentPadding,
            10
          ),
        },
      },
      presentation: {
        ...configData.presentation,
        axis: {
          ...configData.presentation.axis,
          width: getResponsiveDefault(
            configData.presentation.axis.width,
            defaultConfig.presentation.axis.width,
            17
          ),
          margin: getResponsiveDefault(
            configData.presentation.axis.margin,
            defaultConfig.presentation.axis.margin,
            22
          ),
          textOffsetX: getResponsiveDefault(
            configData.presentation.axis.textOffsetX,
            defaultConfig.presentation.axis.textOffsetX,
            6
          ),
          textOffsetY: getResponsiveDefault(
            configData.presentation.axis.textOffsetY,
            defaultConfig.presentation.axis.textOffsetY,
            5
          ),
          endMargin: getResponsiveDefault(
            configData.presentation.axis.endMargin,
            defaultConfig.presentation.axis.endMargin,
            32
          ),
          fontSize: getResponsiveDefault(
            configData.presentation.axis.fontSize,
            defaultConfig.presentation.axis.fontSize,
            "0.92em"
          ),
        },
      },
      labels: {
        ...configData.labels,
        individual: {
          ...configData.labels.individual,
          fontSize: getResponsiveDefault(
            configData.labels.individual.fontSize,
            defaultConfig.labels.individual.fontSize,
            "1em"
          ),
        },
        activity: {
          ...configData.labels.activity,
          fontSize: getResponsiveDefault(
            configData.labels.activity.fontSize,
            defaultConfig.labels.activity.fontSize,
            "0.85em"
          ),
        },
      },
    };
  }

  return {
    ...configData,
    layout: {
      ...configData.layout,
      individual: {
        ...configData.layout.individual,
        topMargin: getResponsiveDefault(
          configData.layout.individual.topMargin,
          defaultConfig.layout.individual.topMargin,
          40
        ),
        bottomMargin: getResponsiveDefault(
          configData.layout.individual.bottomMargin,
          defaultConfig.layout.individual.bottomMargin,
          50
        ),
        height: getResponsiveDefault(
          configData.layout.individual.height,
          defaultConfig.layout.individual.height,
          50
        ),
        gap: getResponsiveDefault(
          configData.layout.individual.gap,
          defaultConfig.layout.individual.gap,
          23
        ),
        xMargin: getResponsiveDefault(
          configData.layout.individual.xMargin,
          defaultConfig.layout.individual.xMargin,
          64
        ),
        textLength: getResponsiveDefault(
          configData.layout.individual.textLength,
          defaultConfig.layout.individual.textLength,
          132
        ),
      },
      system: {
        ...configData.layout.system,
        componentGap: getResponsiveDefault(
          configData.layout.system.componentGap,
          defaultConfig.layout.system.componentGap,
          18
        ),
        hostComponentPadding: getResponsiveDefault(
          configData.layout.system.hostComponentPadding,
          defaultConfig.layout.system.hostComponentPadding,
          15
        ),
      },
    },
    presentation: {
      ...configData.presentation,
      axis: {
        ...configData.presentation.axis,
        width: getResponsiveDefault(
          configData.presentation.axis.width,
          defaultConfig.presentation.axis.width,
          20
        ),
        margin: getResponsiveDefault(
          configData.presentation.axis.margin,
          defaultConfig.presentation.axis.margin,
          26
        ),
        textOffsetX: getResponsiveDefault(
          configData.presentation.axis.textOffsetX,
          defaultConfig.presentation.axis.textOffsetX,
          7
        ),
        textOffsetY: getResponsiveDefault(
          configData.presentation.axis.textOffsetY,
          defaultConfig.presentation.axis.textOffsetY,
          6
        ),
        endMargin: getResponsiveDefault(
          configData.presentation.axis.endMargin,
          defaultConfig.presentation.axis.endMargin,
          36
        ),
        fontSize: getResponsiveDefault(
          configData.presentation.axis.fontSize,
          defaultConfig.presentation.axis.fontSize,
          "1.18em"
        ),
      },
    },
    labels: {
      ...configData.labels,
      individual: {
        ...configData.labels.individual,
        fontSize: getResponsiveDefault(
          configData.labels.individual.fontSize,
          defaultConfig.labels.individual.fontSize,
          "1.32em"
        ),
        maxChars: getResponsiveDefault(
          configData.labels.individual.maxChars,
          defaultConfig.labels.individual.maxChars,
          28
        ),
      },
      activity: {
        ...configData.labels.activity,
        fontSize: getResponsiveDefault(
          configData.labels.activity.fontSize,
          defaultConfig.labels.activity.fontSize,
          "1.15em"
        ),
      },
    },
  };
}

export function getPersistedDiagramConfig(
  editedConfig: ConfigData,
  baseConfig: ConfigData,
  viewportWidth: number
): ConfigData {
  const responsiveMode = getResponsiveMode(viewportWidth);

  if (responsiveMode === "desktop") {
    return editedConfig;
  }

  const persistedConfig = JSON.parse(JSON.stringify(editedConfig)) as ConfigData;
  const effectiveBaseConfig = getResponsiveDiagramConfig(baseConfig, viewportWidth);

  for (const rule of RESPONSIVE_RULES) {
    const responsiveValue = responsiveMode === "mobile" ? rule.mobile : rule.laptop;
    if (responsiveValue === undefined) continue;

    const baseValue = getValueAtPath(baseConfig as Record<string, any>, rule.path);
    const defaultValue = getValueAtPath(defaultConfig as Record<string, any>, rule.path);
    const editedValue = getValueAtPath(editedConfig as Record<string, any>, rule.path);
    const effectiveBaseValue = getValueAtPath(
      effectiveBaseConfig as Record<string, any>,
      rule.path
    );

    if (
      baseValue === defaultValue &&
      effectiveBaseValue === responsiveValue &&
      editedValue === effectiveBaseValue
    ) {
      setValueAtPath(persistedConfig as Record<string, any>, rule.path, baseValue);
    }
  }

  return persistedConfig;
}