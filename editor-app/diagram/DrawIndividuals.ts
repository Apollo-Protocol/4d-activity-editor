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

    if (entityType === EntityType.SystemComponent) {
      currentId = ind.parentSystemId;
    } else if (entityType === EntityType.InstalledComponent) {
      // InstalledComponent's parent is the SystemComponent it's installed into
      if (ind.installations && ind.installations.length > 0) {
        currentId = ind.installations[0].targetId;
      }
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
      } else if (parentType === EntityType.InstalledComponent) {
        if (parent.installations && parent.installations.length > 0) {
          currentId = parent.installations[0].targetId;
        } else {
          break;
        }
      } else {
        break; // Systems and Individuals don't have parents
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
  const { config, svgElement, individuals } = ctx;
  individuals.forEach((i) => {
    const lclick = (e: MouseEvent) => clickIndividual(i);
    const rclick = (e: MouseEvent) => {
      e.preventDefault();
      rightClickIndividual(i);
    };

    svgElement
      .select("#i" + i.id)
      .on("click", lclick)
      .on("contextmenu", rclick);
    svgElement
      .select("#il" + i.id)
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

  // Same helper as above
  const getIndentLevel = (ind: Individual): number => {
    let level = 0;
    let currentId: string | undefined = undefined;
    const visited = new Set<string>();

    const entityType = ind.entityType ?? EntityType.Individual;

    if (entityType === EntityType.SystemComponent) {
      currentId = ind.parentSystemId;
    } else if (entityType === EntityType.InstalledComponent) {
      if (ind.installations && ind.installations.length > 0) {
        currentId = ind.installations[0].targetId;
      }
    }

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      level++;

      const parent = dataset.individuals.get(currentId);
      if (!parent) break;

      const parentType = parent.entityType ?? EntityType.Individual;

      if (parentType === EntityType.SystemComponent) {
        currentId = parent.parentSystemId;
      } else if (parentType === EntityType.InstalledComponent) {
        if (parent.installations && parent.installations.length > 0) {
          currentId = parent.installations[0].targetId;
        } else {
          break;
        }
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
      return prefix + i.name;
    })
    .each((d: Individual, i: number, nodes: SVGGraphicsElement[]) => {
      removeLabelIfItOverlaps(labels, nodes[i]);
      labels.push(nodes[i].getBBox());
    });
}
