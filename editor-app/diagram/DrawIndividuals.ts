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

  const fullWidth =
    config.viewPort.x * config.viewPort.zoom +
    config.layout.individual.temporalMargin -
    config.layout.individual.xMargin * 2;

  const layout = new Map<string, Layout>();

  /* yuck */
  let next_y = config.layout.individual.topMargin + config.layout.individual.gap;
  for (const i of individuals) {
    const x = i.beginning < 0
      ? config.layout.individual.xMargin
      : lhs_x + timeInterval * (i.beginning - startOfTime);

    const y = next_y;
    next_y = y + config.layout.individual.height + config.layout.individual.gap;

    const w = 
        (i.beginning < 0 && i.ending == Model.END_OF_TIME)
          ? fullWidth
        : (i.beginning >= 0 && i.ending == Model.END_OF_TIME)
          ? (
            (endOfTime - i.beginning) * timeInterval +
            config.layout.individual.temporalMargin
          )
      : (i.beginning < 0 && i.ending < Model.END_OF_TIME)
        ? (
          fullWidth -
          (endOfTime - i.ending) * timeInterval -
          config.layout.individual.temporalMargin
        )
      : (i.beginning >= 0 && i.ending < Model.END_OF_TIME)
        ? (i.ending - i.beginning) * timeInterval
      : 0;

    const h = config.layout.individual.height;

    layout.set(i.id, { x, y, w, h });
  };

  svgElement
    .selectAll(".individual")
    .data(individuals.values())
    .join("rect")
    .attr("class", "individual")
    .attr("id", (d: Individual) => "i" + d["id"])
    .attr("x", (i: Individual) => layout.get(i.id)!.x)
    .attr("y", (i: Individual) => layout.get(i.id)!.y)
    .attr("width", (i: Individual) => layout.get(i.id)!.w)
    .attr("height", (i: Individual) => layout.get(i.id)!.h)
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
    svgElement.select("#i" + i.id).on("click", function (event: MouseEvent) {
      clickIndividual(i);
    });
    svgElement
      .select("#i" + i.id)
      .on("contextmenu", function (event: MouseEvent) {
        event.preventDefault();
        rightClickIndividual(i);
      });
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
