import { Individual, Activity, Participation } from "@/lib/Schema";
import {
  calculateViewportHeight,
  clearDiagram,
  createTooltip,
} from "./DrawHelpers";
import { drawAxisArrows } from "./DrawAxis";
import {
  clickIndividuals,
  drawIndividuals,
  hoverIndividuals,
  labelIndividuals,
} from "./DrawIndividuals";
import {
  clickActivities,
  drawActivities,
  hoverActivities,
} from "./DrawActivities";
import { clickParticipations, drawParticipations } from "./DrawParticipations";
import * as d3 from "d3";
import { Model } from "@/lib/Model";

export interface Plot {
  width: number;
  height: number;
}

/**
 * Entry point to draw an activity diagram
 * @param dataset The dataset to draw
 * @param configData The diagram configuration settings
 * @param svgRef The 'ref' value of the SVG element to draw to. Required for reactive apps.
 * @returns A plot object with height and width attributes, which can be used to define the SVG viewbox.
 */
export function drawActivityDiagram(
  dataset: Model,
  configData: any,
  svgRef: SVGSVGElement,
  clickIndividual: (i: Individual) => void,
  clickActivity: (a: Activity) => void,
  clickParticipation: (a: Activity, p: Participation) => void,
  rightClickIndividual: (i: Individual) => void,
  rightClickActivity: (a: Activity) => void,
  rightClickParticipation: (a: Activity, p: Participation) => void
) {
  //Prepare Model data into arrays
  const individualsArray: Individual[] = [];
  const activitiesArray: Activity[] = [];
  const { individuals, activities } = dataset;
  individuals.forEach((i: Individual) => individualsArray.push(i));
  activities.forEach((a: Activity) => activitiesArray.push(a));

  //Draw Diagram parts
  const svgElement = clearDiagram(svgRef);
  const height = calculateViewportHeight(configData, dataset.individuals);
  const tooltip = createTooltip();

  drawIndividuals(configData, svgElement, individualsArray, activitiesArray);
  hoverIndividuals(configData, svgElement, tooltip);
  labelIndividuals(configData, svgElement, individualsArray);
  clickIndividuals(
    configData,
    svgElement,
    individualsArray,
    clickIndividual,
    rightClickIndividual
  );
  drawActivities(configData, svgElement, activitiesArray, individualsArray);
  hoverActivities(configData, svgElement, tooltip);
  clickActivities(
    svgElement,
    activitiesArray,
    clickActivity,
    rightClickActivity
  );
  drawParticipations(configData, svgElement, activitiesArray, tooltip);
  clickParticipations(
    svgElement,
    activitiesArray,
    clickParticipation,
    rightClickParticipation
  );
  drawAxisArrows(configData, svgElement, height);
  let plot: Plot = {
    width: configData.viewPort.x * configData.viewPort.zoom,
    height: height,
  };

  return plot;
}
