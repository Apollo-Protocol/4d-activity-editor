import { MouseEvent } from "react";
import { Activity, Individual, EntityType } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import {
  DrawContext,
  keepIndividualLabels,
  Label,
  removeLabelIfItOverlaps,
} from "./DrawHelpers";
import { ConfigData } from "./config";

let mouseOverElement: any | null = null;

interface Layout {
  x: number;
  y: number;
  w: number;
  h: number;
  start: boolean;
  stop: boolean;
}

// Helper to check if this is an "installation reference" (virtual row)
function isInstallationRef(ind: Individual): boolean {
  return ind.id.includes("__installed_in__");
}

// Get the original ID from an installation reference
function getOriginalId(ind: Individual): string {
  if (isInstallationRef(ind)) {
    return ind.id.split("__installed_in__")[0];
  }
  return ind.id;
}

// Get the slot ID from an installation reference
function getSlotId(ind: Individual): string | undefined {
  if (isInstallationRef(ind)) {
    return ind.id.split("__installed_in__")[1];
  }
  return undefined;
}

export function drawIndividuals(ctx: DrawContext) {
  const { config, svgElement, activities, dataset } = ctx;
  const individuals = ctx.individuals;

  console.log(
    "DrawIndividuals received individuals:",
    individuals.length,
    individuals.map((i) => i.name)
  );

  if (!individuals || individuals.length === 0) {
    console.warn("No individuals to draw!");
    return svgElement;
  }

  let startOfTime = Math.min(...activities.map((a) => a.beginning));
  let endOfTime = Math.max(...activities.map((a) => a.ending));
  let duration = endOfTime - startOfTime;
  let totalLeftMargin =
    config.viewPort.x * config.viewPort.zoom -
    config.layout.individual.xMargin * 2;
  totalLeftMargin -= config.layout.individual.temporalMargin;

  const individualLabelsEnabled =
    config.labels.individual.enabled && keepIndividualLabels(individuals);
  if (individualLabelsEnabled) {
    totalLeftMargin -= config.layout.individual.textLength;
  }

  let timeInterval = totalLeftMargin / duration;

  let lhs_x = config.layout.individual.xMargin;
  lhs_x += config.layout.individual.temporalMargin;
  if (individualLabelsEnabled) {
    lhs_x += config.layout.individual.textLength;
  }

  const chevOff = config.layout.individual.height / 3;
  const fullWidth =
    chevOff +
    config.viewPort.x * config.viewPort.zoom +
    config.layout.individual.temporalMargin -
    config.layout.individual.xMargin * 2;

  const layout = new Map<string, Layout>();

  // Helper: Calculate indentation level based on parent chain
  const getIndentLevel = (ind: Individual): number => {
    let level = 0;
    let currentId: string | undefined = undefined;
    const visited = new Set<string>();

    const entityType = ind.entityType ?? EntityType.Individual;

    // Installation references get indented based on their target slot
    if (isInstallationRef(ind)) {
      const slotId = getSlotId(ind);
      if (slotId) {
        // Start from the slot and count up
        currentId = slotId;
        while (currentId && !visited.has(currentId)) {
          visited.add(currentId);
          level++;
          const parent = dataset.individuals.get(currentId);
          if (!parent) break;
          const parentType = parent.entityType ?? EntityType.Individual;
          if (parentType === EntityType.SystemComponent) {
            currentId = parent.parentSystemId;
          } else {
            break;
          }
        }
      }
      return level;
    }

    // SystemComponents get indented based on parentSystemId
    if (entityType === EntityType.SystemComponent) {
      currentId = ind.parentSystemId;
    } else {
      // Individual, System, InstalledComponent (at top level) - no indentation
      return 0;
    }

    // Walk up the parent chain
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      level++;

      const parent = dataset.individuals.get(currentId);
      if (!parent) break;

      const parentType = parent.entityType ?? EntityType.Individual;

      if (parentType === EntityType.SystemComponent) {
        currentId = parent.parentSystemId;
      } else {
        break; // Systems don't have parents
      }
    }

    return level;
  };

  /* Layout calculation */
  let next_y =
    config.layout.individual.topMargin + config.layout.individual.gap;
  for (const i of individuals) {
    const start = i.beginning >= startOfTime;
    const stop = i.ending <= endOfTime;

    // Calculate indent based on hierarchy depth (30px per level)
    const indentLevel = getIndentLevel(i);
    const indent = indentLevel * 30;

    const x =
      (start
        ? lhs_x + timeInterval * (i.beginning - startOfTime)
        : config.layout.individual.xMargin - chevOff) + indent;

    const y = next_y;
    next_y = y + config.layout.individual.height + config.layout.individual.gap;

    const w =
      !start && !stop
        ? fullWidth - indent
        : start && !stop
        ? (endOfTime - i.beginning) * timeInterval +
          config.layout.individual.temporalMargin -
          indent
        : !start && stop
        ? fullWidth -
          indent -
          (endOfTime - i.ending) * timeInterval -
          config.layout.individual.temporalMargin
        : (i.ending - i.beginning) * timeInterval - indent;

    const h = config.layout.individual.height;

    layout.set(i.id, { x, y, w, h, start, stop });
  }

  svgElement
    .selectAll(".individual")
    .data(individuals.values())
    .join("path")
    .attr("class", "individual")
    .attr("id", (d: Individual) => "i" + d["id"])
    .attr("d", (i: Individual) => {
      const { x, y, w, h, start, stop } = layout.get(i.id)!;
      return (
        `M ${x} ${y} l ${w} 0` +
        (stop ? `l 0 ${h}` : `l ${chevOff} ${h / 2} ${-chevOff} ${h / 2}`) +
        `l ${-w} 0` +
        (start ? "" : `l ${chevOff} ${-h / 2} ${-chevOff} ${-h / 2}`) +
        "Z"
      );
    })
    .attr("stroke", config.presentation.individual.stroke)
    .attr("stroke-width", config.presentation.individual.strokeWidth)
    .attr("fill", config.presentation.individual.fill);

  return svgElement;
}

export function hoverIndividuals(ctx: DrawContext) {
  const { config, svgElement, tooltip } = ctx;
  svgElement
    .selectAll(".individual")
    .on("mouseover", function (event: MouseEvent) {
      mouseOverElement = event.target as HTMLElement;
      mouseOverElement.style.fill = config.presentation.individual.fillHover;
      tooltip.style("display", "block");
    })
    .on("mouseout", function (event: MouseEvent) {
      if (mouseOverElement) {
        mouseOverElement.style.fill = config.presentation.individual.fill;
        mouseOverElement = null;
      }
      tooltip.style("display", "none");
    })
    .on("mousemove", function (event: MouseEvent, d: any) {
      tooltip.html(individualTooltip(d));
      if (event.pageX < window.innerWidth / 2) {
        tooltip
          .style("top", event.pageY + 20 + "px")
          .style("left", event.pageX + "px");
      } else {
        const ttWidth = tooltip?.node().getBoundingClientRect().width;
        tooltip
          .style("top", event.pageY + 20 + "px")
          .style("left", event.pageX - ttWidth + "px");
      }
    });
}

function individualTooltip(individual: Individual) {
  let tip = "<strong>Individual</strong>";

  // Check if this is an installation reference
  if (isInstallationRef(individual)) {
    tip = "<strong>Installed Component</strong>";
    tip += "<br/><em>(Installation instance)</em>";
  }

  if (individual.name) tip += "<br/> Name: " + individual.name;
  if (individual.type) tip += "<br/> Type: " + individual.type.name;
  if (individual.description)
    tip += "<br/> Description: " + individual.description;
  return tip;
}

export function clickIndividuals(
  ctx: DrawContext,
  clickIndividual: any,
  rightClickIndividual: any
) {
  const { config, svgElement, individuals, dataset } = ctx;
  individuals.forEach((i) => {
    // For installation references, we need to get the original individual
    const actualIndividual = isInstallationRef(i)
      ? dataset.individuals.get(getOriginalId(i))
      : i;

    if (!actualIndividual) return;

    const lclick = (e: MouseEvent) => clickIndividual(actualIndividual);
    const rclick = (e: MouseEvent) => {
      e.preventDefault();
      rightClickIndividual(actualIndividual);
    };

    svgElement
      .select("#i" + i.id.replace(/__/g, "\\$&")) // Escape special chars in selector
      .on("click", lclick)
      .on("contextmenu", rclick);
    svgElement
      .select("#il" + i.id.replace(/__/g, "\\$&"))
      .on("click", lclick)
      .on("contextmenu", rclick);
  });
}

export function labelIndividuals(ctx: DrawContext) {
  const { config, svgElement, dataset } = ctx;
  const individuals = ctx.individuals;

  if (config.labels.individual.enabled === false) {
    return;
  }

  // Helper: Get indent level
  const getIndentLevel = (ind: Individual): number => {
    let level = 0;
    let currentId: string | undefined = undefined;
    const visited = new Set<string>();

    const entityType = ind.entityType ?? EntityType.Individual;

    // Installation references get indented based on their target slot
    if (isInstallationRef(ind)) {
      const slotId = getSlotId(ind);
      if (slotId) {
        currentId = slotId;
        while (currentId && !visited.has(currentId)) {
          visited.add(currentId);
          level++;
          const parent = dataset.individuals.get(currentId);
          if (!parent) break;
          const parentType = parent.entityType ?? EntityType.Individual;
          if (parentType === EntityType.SystemComponent) {
            currentId = parent.parentSystemId;
          } else {
            break;
          }
        }
      }
      return level;
    }

    // SystemComponents get indented
    if (entityType === EntityType.SystemComponent) {
      currentId = ind.parentSystemId;
    } else {
      return 0;
    }

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      level++;

      const parent = dataset.individuals.get(currentId);
      if (!parent) break;

      const parentType = parent.entityType ?? EntityType.Individual;

      if (parentType === EntityType.SystemComponent) {
        currentId = parent.parentSystemId;
      } else {
        break;
      }
    }

    return level;
  };

  let labels: Label[] = [];

  let y =
    config.layout.individual.topMargin +
    config.layout.individual.gap +
    config.layout.individual.height / 2 +
    config.labels.individual.topMargin;

  svgElement
    .selectAll(".individual-label")
    .data(individuals)
    .join("text")
    .attr("class", "individual-label")
    .attr("id", (i: Individual) => "individual-label-" + i.id)
    .attr("x", (i: Individual) => {
      const indentLevel = getIndentLevel(i);
      const indent = indentLevel * 30;
      return config.layout.individual.xMargin + indent + 5;
    })
    .attr("y", (i: Individual, index: number) => {
      return (
        y +
        index * (config.layout.individual.height + config.layout.individual.gap)
      );
    })
    .attr("font-size", config.labels.individual.fontSize)
    .attr("fill", config.labels.individual.color)
    .text((i: Individual) => {
      const indentLevel = getIndentLevel(i);
      const prefix = indentLevel > 0 ? "↳ " : "";
      return `${prefix}${i.name}`;
    })
    .each((d: Individual, i: number, nodes: SVGGraphicsElement[]) => {
      removeLabelIfItOverlaps(labels, nodes[i]);
      labels.push(nodes[i].getBBox());
    });
}
