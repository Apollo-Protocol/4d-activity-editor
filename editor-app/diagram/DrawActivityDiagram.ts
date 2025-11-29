import {
  Id,
  Individual,
  Activity,
  Maybe,
  Participation,
  EntityType,
} from "@/lib/Schema";
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
import { drawInstallations } from "./DrawInstallations";
import * as d3 from "d3";
import { Model } from "@/lib/Model";

export interface Plot {
  width: number;
  height: number;
}

// Helper to get parent IDs that should be kept visible when filtering (bottom-to-top only)
// When a CHILD has activity, keep its PARENTS visible
// But NOT the reverse - if only parent has activity, don't automatically keep children
function getParentIdsToKeep(
  participatingIds: Set<string>,
  dataset: Model
): Set<string> {
  const parentsToKeep = new Set<string>();

  participatingIds.forEach((id) => {
    // Check if this is a virtual row (installation reference)
    if (id.includes("__installed_in__")) {
      const parts = id.split("__installed_in__");
      const originalId = parts[0];
      const rest = parts[1];
      const targetId = rest.split("__")[0];

      // Virtual row has activity - keep its target (parent) visible
      parentsToKeep.add(targetId);

      // If target is a SystemComponent, also keep its parent System
      const target = dataset.individuals.get(targetId);
      if (target) {
        const targetType = target.entityType ?? EntityType.Individual;
        if (targetType === EntityType.SystemComponent && target.installations) {
          target.installations.forEach((inst) => {
            if (inst.targetId) {
              parentsToKeep.add(inst.targetId);
            }
          });
        }
      }
    } else {
      // Regular individual - check if it's an InstalledComponent or SystemComponent
      const individual = dataset.individuals.get(id);
      if (individual) {
        const entityType = individual.entityType ?? EntityType.Individual;

        if (entityType === EntityType.InstalledComponent) {
          // InstalledComponent has activity - keep parent SystemComponents and their parent Systems
          if (individual.installations) {
            individual.installations.forEach((inst) => {
              if (inst.targetId) {
                parentsToKeep.add(inst.targetId);

                // Get the SystemComponent's parent System
                const sc = dataset.individuals.get(inst.targetId);
                if (sc && sc.installations) {
                  sc.installations.forEach((scInst) => {
                    if (scInst.targetId) {
                      parentsToKeep.add(scInst.targetId);
                    }
                  });
                }
              }
            });
          }
        } else if (entityType === EntityType.SystemComponent) {
          // SystemComponent has activity - keep parent Systems
          if (individual.installations) {
            individual.installations.forEach((inst) => {
              if (inst.targetId) {
                parentsToKeep.add(inst.targetId);
              }
            });
          }
        }
        // Note: If a System has activity, we do NOT automatically keep its children
        // This is the "bottom-to-top only" behavior
      }
    }
  });

  return parentsToKeep;
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
  hideNonParticipating: boolean = false,
  sortedIndividuals?: Individual[]
) {
  // Prepare Model data into arrays
  // Use sorted individuals if provided, otherwise use dataset order
  let individualsArray: Individual[] = sortedIndividuals || [];
  if (!sortedIndividuals) {
    console.log("No sortedIndividuals provided, using dataset order");
    dataset.individuals.forEach((i: Individual) => individualsArray.push(i));
  } else {
    console.log("Using sortedIndividuals:", sortedIndividuals.length);
  }

  const activitiesArray: Activity[] = [];
  const { individuals, activities } = dataset;

  activities.forEach((a: Activity) => {
    if (a.partOf === activityContext) activitiesArray.push(a);
  });

  console.log("individualsArray before filter:", individualsArray.length);

  if (hideNonParticipating) {
    // Get all participating IDs (only direct participants)
    const participating = new Set<string>();
    activitiesArray.forEach((a) =>
      a.participations.forEach((p: Participation) =>
        participating.add(p.individualId)
      )
    );

    // Get parent IDs that should also be kept visible (because their children have activity)
    const parentsToKeep = getParentIdsToKeep(participating, dataset);

    // Filter individuals - keep ONLY if:
    // 1. They directly participate in an activity, OR
    // 2. They are a parent of something that participates (bottom-to-top)
    // Do NOT keep children just because parent participates
    individualsArray = individualsArray.filter((i) => {
      // Direct participation
      if (participating.has(i.id)) return true;

      // Is a parent that should be kept (because child has activity)
      if (parentsToKeep.has(i.id)) return true;

      // Check if this is a virtual row
      if (i.id.includes("__installed_in__")) {
        const parts = i.id.split("__installed_in__");
        const originalId = parts[0];

        // Only keep virtual row if the original component directly participates
        // (NOT just because the target/parent participates)
        if (participating.has(originalId)) return true;

        // Or if this specific virtual row ID directly participates
        if (participating.has(i.id)) return true;
      }

      return false;
    });
  }

  console.log("individualsArray after filter:", individualsArray.length);

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
    individuals: individualsArray, // Pass sorted individuals
  };

  console.log(
    "DrawContext created with individuals:",
    drawCtx.individuals.length
  );

  drawIndividuals(drawCtx);
  hoverIndividuals(drawCtx);
  labelIndividuals(drawCtx);
  clickIndividuals(drawCtx, clickIndividual, rightClickIndividual);
  drawActivities(drawCtx);
  hoverActivities(drawCtx);
  clickActivities(drawCtx, clickActivity, rightClickActivity);
  drawParticipations(drawCtx);
  drawInstallations(drawCtx);
  clickParticipations(drawCtx, clickParticipation, rightClickParticipation);
  drawAxisArrows(drawCtx, height);
  let plot: Plot = {
    width: configData.viewPort.x * configData.viewPort.zoom,
    height: height,
  };

  return plot;
}
