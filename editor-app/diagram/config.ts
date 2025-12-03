export interface ConfigData {
  viewPort: {
    zoom: number;
    x: number;
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
    },
  },
  presentation: {
    individual: {
      strokeWidth: "1px",
      stroke: "#7F7F7F",
      fill: "#B1B1B0",
      fillHover: "#8d8d8b",
    },
    activity: {
      strokeWidth: "1px",
      stroke: ["#29123b"],
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
        "#292b2c",
        "#0d6efd",
        "#ffffff",
      ],
      opacity: "0.5",
      opacityHover: "0.7",
    },
    participation: {
      strokeWidth: "1px",
      stroke: "#29123b",
      strokeDasharray: "5,3",
      fill: "#F2F2F2",
      opacity: "0.5",
      opacityHover: "0.9",
    },
    axis: {
      colour: "#7F7F7F",
      width: 15,
      margin: 20,
      textOffsetX: 5,
      textOffsetY: 4,
      endMargin: 30,
    },
  },
  labels: {
    individual: {
      enabled: true,
      leftMargin: 5,
      topMargin: 5,
      color: "black",
      fontSize: "0.8em",
      maxChars: 24,
    },
    activity: {
      enabled: true,
      topMargin: 5,
      color: "#441d62",
      fontSize: "0.7em",
      maxChars: 24,
    },
  },
};
