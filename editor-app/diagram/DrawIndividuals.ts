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

  // Helper: Calculate indentation level based on parent chain
  // This is ONLY used for labels, NOT for bar positioning
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

    // SystemComponents get indented based on parentSystemId
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
  };

  /* Layout calculation */
  let next_y =
    config.layout.individual.topMargin + config.layout.individual.gap;
  for (const i of individuals) {
    // Determine effective beginning/ending for drawing
    let effectiveBeginning = i.beginning;
    let effectiveEnding = i.ending;

    // For installed components, use installation period
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

    // Original logic: beginning >= startOfTime means bar starts within view
    // -1 means "extends before startOfTime" (chevron on left)
    const start = effectiveBeginning >= startOfTime;
    const stop = effectiveEnding <= endOfTime;

    // NO indent for bars - bars always align with their time position
    // Indent is ONLY for labels
    const x = start
      ? lhs_x + timeInterval * (effectiveBeginning - startOfTime)
      : config.layout.individual.xMargin - chevOff;

    const y = next_y;
    next_y = y + config.layout.individual.height + config.layout.individual.gap;

    const w =
      !start && !stop
        ? fullWidth
        : start && !stop
        ? (endOfTime - effectiveBeginning) * timeInterval +
          config.layout.individual.temporalMargin
        : !start && stop
        ? fullWidth -
          (endOfTime - effectiveEnding) * timeInterval -
          config.layout.individual.temporalMargin
        : (effectiveEnding - effectiveBeginning) * timeInterval;

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

// Labels get indented, bars do not
export function labelIndividuals(ctx: DrawContext) {
  const { config, svgElement, individuals, dataset } = ctx;

  if (config.labels.individual.enabled === false) {
    return;
  }

  // Helper: Get indent level (for indented labels like system components)
  const getIndentLevel = (ind: Individual): number => {
    let level = 0;
    let currentId: string | undefined = undefined;
    const visited = new Set<string>();

    const entityType = ind.entityType ?? EntityType.Individual;

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

  // First, draw the icons (monochrome gray)
  svgElement
    .selectAll(".individualIcon")
    .data(individuals.values())
    .join("text")
    .attr("class", "individualIcon")
    .attr("id", (i: Individual) => `ii${i.id}`)
    .attr("x", (i: Individual) => {
      const indentLevel = getIndentLevel(i);
      const indent = indentLevel * 30;
      return (
        config.layout.individual.xMargin +
        config.labels.individual.leftMargin +
        indent
      );
    })
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

    .text((d: Individual) => getEntityIcon(d));

  // Then, draw the labels (normal text color)
  svgElement
    .selectAll(".individualLabel")
    .data(individuals.values())
    .join("text")
    .attr("class", "individualLabel")
    .attr("id", (i: Individual) => `il${i.id}`)
    .attr("x", (i: Individual) => {
      const indentLevel = getIndentLevel(i);
      const indent = indentLevel * 30;
      // Offset by icon width (approximately 16px)
      return (
        config.layout.individual.xMargin +
        config.labels.individual.leftMargin +
        indent +
        16
      );
    })
    .attr("y", () => {
      const oldY = y;
      y = y + config.layout.individual.height + config.layout.individual.gap;
      return oldY;
    })
    .attr("text-anchor", "start")
    .attr("font-family", "Roboto, Arial, sans-serif")
    .attr("font-size", config.labels.individual.fontSize)
    .attr("fill", "#111827") // Dark color for text (normal readable text)
    .text((d: Individual) => {
      let label = d.name;
      // Account for icon width when checking max chars
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
