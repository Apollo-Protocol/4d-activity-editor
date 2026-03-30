import { MouseEvent } from "react";
import { Activity, participationMapKey } from "@/lib/Schema";
import { ENTITY_TYPE_IDS, getEntityTypeIdFromIndividual } from "@/lib/entityTypes";
import { DrawContext } from "./DrawHelpers";
import {
  getActiveInstallationForActivity,
  splitParticipationByInstallations,
  ParticipationSegment,
} from "@/utils/installations";

let mouseOverElement: any | null = null;

export function drawParticipations(ctx: DrawContext) {
  const { config, svgElement, activities } = ctx;

  const parts: any[] = [];
  activities.forEach((a, actIdx) => {
    a.participations?.forEach((p, mapKey) => {
      const individual = ctx.individuals.find((i) => i.id === p.individualId);
      if (!individual) return;

      const activityColor =
        a.color ||
        config.presentation.activity.fill[
          actIdx % config.presentation.activity.fill.length
        ];

      const segments = splitParticipationByInstallations(individual, a, mapKey);
      segments.forEach((segment, segIdx) => {
        const box = getPositionOfParticipation(ctx, svgElement, a, p.individualId, mapKey, segment);
        if (!box) return;
        parts.push({
          box,
          activityId: a.id,
          individualId: p.individualId,
          rowId: box.rowId,
          participation: p,
          participationKey: mapKey,
          segmentIndex: segIdx,
          activityColor,
        });
      });
    });
  });

  // ── Apply ribbon lead offsets to participation boxes ──
  // Group by (activity, individual), then for consecutive segments on
  // different rows, shrink the individual-row segment by the ribbon lead so
  // the participation block starts/ends where the ribbon meets it — exactly
  // like installation connector ribbons do.
  const groups = new Map<string, any[]>();
  for (const part of parts) {
    const key = `${part.activityId}::${part.participationKey}`;
    const list = groups.get(key);
    if (list) list.push(part);
    else groups.set(key, [part]);
  }

  const lead = PARTICIPATION_RIBBON_LEAD_PX;
  groups.forEach((segs) => {
    if (segs.length < 2) return;
    segs.sort((a: any, b: any) => a.segmentIndex - b.segmentIndex);

    for (let i = 0; i < segs.length - 1; i++) {
      const segA = segs[i];
      const segB = segs[i + 1];
      if (segA.rowId === segB.rowId) continue;

      const aIsUpper = segA.box.y < segB.box.y;
      // Installed (component) row = upper, Individual row = lower
      // The lower-row segment gets the lead offset away from the transition.
      if (aIsUpper) {
        // segA is upper (installed), segB is lower (individual row)
        // segB left edge shifts RIGHT by lead
        segB.box.x += lead;
        segB.box.width = Math.max(1, segB.box.width - lead);
      } else {
        // segA is lower (individual row), segB is upper (installed)
        // segA right edge shifts LEFT by lead
        segA.box.width = Math.max(1, segA.box.width - lead);
      }
    }
  });

  svgElement
    .selectAll(".participation")
    .data(parts.values())
    .join("rect")
    .attr("class", "participation")
    .attr("id", (p: any) => "p" + p.activityId + p.participationKey + "_s" + p.segmentIndex)
    .attr("data-individual-id", (p: any) => p.individualId)
    .attr("data-participation-key", (p: any) => p.participationKey)
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

  // Draw dashed ribbons connecting participation segments on different rows
  drawParticipationRibbons(ctx, groups);

  hoverParticipations(ctx);
}

const PARTICIPATION_RIBBON_LEAD_PX = 24;

function drawParticipationRibbons(
  ctx: DrawContext,
  groups: Map<string, any[]>
) {
  const { config, svgElement } = ctx;
  const lead = PARTICIPATION_RIBBON_LEAD_PX;

  groups.forEach((segments) => {
    if (segments.length < 2) return;
    // Already sorted by offset-application loop above

    const activityColor = segments[0].activityColor;

    for (let i = 0; i < segments.length - 1; i++) {
      const segA = segments[i];
      const segB = segments[i + 1];
      if (segA.rowId === segB.rowId) continue;

      const aIsUpper = segA.box.y < segB.box.y;
      const upper = aIsUpper ? segA : segB;
      const lower = aIsUpper ? segB : segA;

      const upperTop = upper.box.y;
      const upperBottom = upper.box.y + upper.box.height;
      const lowerTop = lower.box.y;
      const lowerBottom = lower.box.y + lower.box.height;

      let pathData: string;
      if (aIsUpper) {
        // installed → free: upper segment ends, lower segment starts offset
        // Upper right edge at its box right, lower left edge already shifted
        const xUpper = segA.box.x + segA.box.width; // component-row edge
        const xLower = segB.box.x;                   // individual-row edge (already offset)
        pathData =
          `M ${xUpper} ${upperTop} L ${xUpper} ${upperBottom} ` +
          `L ${xLower} ${lowerBottom} L ${xLower} ${lowerTop} Z`;
      } else {
        // free → installed: lower segment ends, upper segment starts
        const xLower = segA.box.x + segA.box.width; // individual-row edge (already trimmed)
        const xUpper = segB.box.x;                   // component-row edge
        pathData =
          `M ${xLower} ${lowerTop} L ${xLower} ${lowerBottom} ` +
          `L ${xUpper} ${upperBottom} L ${xUpper} ${upperTop} Z`;
      }

      svgElement
        .append("path")
        .attr("class", "participationRibbon")
        .attr("d", pathData)
        .attr("fill", config.presentation.participation.fill)
        .attr("stroke", config.presentation.participation.stroke)
        .attr("stroke-dasharray", "6 3")
        .attr("stroke-width", config.presentation.participation.strokeWidth)
        .attr("opacity", config.presentation.participation.opacity)
        .attr("data-activity-id", segments[0].activityId)
        .attr("data-individual-id", segments[0].individualId);
    }
  });
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
    a.participations.forEach((p, mapKey) => {
      svgElement
        .selectAll(`.participation[data-activity-id="${a.id}"][data-participation-key="${mapKey}"]`)
        .on("click", function (event: MouseEvent) {
          clickParticipation(a, p);
        })
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
  individualId: string,
  participationKey: string,
  segment?: ParticipationSegment
) {
  const activityNode = svgElement.select("#a" + activity.id).node();
  if (!activityNode) return null;
  const activityElement = activityNode.getBBox();

  const x = activityElement.x;
  const width = activityElement.width;

  // Use segment bounds when provided, otherwise full participation bounds
  const participation = activity.participations.get(participationKey);
  const effectiveBeginning = segment
    ? segment.beginning
    : Math.max(activity.beginning, participation?.beginning ?? activity.beginning);
  const effectiveEnding = segment
    ? segment.ending
    : Math.min(activity.ending, participation?.ending ?? activity.ending);

  if (effectiveEnding <= effectiveBeginning) return null;

  const activityDuration = activity.ending - activity.beginning;
  const participationOffset = activityDuration > 0
    ? ((effectiveBeginning - activity.beginning) / activityDuration) * width
    : 0;
  const participationWidth = activityDuration > 0
    ? ((effectiveEnding - effectiveBeginning) / activityDuration) * width
    : width;
  const effectiveX = x + participationOffset;

  const individual = ctx.individuals.find((i) => i.id === individualId);
  if (!individual) return null;

  let drawRowId = individualId;

  if (segment?.installationPeriod) {
    // During installation — draw on the target component row (or collapsed system row)
    const componentId = segment.installationPeriod.systemComponentId;
    const installedTarget = ctx.individuals.find((i) => i.id === componentId);
    const isInstalledInComponent =
      !!installedTarget &&
      getEntityTypeIdFromIndividual(installedTarget) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT;

    if (isInstalledInComponent) {
      drawRowId = installedTarget.id;
    } else if (ctx.collapsedSystems && ctx.collapsedSystems.size > 0 && ctx.dataset) {
      const fullComponent = ctx.dataset.individuals.get(componentId);
      if (
        fullComponent &&
        getEntityTypeIdFromIndividual(fullComponent) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
        fullComponent.installedIn &&
        ctx.collapsedSystems.has(fullComponent.installedIn)
      ) {
        drawRowId = fullComponent.installedIn;
      }
    }
  } else if (!segment) {
    // Legacy path when no segment provided — use old installation check
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
    } else if (!isInstalledInComponent && ctx.collapsedSystems && ctx.collapsedSystems.size > 0 && ctx.dataset) {
      const componentId = activeInstallation?.systemComponentId ?? individual.installedIn;
      if (componentId) {
        const fullComponent = ctx.dataset.individuals.get(componentId);
        if (
          fullComponent &&
          getEntityTypeIdFromIndividual(fullComponent) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
          fullComponent.installedIn &&
          ctx.collapsedSystems.has(fullComponent.installedIn)
        ) {
          drawRowId = fullComponent.installedIn;
        }
      }
    }
  }
  // else: segment without installationPeriod → individual's own row

  const individualNode = svgElement.select("#i" + drawRowId).node();
  if (!individualNode) return null;
  const individualElement = individualNode.getBBox();

  const rowLeft = individualElement.x;
  const rowRight = individualElement.x + individualElement.width;
  const clippedX = Math.max(effectiveX, rowLeft);
  const clippedRight = Math.min(effectiveX + participationWidth, rowRight);
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