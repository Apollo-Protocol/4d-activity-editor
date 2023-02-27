import { MouseEvent } from "react";
import { Individual } from "amrc-activity-lib";
import { Label, removeLabelIfItOverlaps } from "./DrawHelpers";

let mouseOverElement: any | null = null;

export function drawIndividuals(
  config: any,
  svgElement: any,
  individuals: Individual[]
) {
  let y = config.layout.individual.topMargin + config.layout.individual.gap;

  svgElement
    .selectAll(".individual")
    .data(individuals.values())
    .join("rect")
    .attr("class", "individual")
    .attr("id", (d: Individual) => "i" + d["id"])
    .attr("x", config.layout.individual.xMargin)
    .attr("y", () => {
      const oldY = y;
      y = y + config.layout.individual.height + config.layout.individual.gap;
      return oldY;
    })
    .attr(
      "width",
      config.viewPort.x * config.viewPort.zoom +
        config.layout.individual.temporalMargin -
        config.layout.individual.xMargin * 2
    )
    .attr("height", config.layout.individual.height)
    .attr("stroke", config.presentation.individual.stroke)
    .attr("stroke-width", config.presentation.individual.strokeWidth)
    .attr("fill", config.presentation.individual.fill);

  return svgElement;
}

export function hoverIndividuals(config: any, svgElement: any, tooltip: any) {
  svgElement
    .selectAll(".individual")
    .on("mouseover", function (event: MouseEvent) {
      mouseOverElement = event.target as HTMLElement;
      mouseOverElement.style.fill = config.presentation.individual.fillHover;
      tooltip.style("visibility", "visible");
    })
    .on("mouseout", function (event: MouseEvent) {
      if (mouseOverElement) {
        mouseOverElement.style.fill = config.presentation.individual.fill;
        mouseOverElement = null;
      }
      tooltip.style("visibility", "hidden");
    })
    .on("mousemove", function (event: MouseEvent, d: any) {
      tooltip
        .style("top", event.pageY + 20 + "px")
        .style("left", event.pageX + "px")
        .html(individualTooltip(d));
    });
}

function individualTooltip(individual: Individual) {
  let tip = "<strong>Individual</strong>";
  if (individual.name) tip += "<br/> Name: " + individual.name;
  if (individual.type) tip += "<br/> Type: " + individual.type;
  if (individual.description)
    tip += "<br/> Description: " + individual.description;
  return tip;
}

export function clickIndividuals(
  config: any,
  svgElement: any,
  individuals: Individual[],
  clickIndividual: any
) {
  individuals.forEach((i) => {
    svgElement.select("#i" + i.id).on("click", function (event: MouseEvent) {
      clickIndividual(i);
    });
  });
}

export function labelIndividuals(
  config: any,
  svgElement: any,
  individuals: Individual[]
) {
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
    .text((d: Individual) => d["name"])
    .each((d: Individual, i: number, nodes: SVGGraphicsElement[]) => {
      removeLabelIfItOverlaps(labels, nodes[i]);
      labels.push(nodes[i].getBBox());
    });
}
