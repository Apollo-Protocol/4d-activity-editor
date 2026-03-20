import * as d3 from "d3";

import { Model } from "@/lib/Model";
import { Activity, Individual } from "@/lib/Schema";
import {
  ENTITY_TYPE_IDS,
  getEntityTypeIdFromIndividual,
} from "@/lib/entityTypes";

import { ConfigData } from "./config";

export interface DrawContext {
  config: ConfigData;
  svgElement: any;
  tooltip: any;

  dataset: Model;
  activities: Activity[];
  individuals: Individual[];
}

export interface Label {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const SYSTEM_CONTAINER_INSET = 4;
export const SYSTEM_HORIZONTAL_INSET = 24; // Increased to keep components inside tapered ends
export const SYSTEM_COMPONENT_GAP = 4;
export const SYSTEM_COMPONENT_HEIGHT_FACTOR = 1;
export const SYSTEM_MIN_HOST_HEIGHT_FACTOR = 3;
export const SYSTEM_HOST_COMPONENT_PADDING = 8;

export function getSystemLayout(config: ConfigData) {
  const system = config.layout.system;
  return {
    containerInset: system?.containerInset ?? SYSTEM_CONTAINER_INSET,
    horizontalInset: system?.horizontalInset ?? SYSTEM_HORIZONTAL_INSET,
    componentGap: system?.componentGap ?? SYSTEM_COMPONENT_GAP,
    componentHeightFactor:
      system?.componentHeightFactor ?? SYSTEM_COMPONENT_HEIGHT_FACTOR,
    minHostHeightFactor:
      system?.minHostHeightFactor ?? SYSTEM_MIN_HOST_HEIGHT_FACTOR,
    hostHeightGrowthPerComponent: system?.hostHeightGrowthPerComponent ?? 1,
    hostComponentPadding:
      system?.hostComponentPadding ?? SYSTEM_HOST_COMPONENT_PADDING,
  };
}

export function calculateViewportHeight(
  config: ConfigData,
  individualsMap: Map<string, Individual>
) {
  let viewPortHeight = 0;
  const systemLayout = getSystemLayout(config);
  const individuals = Array.from(individualsMap.values());
  const baseHeight = config.layout.individual.height;
  const componentHeight = Math.max(
    10,
    Math.floor(baseHeight * systemLayout.componentHeightFactor)
  );

  const componentsBySystem = new Map<string, Individual[]>();
  individuals.forEach((individual) => {
    if (!individual.installedIn) return;
    if (
      getEntityTypeIdFromIndividual(individual) !==
      ENTITY_TYPE_IDS.SYSTEM_COMPONENT
    ) {
      return;
    }

    const host = individualsMap.get(individual.installedIn);
    if (!host || getEntityTypeIdFromIndividual(host) !== ENTITY_TYPE_IDS.SYSTEM) {
      return;
    }

    const list = componentsBySystem.get(host.id);
    if (list) list.push(individual);
    else componentsBySystem.set(host.id, [individual]);
  });

  viewPortHeight += config.layout.individual.topMargin;
  viewPortHeight += config.layout.individual.gap;

  individuals.forEach((individual) => {
    const host = individual.installedIn
      ? individualsMap.get(individual.installedIn)
      : undefined;
    const isNestedComponent =
      !!host &&
      getEntityTypeIdFromIndividual(host) === ENTITY_TYPE_IDS.SYSTEM &&
      getEntityTypeIdFromIndividual(individual) ===
        ENTITY_TYPE_IDS.SYSTEM_COMPONENT;
    if (isNestedComponent) {
      return;
    }

    const childComponents = componentsBySystem.get(individual.id) ?? [];
    const expandedHeight =
      childComponents.length > 0
        ? Math.max(
            Math.floor(
              baseHeight *
                (systemLayout.minHostHeightFactor +
                  Math.max(0, childComponents.length - 1) *
                    systemLayout.hostHeightGrowthPerComponent)
            ),
            baseHeight +
              systemLayout.containerInset * 2 +
              systemLayout.hostComponentPadding * 2 +
              childComponents.length * componentHeight +
              (childComponents.length - 1) * systemLayout.componentGap
          )
        : baseHeight;

    viewPortHeight += expandedHeight;
    viewPortHeight += config.layout.individual.gap;
  });

  if (individuals.length === 0) {
    viewPortHeight += baseHeight + config.layout.individual.gap;
  }

  viewPortHeight += config.layout.individual.bottomMargin;
  return viewPortHeight;
}

export function clearDiagram(svgRef: any) {
  const svgWhole = d3.select(svgRef);
  svgWhole.selectAll("#activity-diagram-group").remove();
  return svgWhole.append("g").attr("id", "activity-diagram-group");
}

export function createTooltip() {
  let body = d3.select("body");
  // remove any existing tooltips
  body.selectAll("#tooltip").remove();
  // create new tooltip
  let tooltip = body
    .append("div")
    .attr("id", "tooltip")
    .style("position", "absolute")
    .style("display", "none")
    .style("background", "var(--bs-body-bg)")
    .style("color", "var(--bs-body-color)")
    .style("padding", "5px")
    .style("border-radius", "10px")
    .style("border", "1px solid var(--bs-border-color-translucent)");

  return tooltip;
}

export function removeLabelIfItOverlaps(
  labels: Label[],
  node: SVGGraphicsElement
) {
  if (labels.length === 0) {
    return;
  }
  const bbox = node.getBBox();
  labels.forEach((l) => {
    if (bbox.x >= l.x && bbox.x <= l.x + l.width) {
      if (bbox.y >= l.y && bbox.y <= l.y + l.height) {
        node.remove();
      }
    }
  });
}

export function keepIndividualLabels(individuals: Individual[]) {
  if (!individuals) {
    return true;
  }
  const individualsStartingBeforeTime = individuals.filter(
    (i) => i.beginning == -1
  );
  if (individuals.length > 0 && individualsStartingBeforeTime.length < 1) {
    return false;
  } else {
    return true;
  }
}
