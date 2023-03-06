import { MouseEvent } from "react";
import { Activity, Individual, Model } from "amrc-activity-lib";
import {
  keepIndividualLabels,
  Label,
  removeLabelIfItOverlaps,
} from "./DrawHelpers";
import { ConfigData } from "./config";

let mouseOverElement: any | null = null;

export function drawIndividuals(
  config: ConfigData,
  svgElement: any,
  individuals: Individual[],
  activities: Activity[]
) {
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

  let x = config.layout.individual.xMargin;
  x += config.layout.individual.temporalMargin;
  if (individualLabelsEnabled) {
    x += config.layout.individual.textLength;
  }

  const fullWidth =
    config.viewPort.x * config.viewPort.zoom +
    config.layout.individual.temporalMargin -
    config.layout.individual.xMargin * 2;

  let y = config.layout.individual.topMargin + config.layout.individual.gap;

  svgElement
    .selectAll(".individual")
    .data(individuals.values())
    .join("rect")
    .attr("class", "individual")
    .attr("id", (d: Individual) => "i" + d["id"])
    .attr("x", (i: Individual) => {
      if (i.beginning < 0) {
        return config.layout.individual.xMargin;
      }
      return x + timeInterval * (i.beginning - startOfTime);
    })
    .attr("y", () => {
      const oldY = y;
      y = y + config.layout.individual.height + config.layout.individual.gap;
      return oldY;
    })
    .attr("width", (i: Individual) => {
      if (i.beginning < 0 && i.ending == Model.END_OF_TIME) {
        return fullWidth;
      }
      if (i.beginning >= 0 && i.ending == Model.END_OF_TIME) {
        return (
          (endOfTime - i.beginning) * timeInterval +
          config.layout.individual.temporalMargin
        );
      }
      if (i.beginning < 0 && i.ending < Model.END_OF_TIME) {
        return (
          fullWidth -
          (endOfTime - i.ending) * timeInterval -
          config.layout.individual.temporalMargin
        );
      }
      if (i.beginning >= 0 && i.ending < Model.END_OF_TIME) {
        return (i.ending - i.beginning) * timeInterval;
      }
    })
    .attr("height", config.layout.individual.height)
    .attr("stroke", config.presentation.individual.stroke)
    .attr("stroke-width", config.presentation.individual.strokeWidth)
    .attr("fill", config.presentation.individual.fill);

  return svgElement;
}

export function hoverIndividuals(
  config: ConfigData,
  svgElement: any,
  tooltip: any
) {
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
  config: ConfigData,
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
  config: ConfigData,
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
      if (d.beginning >= 0) {
        nodes[i].remove();
      }
    });
}
