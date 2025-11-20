import { Id, Individual, Activity, Maybe, Participation } from "@/lib/Schema";
import {
  DrawContext,
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
  activityContext: Maybe<Id>,
  svgRef: SVGSVGElement,
  clickIndividual: (i: Individual) => void,
  clickActivity: (a: Activity) => void,
  clickParticipation: (a: Activity, p: Participation) => void,
  rightClickIndividual: (i: Individual) => void,
  rightClickActivity: (a: Activity) => void,
  rightClickParticipation: (a: Activity, p: Participation) => void,
  hideNonParticipating: boolean = false
) {
  //Prepare Model data into arrays
  let individualsArray: Individual[] = [];
  const activitiesArray: Activity[] = [];
  const { individuals, activities } = dataset;

  individuals.forEach((i: Individual) => individualsArray.push(i));
  activities.forEach((a: Activity) => {
    if (a.partOf === activityContext) activitiesArray.push(a);
  });

  if (hideNonParticipating) {
    const participating = new Set<string>();
    activitiesArray.forEach((a) =>
      a.participations.forEach((p: Participation) =>
        participating.add(p.individualId)
      )
    );
    individualsArray = individualsArray.filter((i) => participating.has(i.id));
  }

  //Draw Diagram parts
  const svgElement = clearDiagram(svgRef);
  const individualsMap = new Map(individualsArray.map((i) => [i.id, i]));
  const height = calculateViewportHeight(configData, individualsMap);
  const tooltip = createTooltip();

  const drawCtx: DrawContext = {
    config: configData,
    svgElement,
    tooltip,
    dataset,
    activities: activitiesArray,
    individuals: individualsArray,
  };

  drawIndividuals(drawCtx);
  hoverIndividuals(drawCtx);
  labelIndividuals(drawCtx);
  clickIndividuals(drawCtx, clickIndividual, rightClickIndividual);
  drawActivities(drawCtx);
  hoverActivities(drawCtx);
  clickActivities(drawCtx, clickActivity, rightClickActivity);
  drawParticipations(drawCtx);
  clickParticipations(drawCtx, clickParticipation, rightClickParticipation);
  drawAxisArrows(drawCtx, height);
  let plot: Plot = {
    width: configData.viewPort.x * configData.viewPort.zoom,
    height: height,
  };

  return plot;
}
