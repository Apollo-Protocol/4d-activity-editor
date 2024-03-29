import { MouseEvent } from "react";
import { Activity, Individual } from "@/lib/Schema";
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
  const { config, svgElement, individuals, activities } = ctx;

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
  const fullWidth = chevOff +
    config.viewPort.x * config.viewPort.zoom +
    config.layout.individual.temporalMargin -
    config.layout.individual.xMargin * 2;

  const layout = new Map<string, Layout>();

  /* yuck */
  let next_y = config.layout.individual.topMargin + config.layout.individual.gap;
  for (const i of individuals) {
    const start = i.beginning >= startOfTime;
    const stop = i.ending <= endOfTime;

    const x = start
      ? lhs_x + timeInterval * (i.beginning - startOfTime)
      : config.layout.individual.xMargin - chevOff;

    const y = next_y;
    next_y = y + config.layout.individual.height + config.layout.individual.gap;

    const w = 
      (!start && !stop)   ? fullWidth
      : (start && !stop)  ? (
        (endOfTime - i.beginning) * timeInterval +
        config.layout.individual.temporalMargin
      )
      : (!start && stop)  ? (
        fullWidth -
        (endOfTime - i.ending) * timeInterval -
        config.layout.individual.temporalMargin
      )
      : (i.ending - i.beginning) * timeInterval;

    const h = config.layout.individual.height;

    layout.set(i.id, { x, y, w, h, start, stop });
  };

  svgElement
    .selectAll(".individual")
    .data(individuals.values())
    .join("path")
    .attr("class", "individual")
    .attr("id", (d: Individual) => "i" + d["id"])
    .attr("d", (i: Individual) => {
      const { x, y, w, h, start, stop } = layout.get(i.id)!;
      return `M ${x} ${y} l ${w} 0`
        + (stop ? `l 0 ${h}` : `l ${chevOff} ${h/2} ${-chevOff} ${h/2}`)
        + `l ${-w} 0`
        + (start ? "" : `l ${chevOff} ${-h/2} ${-chevOff} ${-h/2}`)
        + "Z";
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

    svgElement.select("#i" + i.id)
      .on("click", lclick)
      .on("contextmenu", rclick);
    svgElement.select("#il" + i.id)
      .on("click", lclick)
      .on("contextmenu", rclick);
  });
}

export function labelIndividuals(ctx: DrawContext) {
  const { config, svgElement, individuals } = ctx;

  if (config.labels.individual.enabled === false) {
    return;
  }

  let labels: Label[] = [];

  let y =
    config.layout.individual.topMargin +
    config.layout.individual.gap +
    config.layout.individual.height / 2 +
    config.labels.individual.topMargin;

  svgElement
    .selectAll(".individualLabel")
    .data(individuals.values())
    .join("text")
    .attr("class", "individualLabel")
    .attr("id", (i: Individual) => `il${i.id}`)
    .attr(
      "x",
      config.layout.individual.xMargin + config.labels.individual.leftMargin
    )
    .attr("y", () => {
      const oldY = y;
      y = y + config.layout.individual.height + config.layout.individual.gap;
      return oldY;
    })
    .attr("text-anchor", "start")
    .attr("font-family", "Roboto, Arial, sans-serif")
    .attr("font-size", config.labels.individual.fontSize)
    .text((d: Individual) => {
      let label = d["name"];
      if (label.length > config.labels.individual.maxChars) {
        label = label.substring(0, config.labels.individual.maxChars);
        label += "...";
      }
      return label;
    })
    .each((d: Individual, i: number, nodes: SVGGraphicsElement[]) => {
      removeLabelIfItOverlaps(labels, nodes[i]);
      labels.push(nodes[i].getBBox());
    });
}
