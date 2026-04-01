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
          id: `${a.id}::${mapKey}::${segIdx}`,
          box,
          activityId: a.id,
          individualId: p.individualId,
          rowId: box.rowId,
          participation: p,
          participationKey: mapKey,
          segmentIndex: segIdx,
          segmentBeginning: segment.beginning,
          segmentEnding: segment.ending,
          segmentComponentId: segment.installationPeriod?.systemComponentId ?? "",
          activityColor,
        });
      });
    });
  });

  const participationGroups = new Map<string, any[]>();
  for (const part of parts) {
    const key = `${part.activityId}::${part.participationKey}`;
    const list = participationGroups.get(key);
    if (list) list.push(part);
    else participationGroups.set(key, [part]);
  }

  const transitions = buildParticipationTransitions(participationGroups);

  const adjustedBoxes = new Map<string, { x: number; y: number; width: number; height: number; rowId: string }>();
  parts.forEach((part) => {
    adjustedBoxes.set(part.id, { ...part.box });
  });
  const leftLeadAdjusted = new Set<string>();
  const rightLeadAdjusted = new Set<string>();

  const lead = PARTICIPATION_RIBBON_LEAD_PX;
  transitions.forEach(({ from, to }) => {
    const fromInstalled = !!from.segmentComponentId;
    const toInstalled = !!to.segmentComponentId;
    const fromBox = adjustedBoxes.get(from.id);
    const toBox = adjustedBoxes.get(to.id);
    if (!fromBox || !toBox) return;

    // The lead offset belongs on the individual-row segment so the installed
    // segment continues to align exactly with the installation period.
    if (fromInstalled && !toInstalled) {
      if (!leftLeadAdjusted.has(to.id)) {
        toBox.x += lead;
        toBox.width = Math.max(1, toBox.width - lead);
        leftLeadAdjusted.add(to.id);
      }
      return;
    }

    if (!fromInstalled && toInstalled) {
      if (!rightLeadAdjusted.has(from.id)) {
        fromBox.width = Math.max(1, fromBox.width - lead);
        rightLeadAdjusted.add(from.id);
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
    .attr("x", (d: any) => adjustedBoxes.get(d.id)?.x ?? d.box.x)
    .attr("y", (d: any) => adjustedBoxes.get(d.id)?.y ?? d.box.y)
    .attr("width", (d: any) => adjustedBoxes.get(d.id)?.width ?? d.box.width)
    .attr("height", (d: any) => adjustedBoxes.get(d.id)?.height ?? d.box.height)
    .attr("stroke", config.presentation.participation.stroke)
    .attr("stroke-dasharray", config.presentation.participation.strokeDasharray)
    .attr("stroke-width", config.presentation.participation.strokeWidth)
    .attr("fill", config.presentation.participation.fill)
    .attr("opacity", config.presentation.participation.opacity);

  // Draw dashed ribbons connecting participation segments on different rows
  drawParticipationRibbons(ctx, transitions, adjustedBoxes);

  hoverParticipations(ctx);
}

const PARTICIPATION_RIBBON_LEAD_PX = 24;

function drawParticipationRibbons(
  ctx: DrawContext,
  transitions: Array<{ from: any; to: any }>,
  adjustedBoxes: Map<string, { x: number; y: number; width: number; height: number; rowId: string }>
) {
  const { config, svgElement } = ctx;
  transitions.forEach(({ from, to }) => {
    const fromBox = adjustedBoxes.get(from.id) ?? from.box;
    const toBox = adjustedBoxes.get(to.id) ?? to.box;

    const fromIsUpper = fromBox.y < toBox.y;
    const upper = fromIsUpper ? { ...from, box: fromBox } : { ...to, box: toBox };
    const lower = fromIsUpper ? { ...to, box: toBox } : { ...from, box: fromBox };

    const upperTop = upper.box.y;
    const upperBottom = upper.box.y + upper.box.height;
    const lowerTop = lower.box.y;
    const lowerBottom = lower.box.y + lower.box.height;

    let pathData: string;
    if (fromIsUpper) {
      const xUpper = fromBox.x + fromBox.width;
      const xLower = toBox.x;
      pathData =
        `M ${xUpper} ${upperTop} L ${xUpper} ${upperBottom} ` +
        `L ${xLower} ${lowerBottom} L ${xLower} ${lowerTop} Z`;

      const edgePathData =
        `M ${xUpper} ${upperTop} L ${xLower} ${lowerTop} ` +
        `M ${xUpper} ${upperBottom} L ${xLower} ${lowerBottom}`;

      svgElement
        .append("path")
        .attr("class", "participationRibbon")
        .attr("d", pathData)
        .attr("fill", config.presentation.participation.fill)
        .attr("stroke", "none")
        .attr("opacity", config.presentation.participation.opacity)
        .attr("data-activity-id", from.activityId)
        .attr("data-individual-id", from.individualId)
        .attr("data-participation-key", from.participationKey)
        .attr("data-upper-row-id", upper.rowId)
        .attr("data-lower-row-id", lower.rowId)
        .attr("data-upper-top", upperTop)
        .attr("data-upper-bottom", upperBottom)
        .attr("data-lower-top", lowerTop)
        .attr("data-lower-bottom", lowerBottom)
        .attr("data-x-upper", fromIsUpper ? from.box.x + from.box.width : to.box.x)
        .attr("data-x-lower", fromIsUpper ? to.box.x : from.box.x + from.box.width)
        .attr("data-ribbon-direction", fromIsUpper ? "upper-to-lower" : "lower-to-upper");

      svgElement
        .append("path")
        .attr("class", "participationRibbonEdge")
        .attr("d", edgePathData)
        .attr("fill", "none")
        .attr("stroke", config.presentation.participation.stroke)
        .attr("stroke-dasharray", "6 3")
        .attr("stroke-width", config.presentation.participation.strokeWidth)
        .attr("opacity", config.presentation.participation.opacity)
        .attr("data-activity-id", from.activityId)
        .attr("data-individual-id", from.individualId)
        .attr("data-participation-key", from.participationKey)
        .attr("pointer-events", "visibleStroke");
    } else {
      const xLower = fromBox.x + fromBox.width;
      const xUpper = toBox.x;
      pathData =
        `M ${xLower} ${lowerTop} L ${xLower} ${lowerBottom} ` +
        `L ${xUpper} ${upperBottom} L ${xUpper} ${upperTop} Z`;

      const edgePathData =
        `M ${xUpper} ${upperTop} L ${xLower} ${lowerTop} ` +
        `M ${xUpper} ${upperBottom} L ${xLower} ${lowerBottom}`;

      svgElement
        .append("path")
        .attr("class", "participationRibbon")
        .attr("d", pathData)
        .attr("fill", config.presentation.participation.fill)
        .attr("stroke", "none")
        .attr("opacity", config.presentation.participation.opacity)
        .attr("data-activity-id", from.activityId)
        .attr("data-individual-id", from.individualId)
        .attr("data-participation-key", from.participationKey)
        .attr("data-upper-row-id", upper.rowId)
        .attr("data-lower-row-id", lower.rowId)
        .attr("data-upper-top", upperTop)
        .attr("data-upper-bottom", upperBottom)
        .attr("data-lower-top", lowerTop)
        .attr("data-lower-bottom", lowerBottom)
        .attr("data-x-upper", fromIsUpper ? from.box.x + from.box.width : to.box.x)
        .attr("data-x-lower", fromIsUpper ? to.box.x : from.box.x + from.box.width)
        .attr("data-ribbon-direction", fromIsUpper ? "upper-to-lower" : "lower-to-upper");

      svgElement
        .append("path")
        .attr("class", "participationRibbonEdge")
        .attr("d", edgePathData)
        .attr("fill", "none")
        .attr("stroke", config.presentation.participation.stroke)
        .attr("stroke-dasharray", "6 3")
        .attr("stroke-width", config.presentation.participation.strokeWidth)
        .attr("opacity", config.presentation.participation.opacity)
        .attr("data-activity-id", from.activityId)
        .attr("data-individual-id", from.individualId)
        .attr("data-participation-key", from.participationKey)
        .attr("pointer-events", "visibleStroke");
    }
  });
}

function buildParticipationTransitions(groups: Map<string, any[]>) {
  const transitions: Array<{ from: any; to: any }> = [];

  groups.forEach((segments) => {
    const byStart = new Map<number, any[]>();
    const byEnd = new Map<number, any[]>();

    segments.forEach((segment) => {
      const startList = byStart.get(segment.segmentBeginning);
      if (startList) startList.push(segment);
      else byStart.set(segment.segmentBeginning, [segment]);

      const endList = byEnd.get(segment.segmentEnding);
      if (endList) endList.push(segment);
      else byEnd.set(segment.segmentEnding, [segment]);
    });

    byEnd.forEach((endingSegments, boundary) => {
      const startingSegments = byStart.get(boundary);
      if (!startingSegments) return;

      endingSegments.forEach((from) => {
        startingSegments.forEach((to) => {
          if (from === to || from.rowId === to.rowId) return;

          const fromInstalled = !!from.segmentComponentId;
          const toInstalled = !!to.segmentComponentId;

          // Do not draw ribbons directly between two installation rows.
          if (fromInstalled && toInstalled) return;

          transitions.push({ from, to });
        });
      });
    });
  });

  return transitions;
}

function hoverParticipations(ctx: DrawContext) {
  const { config, svgElement, tooltip, activities } = ctx;
  const getTooltipParticipation = (currentElement: Element | null, datum: any) => {
    if (datum?.participation) {
      return datum;
    }

    const activityId = currentElement?.getAttribute("data-activity-id");
    const participationKey = currentElement?.getAttribute("data-participation-key");
    if (!activityId || !participationKey) {
      return undefined;
    }

    const activity = activities.find((candidate) => candidate.id === activityId);
    const participation = activity?.participations.get(participationKey);
    if (!participation) {
      return undefined;
    }

    return { activity, participation, participationKey };
  };

  const setParticipationHoverState = (
    activityId: string,
    participationKey: string,
    hovered: boolean
  ) => {
    const opacity = hovered
      ? config.presentation.participation.opacityHover
      : config.presentation.participation.opacity;

    svgElement
      .selectAll(`.participation[data-activity-id="${activityId}"][data-participation-key="${participationKey}"]`)
      .attr("opacity", opacity);

    svgElement
      .selectAll(`.participationRibbon[data-activity-id="${activityId}"][data-participation-key="${participationKey}"]`)
      .attr("opacity", opacity);

    svgElement
      .selectAll(`.participationRibbonEdge[data-activity-id="${activityId}"][data-participation-key="${participationKey}"]`)
      .attr("opacity", opacity);
  };

  svgElement
    .selectAll(".participation, .participationRibbon, .participationRibbonEdge")
    .on("mouseover", function (event: MouseEvent) {
      mouseOverElement = event.target as HTMLElement;
      const currentElement = event.currentTarget as Element | null;
      const activityId = currentElement?.getAttribute("data-activity-id");
      const participationKey = currentElement?.getAttribute("data-participation-key");
      if (activityId && participationKey) {
        setParticipationHoverState(activityId, participationKey, true);
      }
      tooltip.style("display", "block");
    })
    .on("mouseout", function (event: MouseEvent) {
      if (mouseOverElement) {
        const currentElement = event.currentTarget as Element | null;
        const activityId = currentElement?.getAttribute("data-activity-id");
        const participationKey = currentElement?.getAttribute("data-participation-key");
        if (activityId && participationKey) {
          setParticipationHoverState(activityId, participationKey, false);
        }
        mouseOverElement = null;
      }
      tooltip.style("display", "none");
    })
    .on("mousemove", function (event: MouseEvent, d: any) {
      const currentElement = event.currentTarget as Element | null;
      tooltip.html(participationTooltip(getTooltipParticipation(currentElement, d)));
      if (event.pageX < window.innerWidth / 2) {
        tooltip
          .style("top", event.pageY + 20 + "px")
          .style("left", event.pageX + "px");
      } else {
        const tooltipNode = tooltip?.node();
        const ttWidth = tooltipNode ? tooltipNode.getBoundingClientRect().width : 0;
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
        .selectAll(`.participation[data-activity-id="${a.id}"][data-participation-key="${mapKey}"], .participationRibbon[data-activity-id="${a.id}"][data-participation-key="${mapKey}"], .participationRibbonEdge[data-activity-id="${a.id}"][data-participation-key="${mapKey}"]`)
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
  if (part?.participation?.role)
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