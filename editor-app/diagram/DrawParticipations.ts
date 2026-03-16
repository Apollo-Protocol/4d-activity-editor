import { MouseEvent } from "react";
import { Activity } from "@/lib/Schema";
import { ENTITY_TYPE_IDS, getEntityTypeIdFromIndividual } from "@/lib/entityTypes";
import { DrawContext } from "./DrawHelpers";
import { getActiveInstallationForActivity } from "@/utils/installations";

let mouseOverElement: any | null = null;

export function drawParticipations(ctx: DrawContext) {
  const { config, svgElement, activities } = ctx;

  const parts: any[] = [];
  activities.forEach((a) => {
    a.participations?.forEach((p) => {
      const box = getPositionOfParticipation(ctx, svgElement, a, p.individualId);
      if (!box) return;
      parts.push({
        box,
        activityId: a.id,
        individualId: p.individualId,
        rowId: box.rowId,
        participation: p,
      });
    });
  });

  svgElement
    .selectAll(".participation")
    .data(parts.values())
    .join("rect")
    .attr("class", "participation")
    .attr("id", (p: any) => "p" + p.activityId + p.individualId)
    .attr("data-individual-id", (p: any) => p.individualId)
    .attr("data-row-id", (p: any) => p.rowId)
    .attr("data-activity-id", (p: any) => p.activityId)
    .attr("x", (d: any) => d.box.x)
    .attr("y", (d: any) => d.box.y)
    .attr("width", (d: any) => d.box.width)
    .attr("height", (d: any) => d.box.height)
    .attr("stroke", config.presentation.participation.stroke)
    .attr("stroke-dasharray", config.presentation.participation.strokeDasharray)
    .attr("stroke-width", config.presentation.participation.strokeWidth)
    .attr("fill", config.presentation.participation.fill)
    .attr("opacity", config.presentation.participation.opacity);

  hoverParticipations(ctx);
}

function hoverParticipations(ctx: DrawContext) {
  const { config, svgElement, tooltip } = ctx;
  svgElement
    .selectAll(".participation")
    .on("mouseover", function (event: MouseEvent) {
      mouseOverElement = event.target as HTMLElement;
      mouseOverElement.style.opacity =
        config.presentation.participation.opacityHover;
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
      tooltip.html(participationTooltip(d));
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

export function clickParticipations(
  ctx: DrawContext,
  clickParticipation: any,
  rightClickParticipation: any
) {
  const { svgElement, activities } = ctx;

  activities.forEach((a) => {
    a.participations.forEach((p) => {
      svgElement
        .select("#p" + a.id + p.individualId)
        .on("click", function (event: MouseEvent) {
          clickParticipation(a, p);
        });
      svgElement
        .select("#p" + a.id + p.individualId)
        .on("contextmenu", function (event: MouseEvent) {
          event.preventDefault();
          rightClickParticipation(a, p);
        });
    });
  });
}

function participationTooltip(part: any) {
  let tip = "<strong>Participant</strong>";
  if (part.participation.role)
    tip += "<br/> Role: " + part.participation.role.name;
  return tip;
}

function getPositionOfParticipation(
  ctx: DrawContext,
  svgElement: any,
  activity: Activity,
  individualId: string
) {
  const activityNode = svgElement.select("#a" + activity.id).node();
  if (!activityNode) return null;
  const activityElement = activityNode.getBBox();

  const x = activityElement.x;
  const width = activityElement.width;

  const individual = ctx.individuals.find((i) => i.id === individualId);
  if (!individual) return null;

  let drawRowId = individualId;
  const activeInstallation = getActiveInstallationForActivity(individual, activity);
  const installedTarget = activeInstallation
    ? ctx.individuals.find((i) => i.id === activeInstallation.systemComponentId)
    : individual.installedIn
    ? ctx.individuals.find((i) => i.id === individual.installedIn)
    : undefined;
  const isInstalledInComponent =
    !!installedTarget &&
    getEntityTypeIdFromIndividual(installedTarget) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT;

  if (isInstalledInComponent && activeInstallation) {
    drawRowId = installedTarget.id;
  }

  const individualNode = svgElement.select("#i" + drawRowId).node();
  if (!individualNode) return null;
  const individualElement = individualNode.getBBox();

  const rowLeft = individualElement.x;
  const rowRight = individualElement.x + individualElement.width;
  const clippedX = Math.max(x, rowLeft);
  const clippedRight = Math.min(x + width, rowRight);
  if (clippedRight <= clippedX) return null;

  const y = individualElement.y;
  const height = individualElement.height;

  return {
    x: clippedX,
    y: y,
    width: clippedRight - clippedX,
    height: height,
    rowId: drawRowId,
  };
}