export interface ConfigData {
  viewPort: {
    zoom: number;
    x: number;
    minTimelineSpan: number;
    timelineBuffer: number;
    activityVerticalScale: number;
  };
  layout: {
    individual: {
      topMargin: number;
      bottomMargin: number;
      height: number;
      gap: number;
      xMargin: number;
      temporalMargin: number;
      textLength: number;
      openEndAlignmentPadding: number;
    };
    system: {
      containerInset: number;
      horizontalInset: number;
      componentGap: number;
      componentHeightFactor: number;
      minHostHeightFactor: number;
      hostHeightGrowthPerComponent: number;
      hostComponentPadding: number;
    };
  };
  presentation: {
    individual: {
      strokeWidth: string;
      stroke: string;
      fill: string;
      fillHover: string;
    };
    activity: {
      strokeWidth: string;
      stroke: string[];
      strokeDasharray: string;
      fill: string[];
      opacity: string;
      opacityHover: string;
    };
    participation: {
      strokeWidth: string;
      stroke: string;
      strokeDasharray: string;
      fill: string;
      opacity: string;
      opacityHover: string;
    };
    axis: {
      colour: string;
      width: number;
      margin: number;
      textOffsetX: number;
      textOffsetY: number;
      endMargin: number;
      fontSize: string;
    };
  };
  labels: {
    individual: {
      enabled: boolean;
      leftMargin: number;
      topMargin: number;
      color: string;
      fontSize: string;
      maxChars: number;
    };
    activity: {
      enabled: boolean;
      topMargin: number;
      color: string;
      fontSize: string;
      maxChars: number;
    };
  };
}

export const config: ConfigData = {
  viewPort: {
    zoom: 1,
    x: 1000,
    minTimelineSpan: 11,
    timelineBuffer: 2,
    activityVerticalScale: 1,
  },
  layout: {
    individual: {
      topMargin: 25,
      bottomMargin: 30,
      height: 20,
      gap: 10,
      xMargin: 40,
      temporalMargin: 10,
      textLength: 100,
      openEndAlignmentPadding: 12,
    },
    system: {
      containerInset: 4,
      horizontalInset: 24,
      componentGap: 10,
      componentHeightFactor: 1,
      minHostHeightFactor: 3,
      hostHeightGrowthPerComponent: 1,
      hostComponentPadding: 8,
    },
  },
  presentation: {
    individual: {
      strokeWidth: "1px",
      stroke: "var(--diagram-individual-stroke, #707071)",
      fill: "var(--diagram-individual-fill, #909091)",
      fillHover: "var(--diagram-individual-fill-hover, #787879)",
    },
    activity: {
      strokeWidth: "1px",
      stroke: ["var(--diagram-activity-stroke, #29123b)"],
      strokeDasharray: "5,3",
      fill: [
        "#440099",
        "#e7004c",
        "#ff9664",
        "#00bbcc",
        "#a1ded2",
        "#981f92",
        "#f15bb5",
        "#fee440",
        "#00bb4f",
        "#00aedb",
        "#000000",
        "#ffffff",
      ],
      opacity: "var(--diagram-activity-opacity, 0.5)",
      opacityHover: "var(--diagram-activity-opacity-hover, 0.7)",
    },
    participation: {
      strokeWidth: "1px",
      stroke: "var(--diagram-participation-stroke, #29123b)",
      strokeDasharray: "5,3",
      fill: "var(--diagram-participation-fill, #F2F2F2)",
      opacity: "var(--diagram-participation-opacity, 0.5)",
      opacityHover: "var(--diagram-participation-opacity-hover, 0.9)",
    },
    axis: {
      colour: "var(--diagram-axis-colour, #7F7F7F)",
      width: 15,
      margin: 20,
      textOffsetX: 5,
      textOffsetY: 4,
      endMargin: 30,
      fontSize: "0.8em",
    },
  },
  labels: {
    individual: {
      enabled: true,
      leftMargin: 5,
      topMargin: 5,
      color: "var(--diagram-label-individual-color, black)",
      fontSize: "0.8em",
      maxChars: 24,
    },
    activity: {
      enabled: true,
      topMargin: 5,
      color: "var(--diagram-label-activity-color, #441d62)",
      fontSize: "0.7em",
      maxChars: 24,
    },
  },
};
