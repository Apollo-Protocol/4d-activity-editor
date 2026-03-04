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
  drawInstallationConnectors,
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
import { getInstallationPeriods } from "@/utils/installations";
import { ENTITY_CATEGORY } from "@/lib/entityTypes";

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
      const entityActivities = new Map<string, Set<Activity>>();
      individualsArray.forEach(i => entityActivities.set(i.id, new Set()));

      activitiesArray.forEach((a) =>
        a.participations.forEach((p: Participation) => {
          if (entityActivities.has(p.individualId)) {
            entityActivities.get(p.individualId)!.add(a);
          }
        })
      );

      const hasOverlap = (t1: { beginning: number; ending: number }, t2: { beginning: number; ending: number }) => {
        return Math.max(t1.beginning, t2.beginning) <= Math.min(t1.ending, t2.ending);
      };

      let changed = true;
      while (changed) {
        changed = false;
        individualsArray.forEach((ind) => {
          const indActs = entityActivities.get(ind.id);
          if (!indActs) return;

          if (ind.entityType === ENTITY_CATEGORY.SYSTEM_COMPONENT && ind.installedIn) {
            const parentActs = entityActivities.get(ind.installedIn);
            if (parentActs) {
              // Share between system and system_component
              indActs.forEach(a => {
                if (!parentActs.has(a)) {
                  parentActs.add(a);
                  changed = true;
                }
              });
              parentActs.forEach(a => {
                if (!indActs.has(a)) {
                  indActs.add(a);
                  changed = true;
                }
              });
            }
          }

          const periods = getInstallationPeriods(ind);
          periods.forEach((p) => {
            const compActs = entityActivities.get(p.systemComponentId);
            if (compActs) {
              // Share between individual and system_component ONLY if intersecting
              indActs.forEach(a => {
                if (hasOverlap(a, p) && !compActs.has(a)) {
                  compActs.add(a);
                  changed = true;
                }
              });
              compActs.forEach(a => {
                if (hasOverlap(a, p) && !indActs.has(a)) {
                  indActs.add(a);
                  changed = true;
                }
              });
            }
          });
        });
      }

        individualsArray = individualsArray.filter((i) => (entityActivities.get(i.id)?.size || 0) > 0);
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
  drawInstallationConnectors(drawCtx);
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
