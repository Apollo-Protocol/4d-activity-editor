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
  nestingLevel: number;
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

// Helper function to get icon for entity type
function getEntityIcon(ind: Individual): string {
  const entityType = ind.entityType ?? EntityType.Individual;

  if (isInstallationRef(ind)) {
    return "⬡"; // hexagon for installed component reference
  }

  switch (entityType) {
    case EntityType.System:
      return "▣"; // filled square for system
    case EntityType.SystemComponent:
      return "◈"; // diamond for system component
    case EntityType.InstalledComponent:
      return "⬢"; // hexagon for installed component
    case EntityType.Individual:
    default:
      return "○"; // circle for individual
  }
}

// Calculate nesting level for visual gap
function getNestingLevel(ind: Individual, dataset: Model): number {
  let level = 0;
  let currentId: string | undefined = undefined;
  const visited = new Set<string>();

  const entityType = ind.entityType ?? EntityType.Individual;

  // Installation references get nested based on their target slot
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

  // SystemComponents get nested based on parentSystemId
  if (entityType === EntityType.SystemComponent) {
    currentId = ind.parentSystemId;
  } else {
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

  // Expand time range to include installed components' actual installation periods
  for (const ind of individuals) {
    if (isInstallationRef(ind)) {
      const originalId = getOriginalId(ind);
      const slotId = getSlotId(ind);
      if (originalId && slotId) {
        const original = dataset.individuals.get(originalId);
        if (original && original.installations) {
          const inst = original.installations.find(
            (x) => x.targetId === slotId
          );
          if (inst) {
            const instBeginning = Math.max(0, inst.beginning ?? 0);
            if (instBeginning < startOfTime) startOfTime = instBeginning;
            if (
              inst.ending !== undefined &&
              inst.ending < Model.END_OF_TIME &&
              inst.ending > endOfTime
            )
              endOfTime = inst.ending;
          }
        }
      }
    }
  }

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

  /* Layout calculation */
  let next_y =
    config.layout.individual.topMargin + config.layout.individual.gap;
  for (const i of individuals) {
    // Determine effective beginning/ending for drawing
    let effectiveBeginning = i.beginning;
    let effectiveEnding = i.ending;

    const entityType = i.entityType ?? EntityType.Individual;

    // For SystemComponents, inherit time from parent System if beginning is < 0
    if (entityType === EntityType.SystemComponent) {
      if (effectiveBeginning < 0 && i.parentSystemId) {
        const parentSystem = dataset.individuals.get(i.parentSystemId);
        if (parentSystem) {
          // Use parent's beginning, or startOfTime if parent also extends before
          effectiveBeginning =
            parentSystem.beginning >= 0 ? parentSystem.beginning : startOfTime;
        } else {
          // No parent found, use startOfTime
          effectiveBeginning = startOfTime;
        }
      } else if (effectiveBeginning < 0) {
        // No parent, use startOfTime
        effectiveBeginning = startOfTime;
      }

      // Same for ending
      if (effectiveEnding >= Model.END_OF_TIME && i.parentSystemId) {
        const parentSystem = dataset.individuals.get(i.parentSystemId);
        if (parentSystem && parentSystem.ending < Model.END_OF_TIME) {
          effectiveEnding = parentSystem.ending;
        }
      }
    }

    // For installed components (installation references), use installation period
    if (isInstallationRef(i)) {
      const originalId = getOriginalId(i);
      const slotId = getSlotId(i);
      if (originalId && slotId) {
        const original = dataset.individuals.get(originalId);
        if (original && original.installations) {
          const inst = original.installations.find(
            (x) => x.targetId === slotId
          );
          if (inst) {
            effectiveBeginning = Math.max(0, inst.beginning ?? 0);
            effectiveEnding = inst.ending ?? Model.END_OF_TIME;
          }
        }
      }
    }

    // Calculate nesting level (kept for reference but NOT used to modify time)
    const nestingLevel = getNestingLevel(i, dataset);

    // DO NOT modify effectiveBeginning for nesting
    // All rectangles start at their actual time position
    // Nesting is shown visually by the row order and icons only

    // start = true means flat left edge (begins within view)
    // start = false means left chevron (extends before view)
    const start = effectiveBeginning >= startOfTime;
    const stop = effectiveEnding <= endOfTime;

    // Calculate x position based on time (all items aligned to timeline)
    let x: number;
    if (start) {
      // Starts within view - position based on time
      x = lhs_x + timeInterval * (effectiveBeginning - startOfTime);
    } else {
      // Extends before view - chevron on left
      x = config.layout.individual.xMargin - chevOff;
    }

    const y = next_y;
    next_y = y + config.layout.individual.height + config.layout.individual.gap;

    // Calculate width based on time
    let w: number;
    if (!start && !stop) {
      // Extends both directions
      w = fullWidth;
    } else if (start && !stop) {
      // Has start, extends to end
      w =
        (endOfTime - effectiveBeginning) * timeInterval +
        config.layout.individual.temporalMargin;
    } else if (!start && stop) {
      // Extends before, has end
      w =
        fullWidth -
        (endOfTime - effectiveEnding) * timeInterval -
        config.layout.individual.temporalMargin;
    } else {
      // Has both start and end
      w = (effectiveEnding - effectiveBeginning) * timeInterval;
    }

    // Ensure minimum width
    if (w < 20) w = 20;

    const h = config.layout.individual.height;

    layout.set(i.id, { x, y, w, h, start, stop, nestingLevel });
  }

  svgElement
    .selectAll(".individual")
    .data(individuals.values())
    .join("path")
    .attr("class", "individual")
    .attr("id", (d: Individual) => "i" + d["id"])
    .attr("d", (i: Individual) => {
      const { x, y, w, h, start, stop, nestingLevel } = layout.get(i.id)!;
      const rightChevron = stop
        ? `l 0 ${h}`
        : `l ${chevOff} ${h / 2} ${-chevOff} ${h / 2}`;
      // show left chevron when item starts before view (start === false)
      // OR when it's a nested SystemComponent / installation (nestingLevel > 0)
      const leftChevron = `l ${chevOff} ${-h / 2} ${-chevOff} ${-h / 2}`;

      const includeLeftChevron = !start || nestingLevel > 0;

      return (
        `M ${x} ${y} l ${w} 0` +
        rightChevron +
        `l ${-w} 0` +
        (includeLeftChevron ? leftChevron : "") +
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
      .select("#i" + CSS.escape(i.id))
      .on("click", lclick)
      .on("contextmenu", rclick);
    svgElement
      .select("#il" + CSS.escape(i.id))
      .on("click", lclick)
      .on("contextmenu", rclick);
  });
}

// Labels all aligned to the left (no indent), icons show the type
export function labelIndividuals(ctx: DrawContext) {
  const { config, svgElement, individuals, dataset } = ctx;

  if (config.labels.individual.enabled === false) {
    return;
  }

  let labels: Label[] = [];

  let y =
    config.layout.individual.topMargin +
    config.layout.individual.gap +
    config.layout.individual.height / 2 +
    config.labels.individual.topMargin;

  // Draw icons (all aligned left - no indent)
  svgElement
    .selectAll(".individualIcon")
    .data(individuals.values())
    .join("text")
    .attr("class", "individualIcon")
    .attr("id", (i: Individual) => `ii${i.id}`)
    .attr(
      "x",
      config.layout.individual.xMargin + config.labels.individual.leftMargin
    )
    .attr("y", (i: Individual, idx: number) => {
      return (
        config.layout.individual.topMargin +
        config.layout.individual.gap +
        config.layout.individual.height / 2 +
        config.labels.individual.topMargin +
        idx * (config.layout.individual.height + config.layout.individual.gap)
      );
    })
    .attr("text-anchor", "start")
    .attr("font-family", "Arial, sans-serif")
    .attr("font-size", config.labels.individual.fontSize)
    .attr("fill", "#374151") // Dark gray for icons
    .text((d: Individual) => getEntityIcon(d));

  // Draw labels (all aligned left after icon - no indent)
  svgElement
    .selectAll(".individualLabel")
    .data(individuals.values())
    .join("text")
    .attr("class", "individualLabel")
    .attr("id", (i: Individual) => `il${i.id}`)
    .attr(
      "x",
      config.layout.individual.xMargin +
        config.labels.individual.leftMargin +
        16
    )
    .attr("y", () => {
      const oldY = y;
      y = y + config.layout.individual.height + config.layout.individual.gap;
      return oldY;
    })
    .attr("text-anchor", "start")
    .attr("font-family", "Roboto, Arial, sans-serif")
    .attr("font-size", config.labels.individual.fontSize)
    .attr("fill", "#111827") // Dark color for text
    .text((d: Individual) => {
      let label = d.name;
      if (label.length > config.labels.individual.maxChars - 2) {
        label = label.substring(0, config.labels.individual.maxChars - 2);
        label += "...";
      }
      return label;
    })
    .each((d: Individual, i: number, nodes: SVGGraphicsElement[]) => {
      removeLabelIfItOverlaps(labels, nodes[i]);
      labels.push(nodes[i].getBBox());
    });
}
