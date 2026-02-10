import { MouseEvent } from "react";
import { Activity, Individual, Participation } from "@/lib/Schema";
import {
  DrawContext,
  Label,
  removeLabelIfItOverlaps,
  keepIndividualLabels,
} from "./DrawHelpers";
import { ConfigData } from "./config";
import { activity } from "@apollo-protocol/hqdm-lib";

let mouseOverElement: any | null = null;

export function drawActivities(ctx: DrawContext) {
  const { config, svgElement, activities, individuals, dataset } = ctx;

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
        config.layout.individual.gap * 0.3
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
            config.layout.individual.gap * 0.6 +
            config.layout.individual.height
        : 0;
    })
    .attr("stroke", (a: Activity, i: number) => {
      return config.presentation.activity.stroke[
        i % config.presentation.activity.stroke.length
      ];
    })
    .attr("stroke-dasharray", config.presentation.activity.strokeDasharray)
    .attr("stroke-width", config.presentation.activity.strokeWidth)
    .attr("fill", (a: Activity, i: number) => {
      return a.color || config.presentation.activity.fill[
        i % config.presentation.activity.fill.length
      ];
    })
    .attr("opacity", config.presentation.activity.opacity);

  // small helper functions to reuse computations
  const xOf = (a: Activity) => x + timeInterval * (a.beginning - startOfTime);
  const yOf = (a: Activity) =>
    calculateTopPositionOfNewActivity(svgElement, a) -
    config.layout.individual.gap * 0.3;
  const widthOf = (a: Activity) => (a.ending - a.beginning) * timeInterval;
  const heightOf = (a: Activity) => {
    const h = calculateLengthOfNewActivity(svgElement, a);
    return h
      ? h -
          calculateTopPositionOfNewActivity(svgElement, a) +
          config.layout.individual.gap * 0.6 +
          config.layout.individual.height
      : 0;
  };

  // Subtask badge rendering removed — badge no longer drawn on activities.

  labelActivities(ctx, x, timeInterval, startOfTime);

  return svgElement;
}

function labelActivities(
  ctx: DrawContext,
  startingPosition: number,
  timeInterval: number,
  startOfTime: number
) {
  // Labels are now provided via the external legend; do not draw activity text on the SVG.
  return;
}

export function hoverActivities(ctx: DrawContext) {
  const { config, svgElement, tooltip } = ctx;

  svgElement
    .selectAll(".activity")
    .on("mouseover", function (event: MouseEvent) {
      mouseOverElement = event.target as HTMLElement;
      mouseOverElement.style.opacity =
        config.presentation.activity.opacityHover;
      tooltip.style("display", "block");
    })
    .on("mouseout", function (event: MouseEvent) {
      if (mouseOverElement) {
        mouseOverElement.style.opacity = config.presentation.activity.opacity;
        mouseOverElement = null;
      }
      tooltip.style("display", "none");
    })
    .on("mousemove", function (event: MouseEvent, d: any) {
      tooltip.html(activityTooltip(ctx, d));
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

function activityTooltip(ctx: DrawContext, activity: Activity) {
  let tip = "<strong>Activity</strong>";
  if (activity.name) tip += "<br/> Name: " + activity.name;
  if (activity.type) tip += "<br/> Type: " + activity.type.name;
  if (activity.description) tip += "<br/> Description: " + activity.description;
  if (activity.beginning !== undefined)
    tip += "<br/> Beginning: " + activity.beginning;
  if (activity.ending) tip += "<br/> Ending: " + activity.ending;
  if (ctx.dataset.hasParts(activity.id)) tip += "<br/> Has sub-tasks";
  return tip;
}

export function clickActivities(
  ctx: DrawContext,
  clickActivity: any,
  rightClickActivity: any
) {
  const { svgElement, activities } = ctx;
  activities.forEach((a) => {
    const lclick = (e: MouseEvent) => clickActivity(a);
    const rclick = (e: MouseEvent) => {
      e.preventDefault();
      rightClickActivity(a);
    };

    svgElement
      .select("#a" + a.id)
      .on("click", lclick)
      .on("contextmenu", rclick);
    svgElement
      .select("#al" + a.id)
      .on("click", lclick)
      .on("contextmenu", rclick);
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
