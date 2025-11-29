import { MouseEvent } from "react";
import { Activity, Participation, EntityType } from "@/lib/Schema";
import { ConfigData } from "./config";
import { DrawContext } from "./DrawHelpers";
import { Model } from "@/lib/Model";

let mouseOverElement: any | null = null;

function isInstallationRefId(id: string): boolean {
  return id.includes("__installed_in__");
}

// Updated to handle format: componentId__installed_in__targetId__installationId
function getOriginalAndTarget(
  id: string
): { originalId: string; targetId: string; installationId?: string } | null {
  if (!isInstallationRefId(id)) return null;
  const parts = id.split("__installed_in__");
  if (parts.length !== 2) return null;

  const originalId = parts[0];
  const rest = parts[1];

  // rest could be "targetId" (old format) or "targetId__installationId" (new format)
  const restParts = rest.split("__");
  const targetId = restParts[0];
  const installationId = restParts.length > 1 ? restParts[1] : undefined;

  return { originalId, targetId, installationId };
}

// Add helper to get target effective time bounds
function getTargetEffectiveTimeBounds(
  targetId: string,
  dataset: any
): { beginning: number; ending: number } {
  const target = dataset.individuals.get(targetId);
  if (!target) {
    return { beginning: 0, ending: Model.END_OF_TIME };
  }

  let beginning = target.beginning;
  let ending = target.ending;

  const targetType = target.entityType ?? EntityType.Individual;

  // If target is a SystemComponent, get bounds from its installation
  if (targetType === EntityType.SystemComponent) {
    if (target.installations && target.installations.length > 0) {
      const inst = target.installations[0];
      if (beginning < 0) {
        beginning = inst.beginning >= 0 ? inst.beginning : 0;
      }
      if (ending >= Model.END_OF_TIME && inst.ending < Model.END_OF_TIME) {
        ending = inst.ending;
      }
    }
  }

  // If target is a System, use its defined bounds
  if (targetType === EntityType.System) {
    if (beginning < 0) beginning = 0;
  }

  if (beginning < 0) beginning = 0;

  return { beginning, ending };
}

// Update getVisibleInterval to handle SystemComponents and other entities
function getVisibleInterval(
  activityStart: number,
  activityEnd: number,
  individualId: string,
  dataset: any
): { start: number; end: number } {
  const ref = getOriginalAndTarget(individualId);

  if (ref) {
    // This is an installation reference - crop to installation period AND target bounds
    const original = dataset.individuals.get(ref.originalId);
    if (!original || !original.installations) {
      return { start: activityStart, end: activityEnd };
    }

    // Find the specific installation
    let inst;
    if (ref.installationId) {
      inst = original.installations.find(
        (i: any) => i.id === ref.installationId
      );
    }
    if (!inst) {
      inst = original.installations.find(
        (i: any) => i.targetId === ref.targetId
      );
    }
    if (!inst) {
      return { start: activityStart, end: activityEnd };
    }

    // Get installation bounds
    const instStart = Math.max(0, inst.beginning ?? 0);
    const instEnd = inst.ending ?? Model.END_OF_TIME;

    // Get target bounds
    const targetBounds = getTargetEffectiveTimeBounds(ref.targetId, dataset);

    // Compute the most restrictive bounds (intersection of all three)
    const visibleStart = Math.max(
      activityStart,
      instStart,
      targetBounds.beginning
    );
    const visibleEnd = Math.min(
      activityEnd,
      instEnd,
      targetBounds.ending < Model.END_OF_TIME
        ? targetBounds.ending
        : activityEnd
    );

    return { start: visibleStart, end: visibleEnd };
  }

  // Not an installation reference - check if it's a regular individual
  const individual = dataset.individuals.get(individualId);
  if (!individual) {
    return { start: activityStart, end: activityEnd };
  }

  const entityType = individual.entityType ?? EntityType.Individual;

  // For SystemComponents, clip to their effective time bounds (from installations)
  if (entityType === EntityType.SystemComponent) {
    const targetBounds = getTargetEffectiveTimeBounds(individualId, dataset);

    const visibleStart = Math.max(activityStart, targetBounds.beginning);
    const visibleEnd = Math.min(
      activityEnd,
      targetBounds.ending < Model.END_OF_TIME
        ? targetBounds.ending
        : activityEnd
    );

    return { start: visibleStart, end: visibleEnd };
  }

  // For Systems, clip to their time bounds if set
  if (entityType === EntityType.System) {
    const sysBeginning = individual.beginning >= 0 ? individual.beginning : 0;
    const sysEnding =
      individual.ending < Model.END_OF_TIME ? individual.ending : activityEnd;

    const visibleStart = Math.max(activityStart, sysBeginning);
    const visibleEnd = Math.min(activityEnd, sysEnding);

    return { start: visibleStart, end: visibleEnd };
  }

  // For InstalledComponents (the parent, not a specific installation),
  // we shouldn't draw participation on the parent row itself
  // But if we do, use full activity interval
  if (entityType === EntityType.InstalledComponent) {
    return { start: activityStart, end: activityEnd };
  }

  // For regular Individuals, check if they have fixed time bounds
  // Only clip if they have explicit bounds set (not using participant-based timing)
  if (individual.beginning >= 0 || individual.ending < Model.END_OF_TIME) {
    const indBeginning = individual.beginning >= 0 ? individual.beginning : 0;
    const indEnding =
      individual.ending < Model.END_OF_TIME ? individual.ending : activityEnd;

    // Only clip if NOT using participant-based timing
    if (!individual.beginsWithParticipant && !individual.endsWithParticipant) {
      const visibleStart = Math.max(activityStart, indBeginning);
      const visibleEnd = Math.min(activityEnd, indEnding);
      return { start: visibleStart, end: visibleEnd };
    }
  }

  // Default: use full activity interval
  return { start: activityStart, end: activityEnd };
}

export function drawParticipations(ctx: DrawContext) {
  const { config, svgElement, activities, individuals, dataset } = ctx;

  if (!activities || activities.length === 0) return svgElement;

  let startOfTime = Math.min(...activities.map((a) => a.beginning));
  let endOfTime = Math.max(...activities.map((a) => a.ending));

  // Expand time range to include installed components' actual installation periods
  if (individuals) {
    individuals.forEach((ind) => {
      if (ind.id.includes("__installed_in__")) {
        const ref = getOriginalAndTarget(ind.id);
        if (ref) {
          const original = dataset.individuals.get(ref.originalId);
          if (original && original.installations) {
            // Find the specific installation
            let inst;
            if (ref.installationId) {
              inst = original.installations.find(
                (x: any) => x.id === ref.installationId
              );
            }
            if (!inst) {
              inst = original.installations.find(
                (x: any) => x.targetId === ref.targetId
              );
            }

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

  const duration = Math.max(1, endOfTime - startOfTime);
  let totalLeftMargin =
    config.viewPort.x * config.viewPort.zoom -
    config.layout.individual.xMargin * 2;
  totalLeftMargin -= config.layout.individual.temporalMargin;

  try {
    const { keepIndividualLabels } = require("./DrawHelpers");
    if (
      config.labels.individual.enabled &&
      keepIndividualLabels(ctx.individuals)
    ) {
      totalLeftMargin -= config.layout.individual.textLength;
    }
  } catch {
    // ignore
  }

  const timeInterval = totalLeftMargin / duration;
  const xBase =
    config.layout.individual.xMargin +
    config.layout.individual.temporalMargin +
    (config.labels.individual.enabled
      ? config.layout.individual.textLength
      : 0);

  // Prepare parts with extra metadata for layout
  const getParticipationArray = (a: Activity): Participation[] => {
    if (!a.participations) return [];
    if (a.participations instanceof Map)
      return Array.from(a.participations.values());
    return a.participations as Participation[];
  };

  // Build participation data with visible intervals
  interface PartData {
    activity: Activity;
    participation: Participation;
    activityIndex: number;
    visStart: number;
    visEnd: number;
  }

  const parts: PartData[] = [];

  activities.forEach((a, idx) => {
    const pa = getParticipationArray(a);
    pa.forEach((p) => {
      // ensure the individual's row element exists
      const indNode = svgElement
        .select("#i" + CSS.escape(p.individualId))
        .node();
      if (!indNode) return; // skip orphaned participation

      // ensure there's a visible interval (after cropping for installations)
      const vis = getVisibleInterval(
        a.beginning,
        a.ending,
        p.individualId,
        dataset
      );
      if (vis.end <= vis.start) return; // fully outside -> skip

      parts.push({
        activity: a,
        participation: p,
        activityIndex: idx,
        visStart: vis.start,
        visEnd: vis.end,
      });
    });
  });

  // --- Time-Segment Based Lane Assignment ---
  // Group by individual
  const byIndividual = new Map<string, PartData[]>();
  parts.forEach((p) => {
    const id = p.participation.individualId;
    if (!byIndividual.has(id)) {
      byIndividual.set(id, []);
    }
    byIndividual.get(id)!.push(p);
  });

  // For each individual, calculate time segments and draw rects
  interface SegmentRect {
    activity: Activity;
    participation: Participation;
    activityIndex: number;
    segStart: number;
    segEnd: number;
    laneIndex: number;
    totalLanes: number;
    individualId: string;
  }

  const segmentRects: SegmentRect[] = [];

  byIndividual.forEach((items, indId) => {
    if (items.length === 0) return;

    // Collect all time boundaries for this individual
    const timePoints = new Set<number>();
    items.forEach((p) => {
      timePoints.add(p.visStart);
      timePoints.add(p.visEnd);
    });
    const sortedTimes = Array.from(timePoints).sort((a, b) => a - b);

    // For each time segment, find overlapping activities
    for (let i = 0; i < sortedTimes.length - 1; i++) {
      const segStart = sortedTimes[i];
      const segEnd = sortedTimes[i + 1];

      // Find activities that overlap with this segment
      const overlapping = items.filter(
        (p) => p.visStart < segEnd && p.visEnd > segStart
      );

      if (overlapping.length === 0) continue;

      const totalLanes = overlapping.length;

      // Sort overlapping by activity start time for consistent lane assignment
      overlapping.sort((a, b) => a.activity.beginning - b.activity.beginning);

      // Assign lanes for this segment
      overlapping.forEach((p, laneIndex) => {
        segmentRects.push({
          activity: p.activity,
          participation: p.participation,
          activityIndex: p.activityIndex,
          segStart,
          segEnd,
          laneIndex,
          totalLanes,
          individualId: indId,
        });
      });
    }
  });
  // -------------------------------------------

  const maxRectHeight = Math.min(36, config.layout.individual.height);
  const rx = 4;
  const strokeWidth = 1;
  const fillOpacity = 0.85;

  // Remove old rects
  svgElement.selectAll(".participation-rect").remove();

  // Draw segment rects
  segmentRects.forEach((seg) => {
    const node = svgElement
      .select("#i" + CSS.escape(seg.individualId))
      .node() as SVGGraphicsElement | null;
    if (!node) return;

    const box = node.getBBox();

    // Calculate x position for this segment
    const segX = xBase + timeInterval * (seg.segStart - startOfTime);
    const segWidth = timeInterval * (seg.segEnd - seg.segStart);

    if (segWidth <= 0) return;

    // Calculate lane height for this segment
    const laneHeight = maxRectHeight / seg.totalLanes;
    const gap = seg.totalLanes > 1 ? 1 : 0;

    // Center the group of lanes in the row
    const groupY = box.y + (box.height - maxRectHeight) / 2;
    const laneY = groupY + seg.laneIndex * laneHeight;

    const colorIndex =
      seg.activityIndex % config.presentation.activity.fill.length;
    const fillColor = config.presentation.activity.fill[colorIndex];

    svgElement
      .append("rect")
      .attr("class", "participation-rect")
      .attr(
        "id",
        `p_${seg.activity.id}_${seg.individualId}_${seg.segStart}_${seg.segEnd}`
      )
      .attr("x", segX)
      .attr("y", laneY)
      .attr("width", Math.max(0, segWidth))
      .attr("height", laneHeight - gap)
      .attr("rx", seg.totalLanes > 2 ? 1 : rx)
      .attr("ry", seg.totalLanes > 2 ? 1 : rx)
      .attr("fill", fillColor)
      .attr("fill-opacity", fillOpacity)
      .attr("stroke", darkenHex(fillColor, 0.28))
      .attr("stroke-width", strokeWidth)
      .attr("opacity", 1)
      .datum({
        activity: seg.activity,
        participation: seg.participation,
        activityIndex: seg.activityIndex,
      });
  });

  // Add hover behavior
  hoverParticipations(ctx);

  return svgElement;
}

function hoverParticipations(ctx: DrawContext) {
  const { config, svgElement, tooltip } = ctx;
  svgElement
    .selectAll(".participation-rect")
    .on("mouseover", function (event: MouseEvent) {
      mouseOverElement = event.target as HTMLElement;
      mouseOverElement.style.opacity = String(
        config.presentation.activity.opacityHover ?? 0.9
      );
      tooltip.style("display", "block");
    })
    .on("mouseout", function (event: MouseEvent) {
      if (mouseOverElement) {
        mouseOverElement.style.opacity = "1";
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
  const { svgElement } = ctx;

  // Attach handlers directly to the participation rects created in drawParticipations.
  svgElement
    .selectAll(".participation-rect")
    .on("click", function (event: any, d: any) {
      // d has shape { activity, participation, activityIndex }
      if (d && d.activity && d.participation) {
        clickParticipation(d.activity, d.participation);
      }
    })
    .on("contextmenu", function (event: any, d: any) {
      event.preventDefault();
      if (d && d.activity && d.participation) {
        rightClickParticipation(d.activity, d.participation);
      }
    });
}

function participationTooltip(part: any) {
  let tip = "<strong>Participant</strong>";
  if (part.participation.role)
    tip += "<br/> Role: " + part.participation.role.name;
  return tip;
}

function getPositionOfParticipation(
  svgElement: any,
  activityId: string,
  individualId: string
) {
  const activityElement = svgElement
    .select("#a" + activityId)
    .node()
    .getBBox();

  const x = activityElement.x;
  const width = activityElement.width;

  const individualElement = svgElement
    .select("#i" + individualId)
    .node()
    .getBBox();

  const y = individualElement.y;
  const height = individualElement.height;

  return {
    x: x,
    y: y,
    width: width,
    height: height,
  };
}

/** darken a #rrggbb colour by pct (0..1) */
function darkenHex(hex: string, pct: number) {
  if (!hex) return "#000";
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const dr = Math.max(0, Math.min(255, Math.floor(r * (1 - pct))));
  const dg = Math.max(0, Math.min(255, Math.floor(g * (1 - pct))));
  const db = Math.max(0, Math.min(255, Math.floor(b * (1 - pct))));
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(dr)}${toHex(dg)}${toHex(db)}`;
}
