import { MouseEvent } from "react";
import { Activity, Individual, Participation } from "@/lib/Schema";
import { Model } from "@/lib/Model";
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

  // Expand time range to include installed components' actual installation periods
  if (individuals) {
    individuals.forEach((ind) => {
      if (ind.id.includes("__installed_in__")) {
        const parts = ind.id.split("__installed_in__");
        if (parts.length === 2) {
          const originalId = parts[0];
          const slotId = parts[1];
          const original = dataset.individuals.get(originalId);
          if (original && original.installations) {
            const inst = original.installations.find(
              (x) => x.targetId === slotId
            );
            if (inst) {
              // Ensure beginning is at least 0
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
    });
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

  let x = config.layout.individual.xMargin;
  x += config.layout.individual.temporalMargin;
  if (individualLabelsEnabled) {
    x += config.layout.individual.textLength;
  }

  // Filter out activities that have no valid participations (orphaned activities)
  const getParticipationArray = (a: Activity): Participation[] => {
    if (!a.participations) return [];
    // support both Map and Array storage
    if (a.participations instanceof Map) {
      return Array.from(a.participations.values());
    }
    return a.participations as Participation[];
  };

  const validActivities = Array.from(activities.values()).filter((a) => {
    const parts = getParticipationArray(a);
    if (!parts || parts.length === 0) return false;
    return parts.some((p) => {
      const node = svgElement.select("#i" + CSS.escape(p.individualId)).node();
      return node !== null;
    });
  });

  svgElement
    .selectAll(".activity")
    // FIX: Add key function (a.id) to ensure data binds to correct element even if reordered
    .data(validActivities, (a: Activity) => a.id)
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
    // Make the top-level activity rect invisible so per-participation blocks show clearly.
    // (keeps DOM elements for hit-testing / layout if other code relies on them)
    .attr("stroke", "none")
    .attr("fill", "none")
    .attr("opacity", 1);

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
  let foundAny = false;

  activity?.participations?.forEach((a: Participation) => {
    // Use CSS.escape to handle special characters in virtual row IDs (like __)
    const escapedId = CSS.escape(a.individualId);
    const node = svgElement.select("#i" + escapedId).node();
    if (node) {
      foundAny = true;
      const element = node.getBBox();
      highestY = Math.max(highestY, element.y + element.height);
    }
  });

  return foundAny ? highestY : null;
}

function calculateTopPositionOfNewActivity(
  svgElement: any,
  activity: Activity
) {
  let lowestY = Number.MAX_VALUE;
  let foundAny = false;

  activity?.participations?.forEach((a: Participation) => {
    // Use CSS.escape to handle special characters in virtual row IDs (like __)
    const escapedId = CSS.escape(a.individualId);
    const node = svgElement.select("#i" + escapedId).node();
    if (node) {
      foundAny = true;
      const element = node.getBBox();
      lowestY = Math.min(lowestY, element.y);
    }
  });

  return foundAny ? lowestY : 0;
}

function getBoxOfExistingActivity(svgElement: any, activity: Activity) {
  const node = svgElement.select("#a" + activity.id).node();
  if (node) {
    return node.getBBox();
  }
  return { x: 0, y: 0, width: 0, height: 0 };
}
