import { MouseEvent } from "react";
import { Activity, Individual, Participation } from "amrc-activity-lib";
import {
  Label,
  removeLabelIfItOverlaps,
  keepIndividualLabels,
} from "./DrawHelpers";
import { ConfigData } from "./config";

let mouseOverElement: any | null = null;

export function drawActivities(
  config: ConfigData,
  svgElement: any,
  activities: Activity[],
  individuals: Individual[]
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

  svgElement
    .selectAll(".activity")
    .data(activities.values())
    .join("rect")
    .attr("class", "activity")
    .attr("id", (a: Activity) => "a" + a["id"])
    .attr("x", (a: Activity) => {
      return x + timeInterval * (a.beginning - startOfTime);
    })
    .attr("y", (a: Activity) => {
      return (
        calculateTopPositionOfNewActivity(svgElement, a) -
        config.layout.individual.gap / 2
      );
    })
    .attr("width", (a: Activity) => {
      return (a.ending - a.beginning) * timeInterval;
    })
    .attr("height", (a: Activity) => {
      const height = calculateLengthOfNewActivity(svgElement, a);
      return height
        ? height -
            calculateTopPositionOfNewActivity(svgElement, a) +
            config.layout.individual.gap +
            config.layout.individual.height
        : 0;
    })
    .attr("stroke", config.presentation.activity.stroke)
    .attr("stroke-dasharray", config.presentation.activity.strokeDasharray)
    .attr("stroke-width", config.presentation.activity.strokeWidth)
    .attr("fill", config.presentation.activity.fill)
    .attr("opacity", config.presentation.activity.opacity);

  labelActivities(config, svgElement, activities, x, timeInterval, startOfTime);

  return svgElement;
}

function labelActivities(
  config: ConfigData,
  svgElement: any,
  activities: Activity[],
  startingPosition: number,
  timeInterval: number,
  startOfTime: number
) {
  if (config.labels.activity.enabled === false) {
    return;
  }

  let labels: Label[] = [];

  svgElement
    .selectAll(".activityLabel")
    .data(activities.values())
    .join("text")
    .attr("class", "activityLabel")
    .attr("x", (d: Activity) => {
      const box = getBoxOfExistingActivity(svgElement, d);
      return box.x + box.width / 2;
    })
    .attr("y", (d: Activity) => {
      const box = getBoxOfExistingActivity(svgElement, d);
      const individualBoxHeight =
        config.layout.individual.height + config.layout.individual.gap;
      let position = box.y;
      if (d.participations?.size === 1) {
        position = box.y - config.labels.activity.topMargin;
        return position;
      }
      if ((box.height / individualBoxHeight) % 2 == 0) {
        position = box.y + box.height / 2;
      } else {
        position =
          box.y +
          box.height / 2 -
          config.layout.individual.height / 2 -
          config.layout.individual.gap / 2;
      }
      position += config.labels.activity.topMargin;
      return position;
    })
    .attr("text-anchor", "middle")
    .attr("font-family", "Roboto, Arial, sans-serif")
    .attr("font-size", config.labels.activity.fontSize)
    .attr("fill", config.labels.activity.color)
    .text((d: Activity) => d["name"])
    .each((d: Activity, i: number, nodes: SVGGraphicsElement[]) => {
      removeLabelIfItOverlaps(labels, nodes[i]);
      labels.push(nodes[i].getBBox());
    });
}

export function hoverActivities(
  config: ConfigData,
  svgElement: any,
  tooltip: any
) {
  svgElement
    .selectAll(".activity")
    .on("mouseover", function (event: MouseEvent) {
      mouseOverElement = event.target as HTMLElement;
      mouseOverElement.style.opacity =
        config.presentation.activity.opacityHover;
      tooltip.style("visibility", "visible");
    })
    .on("mouseout", function (event: MouseEvent) {
      if (mouseOverElement) {
        mouseOverElement.style.opacity = config.presentation.activity.opacity;
        mouseOverElement = null;
      }
      tooltip.style("visibility", "hidden");
    })
    .on("mousemove", function (event: MouseEvent, d: any) {
      tooltip
        .style("top", event.pageY + 20 + "px")
        .style("left", event.pageX + "px")
        .html(activityTooltip(d));
    });
}

function activityTooltip(activity: Activity) {
  let tip = "<strong>Activity</strong>";
  if (activity.name) tip += "<br/> Name: " + activity.name;
  if (activity.type) tip += "<br/> Type: " + activity.type;
  if (activity.description) tip += "<br/> Description: " + activity.description;
  if (activity.beginning !== undefined)
    tip += "<br/> Beginning: " + activity.beginning;
  if (activity.ending) tip += "<br/> Ending: " + activity.ending;
  return tip;
}

export function clickActivities(
  svgElement: any,
  activities: Activity[],
  clickActivity: any
) {
  activities.forEach((a) => {
    svgElement.select("#a" + a.id).on("click", function (event: MouseEvent) {
      clickActivity(a);
    });
  });
}

function calculateLengthOfNewActivity(svgElement: any, activity: Activity) {
  let highestY = 0;
  activity?.participations?.forEach((a: Participation) => {
    const element = svgElement
      .select("#i" + a.individualId)
      .node()
      .getBBox();
    highestY = Math.max(highestY, element.y);
  });
  return highestY > 0 ? highestY : null;
}

function calculateTopPositionOfNewActivity(
  svgElement: any,
  activity: Activity
) {
  let lowestY = Number.MAX_VALUE;
  activity?.participations?.forEach((a: Participation) => {
    const element = svgElement
      .select("#i" + a.individualId)
      .node()
      .getBBox();
    lowestY = Math.min(lowestY, element.y);
  });
  return lowestY;
}

function getBoxOfExistingActivity(svgElement: any, activity: Activity) {
  return svgElement
    .select("#a" + activity.id)
    .node()
    .getBBox();
}
