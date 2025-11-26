import { MouseEvent } from "react";
import { Activity, Participation } from "@/lib/Schema";
import { ConfigData } from "./config";
import { DrawContext } from "./DrawHelpers";
import { Model } from "@/lib/Model";

let mouseOverElement: any | null = null;

function isInstallationRefId(id: string): boolean {
  return id.includes("__installed_in__");
}

function getOriginalAndSlot(
  id: string
): { originalId: string; slotId: string } | null {
  if (!isInstallationRefId(id)) return null;
  const parts = id.split("__installed_in__");
  if (parts.length !== 2) return null;
  return { originalId: parts[0], slotId: parts[1] };
}

// Add this helper function to get visible interval for a participation
function getVisibleInterval(
  activityStart: number,
  activityEnd: number,
  individualId: string,
  dataset: any
): { start: number; end: number } {
  const ref = getOriginalAndSlot(individualId);
  if (!ref) {
    // Normal individual - use full activity interval
    return { start: activityStart, end: activityEnd };
  }

  // This is an installed component - crop to installation period
  const original = dataset.individuals.get(ref.originalId);
  if (!original || !original.installations) {
    return { start: activityStart, end: activityEnd };
  }

  const inst = original.installations.find(
    (i: any) => i.targetId === ref.slotId
  );
  if (!inst) {
    return { start: activityStart, end: activityEnd };
  }

  const instStart = Math.max(0, inst.beginning ?? 0);
  const instEnd = inst.ending;

  // Compute overlap
  const visibleStart = Math.max(activityStart, instStart);
  const visibleEnd = Math.min(activityEnd, instEnd);

  return { start: visibleStart, end: visibleEnd };
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
  // Replace the parts construction with this safer version
  const getParticipationArray = (a: Activity): Participation[] => {
    if (!a.participations) return [];
    if (a.participations instanceof Map)
      return Array.from(a.participations.values());
    return a.participations as Participation[];
  };

  const parts: {
    activity: Activity;
    participation: Participation;
    activityIndex: number;
    lane?: number;
    totalLanes?: number;
  }[] = [];

  // Build parts but skip any participation whose individual row is missing
  // or which has no visible interval after cropping to installation window.
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

      parts.push({ activity: a, participation: p, activityIndex: idx });
    });
  });

  // --- Overlap Detection & Lane Assignment ---
  // 1. Group by individual
  const byIndividual = new Map<string, typeof parts>();
  parts.forEach((p) => {
    const id = p.participation.individualId;
    if (!byIndividual.has(id)) {
      byIndividual.set(id, []);
    }
    byIndividual.get(id)!.push(p);
  });

  // 2. Calculate lanes for each individual
  byIndividual.forEach((items) => {
    // Sort by start time
    items.sort((a, b) => a.activity.beginning - b.activity.beginning);

    const lanes: number[] = []; // tracks the end time of the last item in each lane

    items.forEach((item) => {
      let placed = false;
      // Try to place in existing lane
      for (let i = 0; i < lanes.length; i++) {
        // If this lane is free (last item ended before this one starts)
        if (lanes[i] <= item.activity.beginning) {
          item.lane = i;
          lanes[i] = item.activity.ending;
          placed = true;
          break;
        }
      }
      // Create new lane if needed
      if (!placed) {
        item.lane = lanes.length;
        lanes.push(item.activity.ending);
      }
    });

    // Store total lanes count on each item for height calculation
    const totalLanes = lanes.length;
    items.forEach((item) => (item.totalLanes = totalLanes));
  });
  // -------------------------------------------

  const maxRectHeight = Math.min(36, config.layout.individual.height); // max glass height
  const rx = 4; // border-radius
  const strokeWidth = 1;
  const fillOpacity = 0.85;

  svgElement
    .selectAll(".participation-rect")
    .data(parts, (d: any) => `${d.activity.id}:${d.participation.individualId}`)
    .join("rect")
    .attr("class", "participation-rect")
    .attr(
      "id",
      (d: any) => `p_${d.activity.id}_${d.participation.individualId}`
    )
    .attr("x", (d: any) => {
      const { start, end } = getVisibleInterval(
        d.activity.beginning,
        d.activity.ending,
        d.participation.individualId,
        dataset
      );
      // If no visible portion, move offscreen
      if (end <= start) return -99999;
      return xBase + timeInterval * (start - startOfTime);
    })
    .attr("width", (d: any) => {
      const { start, end } = getVisibleInterval(
        d.activity.beginning,
        d.activity.ending,
        d.participation.individualId,
        dataset
      );
      const width = (end - start) * timeInterval;
      return Math.max(0, width);
    })
    .attr("y", (d: any) => {
      const node = svgElement
        .select("#i" + d.participation.individualId)
        .node();
      if (!node) return 0;
      const box = node.getBBox();

      const totalLanes = d.totalLanes || 1;
      const laneIndex = d.lane || 0;

      // Calculate height per lane
      const laneHeight = maxRectHeight / totalLanes;

      // Center the group of lanes in the row
      const groupY = box.y + (box.height - maxRectHeight) / 2;

      return groupY + laneIndex * laneHeight;
    })
    .attr("height", (d: any) => {
      const totalLanes = d.totalLanes || 1;
      // Add a tiny gap if multiple lanes, unless it makes them too small
      const gap = totalLanes > 1 ? 1 : 0;
      return maxRectHeight / totalLanes - gap;
    })
    .attr("rx", (d: any) => (d.totalLanes && d.totalLanes > 2 ? 1 : rx)) // reduce radius if thin
    .attr("ry", (d: any) => (d.totalLanes && d.totalLanes > 2 ? 1 : rx))
    .attr(
      "fill",
      (d: any) =>
        config.presentation.activity.fill[
          d.activityIndex % config.presentation.activity.fill.length
        ]
    )
    .attr("fill-opacity", fillOpacity)
    .attr("stroke", (d: any) =>
      darkenHex(
        config.presentation.activity.fill[
          d.activityIndex % config.presentation.activity.fill.length
        ],
        0.28
      )
    )
    .attr("stroke-width", strokeWidth)
    .attr("opacity", 1);

  // Add hover behavior using the same pattern as original
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
