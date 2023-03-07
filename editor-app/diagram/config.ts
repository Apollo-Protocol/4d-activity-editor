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
    x: 1000, //Sets the viewport. All other values are relative to this. The Y dimension is caculated from the objects to draw.
  },
  layout: {
    individual: {
      topMargin: 25, //Margin above the first/highest individual.
      bottomMargin: 30, //Margin below the last/lowest individual.
      height: 40, //Height of each individual
      gap: 20, //Gap between each individual.
      xMargin: 40, //The margin on either side of all individuals.
      temporalMargin: 10, //an area at each end of an individual which activities cannot enter
      textLength: 100, //An area given to the individual text. Could be calulated from the labels, perhaps with a max value applied.
    },
  },
  presentation: {
    individual: {
      strokeWidth: "1px", //Inidividal border width
      stroke: "#7F7F7F", //Individual stroke colour
      fill: "#B1B1B0", //Individual fill colour
      fillHover: "#8d8d8b", //Individual fill colour
    },
    activity: {
      strokeWidth: "2px", // Activity border width
      stroke: ["#29123b"], //Activity stroke colour
      strokeDasharray: "5,3", //The dashed scheme applied to activity borders
      fill: ["#7030A0"], //Activity fill colour
      opacity: "0.5", //Opacity of activity fill
      opacityHover: "0.7", //Opacity of activity fill
    },
    participation: {
      strokeWidth: "2px", // Activity border width
      stroke: "#29123b", //Activity stroke colour
      strokeDasharray: "5,3", //The dashed scheme applied to activity borders
      fill: "#F2F2F2", //Activity fill colour
      opacity: "0.5", //Opacity of activity fill
      opacityHover: "0.9", //Opacity of activity fill
    },
    axis: {
      colour: "#7F7F7F", //The fill colour of the axis
      width: 15, //The width of the axis lines
      margin: 20, //The margin between the diagram edge and the axis lines
      textOffsetX: 5, //Helps to tweak the X axis text into the correct position
      textOffsetY: 4, //Helps to tweak the Y axis text into the correct position
      endMargin: 30, //Margin at the end of the arrows
    },
  },
  labels: {
    individual: {
      enabled: true,
      leftMargin: 5, //The margin applied to the left of the individual label
      topMargin: 5, //The margin applied to the top of the individual label to center it on the rectangle.
      color: "black", //Individual label color
      fontSize: "0.8em", //Individual label font size
      maxChars: 24,
    },
    activity: {
      enabled: true,
      topMargin: 5, //The margin applied to the top of the activity label to support correct placement
      color: "#441d62",
      fontSize: "0.8em", //Activity label font size
      maxChars: 14,
    },
  },
};
