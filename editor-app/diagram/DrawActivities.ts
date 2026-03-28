import { MouseEvent } from "react";
import { Activity, Individual, Participation } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import {
  DrawContext,
  Label,
  removeLabelIfItOverlaps,
  keepIndividualLabels,
} from "./DrawHelpers";
import { ENTITY_TYPE_IDS, getEntityTypeIdFromIndividual } from "@/lib/entityTypes";
import { ConfigData } from "./config";
import { activity } from "@apollo-protocol/hqdm-lib";
import {
  getActiveInstallationForActivity,
  getInstallationPeriods,
} from "@/utils/installations";

let mouseOverElement: any | null = null;

export function drawActivities(ctx: DrawContext) {
  const { config, svgElement, activities, individuals, dataset, collapsedSystems } = ctx;

  if (activities.length === 0) {
    return svgElement;
  }

  const activityTimes = activities
    .flatMap((a) => [a.beginning, a.ending])
    .filter((t) => Number.isFinite(t) && t !== -1 && t < Model.END_OF_TIME);
  const individualTimes = individuals
    .flatMap((i) => [i.beginning, i.ending])
    .filter((t) => Number.isFinite(t) && t !== -1 && t < Model.END_OF_TIME);

  const installationTimes = individuals
    .flatMap((individual) =>
      getInstallationPeriods(individual).flatMap((period) => [
        period.beginning,
        period.ending,
      ])
    )
    .filter((t) => Number.isFinite(t) && t >= 0 && t < Model.END_OF_TIME);

  const allTimes = [...activityTimes, ...individualTimes, ...installationTimes];
  let startOfTime = 0;
  let endOfTime = 1;
  if (allTimes.length > 0) {
    startOfTime = Math.min(0, ...allTimes);
    endOfTime = Math.max(...allTimes);
    const duration = endOfTime - startOfTime;
    if (duration > 0) {
      const bufferPct = (config.viewPort.timelineBuffer ?? 2) / 100;
      endOfTime += duration * bufferPct; // configurable buffer for ribbons and chevrons
    }
  }
  if (endOfTime <= startOfTime) {
    endOfTime = startOfTime + 1;
  }

  // Enforce minimum timeline span (configurable)
  const minSpan = config.viewPort.minTimelineSpan ?? 11;
  if (minSpan > 0 && endOfTime - startOfTime < minSpan) {
    endOfTime = startOfTime + minSpan;
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

  svgElement.selectAll(".activity")
    .data(activities.values())
    .join("rect")
    .attr("class", "activity")
    .attr("id", (a: Activity) => "a" + a["id"])
    .attr("x", (a: Activity) => {
      return x + timeInterval * (a.beginning - startOfTime);
    })
    .attr("y", (a: Activity) => {
      return (
        calculateTopPositionOfNewActivity(svgElement, a, individuals, dataset, collapsedSystems) -
        config.layout.individual.gap * 0.3
      );
    })
    .attr("width", (a: Activity) => {
      return (a.ending - a.beginning) * timeInterval;
    })
    .attr("height", (a: Activity) => {
      const bottomY = calculateLengthOfNewActivity(svgElement, a, individuals, dataset, collapsedSystems);
      const topY = calculateTopPositionOfNewActivity(svgElement, a, individuals, dataset, collapsedSystems);
      return bottomY
        ? bottomY - topY + config.layout.individual.gap * 0.6
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
    calculateTopPositionOfNewActivity(svgElement, a, individuals, dataset, collapsedSystems) -
    config.layout.individual.gap * 0.3;
  const widthOf = (a: Activity) => (a.ending - a.beginning) * timeInterval;
  const heightOf = (a: Activity) => {
    const bottomY = calculateLengthOfNewActivity(svgElement, a, individuals, dataset, collapsedSystems);
    const topY = calculateTopPositionOfNewActivity(svgElement, a, individuals, dataset, collapsedSystems);
    return bottomY ? bottomY - topY + config.layout.individual.gap * 0.6 : 0;
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
        mouseOverElement.style.opacity = "";
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

function calculateLengthOfNewActivity(
  svgElement: any,
  activity: Activity,
  individuals: Individual[],
  dataset?: Model,
  collapsedSystems?: ReadonlySet<string>
) {
  return calculateActivityBottom(svgElement, activity, individuals, dataset, collapsedSystems);
}

function resolveParticipationRowId(
  activity: Activity,
  individual: Individual,
  individuals: Individual[],
  dataset?: Model,
  collapsedSystems?: ReadonlySet<string>
) {
  const activeInstallation = getActiveInstallationForActivity(individual, activity);
  const installedTarget = activeInstallation
    ? individuals.find((i) => i.id === activeInstallation.systemComponentId)
    : individual.installedIn
    ? individuals.find((i) => i.id === individual.installedIn)
    : undefined;
  const isInstalledInComponent =
    !!installedTarget &&
    getEntityTypeIdFromIndividual(installedTarget) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT;

  if (!isInstalledInComponent) {
    // Component not in the filtered individuals list — it may have been hidden
    // because its parent system is collapsed. Look up the full dataset to find
    // the component's host system and resolve to that system row instead.
    if (collapsedSystems && collapsedSystems.size > 0 && dataset) {
      const componentId = activeInstallation?.systemComponentId
        ?? individual.installedIn;
      if (componentId) {
        const fullComponent = dataset.individuals.get(componentId);
        if (
          fullComponent &&
          getEntityTypeIdFromIndividual(fullComponent) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
          fullComponent.installedIn &&
          collapsedSystems.has(fullComponent.installedIn)
        ) {
          return fullComponent.installedIn;
        }
      }
    }
    return individual.id;
  }

  if (!activeInstallation) {
    return individual.id;
  }

  const installedSystem = installedTarget.installedIn
    ? individuals.find((i) => i.id === installedTarget.installedIn)
    : undefined;
  const isInstalledInSystem =
    !!installedSystem &&
    getEntityTypeIdFromIndividual(installedSystem) === ENTITY_TYPE_IDS.SYSTEM;

  return isInstalledInSystem ? installedSystem.id : installedTarget.id;
}

function calculateActivityBottom(
  svgElement: any,
  activity: Activity,
  individuals: Individual[],
  dataset?: Model,
  collapsedSystems?: ReadonlySet<string>
) {
  let maxBottom = 0;
  activity?.participations?.forEach((a: Participation) => {
    const individual = individuals.find((i) => i.id === a.individualId);
    if (!individual) return;
    const rowId = resolveParticipationRowId(activity, individual, individuals, dataset, collapsedSystems);
    const node = svgElement.select("#i" + rowId).node();
    if (node) {
      const bbox = node.getBBox();
      maxBottom = Math.max(maxBottom, bbox.y + bbox.height);
    }
  });
  return maxBottom > 0 ? maxBottom : null;
}

function calculateTopPositionOfNewActivity(
  svgElement: any,
  activity: Activity,
  individuals: Individual[],
  dataset?: Model,
  collapsedSystems?: ReadonlySet<string>
) {
  return calculateActivityTop(svgElement, activity, individuals, dataset, collapsedSystems);
}

function calculateActivityTop(
  svgElement: any,
  activity: Activity,
  individuals: Individual[],
  dataset?: Model,
  collapsedSystems?: ReadonlySet<string>
) {
  let lowestY = Number.MAX_VALUE;
  activity?.participations?.forEach((a: Participation) => {
    const individual = individuals.find((i) => i.id === a.individualId);
    if (!individual) return;
    const rowId = resolveParticipationRowId(activity, individual, individuals, dataset, collapsedSystems);
    const node = svgElement.select("#i" + rowId).node();
    if (!node) return;
    const element = node.getBBox();
    lowestY = Math.min(lowestY, element.y);
  });
  return lowestY === Number.MAX_VALUE ? 0 : lowestY;
}

function getBoxOfExistingActivity(svgElement: any, activity: Activity) {
  return svgElement
    .select("#a" + activity.id)
    .node()
    .getBBox();
}


