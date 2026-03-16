import { MouseEvent } from "react";
import { Activity, Individual } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import {
  ENTITY_TYPE_IDS,
  getEntityTypeGlyph,
  getEntityTypeIdFromIndividual,
  getEntityTypeLabel,
} from "@/lib/entityTypes";
import {
  DrawContext,
  keepIndividualLabels,
  getSystemLayout,
  Label,
  removeLabelIfItOverlaps,
} from "./DrawHelpers";
import { getInstallationPeriods, isInstalledInSystemComponent } from "@/utils/installations";

let mouseOverElement: any | null = null;

interface Span {
  x: number;
  y: number;
  w: number;
  h: number;
  start: boolean;
  stop: boolean;
  indent: number;
}

function highlightInstallationForEntity(
  svgElement: any,
  entityId: string,
  enabled: boolean,
  config: any
) {
  const matching = (d: any, i: number, nodes: any[]) => {
    const node = nodes[i] as Element;
    const installedId = node.getAttribute("data-installed-id");
    const targetId = node.getAttribute("data-target-id");
    return installedId === entityId || targetId === entityId;
  };

  svgElement
    .selectAll(".installHatch")
    .filter(matching)
    .attr("opacity", enabled ? 1.0 : 1.0)
    .attr("fill", "url(#installHatchHighlight)")
    .attr("stroke-width", enabled ? 2.5 : 2.0);

  svgElement
    .selectAll(".installConnectorRibbon")
    .filter(matching)
    .attr("fill", config.presentation.individual.fillHover)
    .attr("fill-opacity", 1)
    .attr("stroke-width", enabled ? 2.0 : 1.5);
}

const INDENT_STEP_PX = 18;
const MAX_INDENT_LEVEL = 4;
const INSTALL_RIBBON_RUN_PX = 24;

const getInstallDepth = (
  individual: Individual,
  byId: Map<string, Individual>
): number => {
  let depth = 0;
  let cursor = individual;
  const seen = new Set<string>();

  // Check if initial individual is installed in a system component
  // If so, we do not want to indent it, because it is drawn as a main row
  if (cursor.installedIn && byId.has(cursor.installedIn)) {
    const parent = byId.get(cursor.installedIn);
    if (
      parent &&
      getEntityTypeIdFromIndividual(parent) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT
    ) {
      return 0;
    }
  }

  while (cursor.installedIn && byId.has(cursor.installedIn)) {
    if (seen.has(cursor.id) || depth >= MAX_INDENT_LEVEL) {
      break;
    }
    seen.add(cursor.id);
    const parent = byId.get(cursor.installedIn);
    if (!parent) break;
    cursor = parent;
    depth += 1;
  }

  return depth;
};

export function drawIndividuals(ctx: DrawContext) {
  const { config, svgElement, individuals, activities } = ctx;
  const systemLayout = getSystemLayout(config);
  const isOpenEnd = (value: number) => value === -1 || value >= Model.END_OF_TIME;

  const individualsById = new Map(
    individuals.map((individual) => [individual.id, individual])
  );

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

  // Enforce minimum timeline span (configurable) so small ranges don't
  // stretch to fill the entire diagram width.
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

  let lhs_x = config.layout.individual.xMargin;
  lhs_x += config.layout.individual.temporalMargin;
  if (individualLabelsEnabled) {
    lhs_x += config.layout.individual.textLength;
  }

  const baseHeight = config.layout.individual.height;
  const componentHeight = Math.max(
    10,
    Math.floor(baseHeight * systemLayout.componentHeightFactor)
  );

  const componentsBySystem = new Map<string, Individual[]>();
  individuals.forEach((individual) => {
    if (!individual.installedIn) return;
    if (
      getEntityTypeIdFromIndividual(individual) !==
      ENTITY_TYPE_IDS.SYSTEM_COMPONENT
    ) {
      return;
    }
    const host = individualsById.get(individual.installedIn);
    if (!host || getEntityTypeIdFromIndividual(host) !== ENTITY_TYPE_IDS.SYSTEM) {
      return;
    }

    const list = componentsBySystem.get(host.id);
    if (list) list.push(individual);
    else componentsBySystem.set(host.id, [individual]);
  });

  // Check if an individual is installed into a system component (not nested visually)
  const isInstalledIndividual = (ind: Individual) =>
    getEntityTypeIdFromIndividual(ind) === ENTITY_TYPE_IDS.INDIVIDUAL &&
    isInstalledInSystemComponent(ind, individualsById);

  const getSpans = (
    individual: Individual, 
    y: number, 
    h: number, 
    indent = 0,
    isInstalled = false
  ): Span[] => {
    const timeToX = (t: number) => 
      lhs_x + timeInterval * (t - startOfTime) + indent;

    const createSingleSpan = (tStart: number, tEnd: number): Span => {
      // Handle infinity
      // For System/Component: usually start=-1 (Inf Past), end=-1 (Inf Future) or end > start
      // For Individual: usually defined start/end
      
      const infPast = tStart === -1; 
      const infFuture = isOpenEnd(tEnd); // blank end / END_OF_TIME is open-ended

      // Determine visible range
      // If infPast, we start from left edge (start=false)
      // If infFuture, we end at right edge (stop=false)

      // Start condition: tStart >= startOfTime
      // Stop condition: tEnd <= endOfTime

      // Logic check:
      // If tStart = -1. effectiveStart = -1. start = false.
      // If tEnd = -1. effectiveEnd = -1. stop = false (treating -1 as Infinity)
      
      // We need to map -1 to logical infinity for comparison
      const logicalStart = infPast ? -Infinity : tStart;
      const logicalEnd = infFuture ? Infinity : tEnd;

      const start = logicalStart >= startOfTime;
      const stop = logicalEnd <= endOfTime;
      
      const chevOff = h / 3;

      // Coordinate calc
      // If start is true, x determined by time. Else left margin.
      // If stop is true, width determined by time diff. Else extends to right.

      let x = 0;
      let w = 0;

      if (start) {
        x = timeToX(logicalStart);
      } else {
        // Starts off-screen left
        x = config.layout.individual.xMargin - Math.min(chevOff, baseHeight / 3) + indent;
      }

      const endX = stop ? timeToX(logicalEnd) : timeToX(endOfTime);

      if (stop) {
        // Ends at specific time
        w = endX - x;
      } else {
        // Ends at endOfTime (for consistent layout)
        w = endX - x + config.layout.individual.temporalMargin;
      }
      
      return { x, y, w, h, start, stop, indent };
    };

    if (isInstalled) {
      const installations = getInstallationPeriods(individual);
      if (installations.length === 0) {
        return [createSingleSpan(individual.beginning, individual.ending)];
      }

      const leadTime = INSTALL_RIBBON_RUN_PX / Math.max(timeInterval, 0.0001);
      const expandStart = (t: number) => (t < startOfTime ? t : t - leadTime);
      const expandEnd = (t: number) => (t > endOfTime ? t : t + leadTime);

      // Work in effective space: -1 → ±Infinity
      const effStart = individual.beginning === -1 ? -Infinity : individual.beginning;
      const effEnd = isOpenEnd(individual.ending) ? Infinity : individual.ending;

      const toRaw = (v: number) => !Number.isFinite(v) ? -1 : v;
      const spans: Span[] = [];

      // Solid bars in gaps between consecutive installation periods.
      // Merge overlapping expanded ranges first so gaps are computed correctly.
      const sorted = [...installations].sort((a, b) => a.beginning - b.beginning);
      const merged: { beginning: number; ending: number }[] = [];
      for (const p of sorted) {
        const rangeBegin = expandStart(p.beginning);
        const rangeEnd = expandEnd(p.ending);
        const last = merged[merged.length - 1];
        if (!last || rangeBegin > last.ending) {
          merged.push({ beginning: rangeBegin, ending: rangeEnd });
        } else {
          last.ending = Math.max(last.ending, rangeEnd);
        }
      }

      const blockStart = Math.max(effStart, merged[0].beginning);
      const blockEnd = Math.min(effEnd, merged[merged.length - 1].ending);

      // Solid bar before the first dashed range
      if (blockStart > effStart) {
        spans.push(createSingleSpan(toRaw(effStart), blockStart));
      }

      for (let i = 0; i < merged.length - 1; i++) {
        const gapStart = merged[i].ending;
        const gapEnd = merged[i + 1].beginning;
        if (gapEnd > gapStart) {
          spans.push(createSingleSpan(toRaw(gapStart), toRaw(gapEnd)));
        }
      }

      // Solid bar after the last ribbon
      if (blockEnd < effEnd) {
        spans.push(createSingleSpan(blockEnd, toRaw(effEnd)));
      }

      return spans.filter(s => s.w > 0);
    }

    // Normal case (1 span)
    return [createSingleSpan(individual.beginning, individual.ending)];
  };

  const layout = new Map<string, Span[]>();
  const rowYMap = new Map<string, number>();
  // Installation periods stored as row-shaped dashed spans for gap outlines
  const installedRegions = new Map<
    string,
    { x: number; y: number; w: number; h: number; start: boolean; stop: boolean }[]
  >();

  let next_y = config.layout.individual.topMargin + config.layout.individual.gap;
  for (const individual of individuals) {
    const host = individual.installedIn
      ? individualsById.get(individual.installedIn)
      : undefined;
    const isNestedComponent =
      !!host &&
      getEntityTypeIdFromIndividual(host) === ENTITY_TYPE_IDS.SYSTEM &&
      getEntityTypeIdFromIndividual(individual) ===
        ENTITY_TYPE_IDS.SYSTEM_COMPONENT;
    if (isNestedComponent) {
      continue;
    }

    const childComponents = componentsBySystem.get(individual.id) ?? [];
    const rowHeight =
      childComponents.length > 0
        ? Math.max(
            Math.floor(
              baseHeight *
                (systemLayout.minHostHeightFactor +
                  Math.max(0, childComponents.length - 1) *
                    systemLayout.hostHeightGrowthPerComponent)
            ),
            baseHeight +
              systemLayout.containerInset * 2 +
              systemLayout.hostComponentPadding * 2 +
              childComponents.length * componentHeight +
              (childComponents.length - 1) * systemLayout.componentGap
          )
        : baseHeight;

    const rowY = next_y;
    next_y = rowY + rowHeight + config.layout.individual.gap;
    rowYMap.set(individual.id, rowY);

    const indent = getInstallDepth(individual, individualsById) * INDENT_STEP_PX;
    const isInstalled = isInstalledIndividual(individual);

    layout.set(individual.id, getSpans(individual, rowY, rowHeight, indent, isInstalled));

    // Draw a dashed outline from first ribbon edge to last ribbon edge.
    if (isInstalled) {
      const timeToXLocal = (t: number) =>
        lhs_x + timeInterval * (t - startOfTime) + indent;
      const periods = getInstallationPeriods(individual);
      if (periods.length > 0) {
        const leadTime = INSTALL_RIBBON_RUN_PX / Math.max(timeInterval, 0.0001);
        const expandStart = (t: number) => (t < startOfTime ? t : t - leadTime);
        const expandEnd = (t: number) => (t > endOfTime ? t : t + leadTime);
        const chevOff = Math.min(rowHeight / 3, baseHeight / 3);

        // Merge overlapping expanded (±leadTime) period ranges so stacked
        // dashed rectangles don't double-render when periods overlap.
        const sortedPeriods = [...periods].sort((a, b) => a.beginning - b.beginning);
        const mergedRanges: { dashStart: number; dashEnd: number }[] = [];
        for (const p of sortedPeriods) {
          const ds = expandStart(p.beginning);
          const de = expandEnd(p.ending);
          const last = mergedRanges[mergedRanges.length - 1];
          if (!last || ds > last.dashEnd) {
            mergedRanges.push({ dashStart: ds, dashEnd: de });
          } else {
            last.dashEnd = Math.max(last.dashEnd, de);
          }
        }

        const rects: { x: number; y: number; w: number; h: number; start: boolean; stop: boolean }[] = [];
        for (const { dashStart, dashEnd } of mergedRanges) {
          const sourcePeriods = sortedPeriods.filter(
            (p) => expandStart(p.beginning) <= dashEnd && expandEnd(p.ending) >= dashStart
          );
          const hasTrueOffscreenStart = sourcePeriods.some((p) => p.beginning < startOfTime);
          const hasTrueOffscreenEnd = sourcePeriods.some((p) => p.ending > endOfTime);
          const extendsLeft = hasTrueOffscreenStart;
          const extendsRight = hasTrueOffscreenEnd;
          const clampedStart = extendsLeft ? startOfTime : dashStart;
          const clampedEnd = extendsRight ? endOfTime : dashEnd;
          const rx1 = extendsLeft
            ? config.layout.individual.xMargin - chevOff + indent
            : timeToXLocal(clampedStart);
          const rx2 = extendsRight
            ? timeToXLocal(endOfTime) + config.layout.individual.temporalMargin
            : timeToXLocal(clampedEnd);
          const w = Math.max(0, rx2 - rx1);
          if (w > 0) {
            rects.push({ x: rx1, y: rowY, w, h: rowHeight, start: !extendsLeft, stop: !extendsRight });
          }
        }

        if (rects.length > 0) installedRegions.set(individual.id, rects);
      }
    }

    const componentsBlockHeight =
      childComponents.length > 0
        ? childComponents.length * componentHeight +
          (childComponents.length - 1) * systemLayout.componentGap
        : 0;
    const componentsStartY = rowY + (rowHeight - componentsBlockHeight) / 2;

    childComponents.forEach((component, index) => {
      const childY =
        componentsStartY +
        index * (componentHeight + systemLayout.componentGap);
      rowYMap.set(component.id, childY);
      let spans = getSpans(component, childY, componentHeight);
      let span = spans[0]; // Components are not split

      // Clamp component horizontal span to be fully inside its host container
      const hostSpans = layout.get(individual.id);
      if (hostSpans && hostSpans.length > 0) {
        const hostSpan = hostSpans[0]; // Host is not split
        const strokePad = (Number(config.presentation.individual.strokeWidth) || 1) / 2;
        const hostStart = individual.beginning === -1 ? -Infinity : individual.beginning;
        const hostEnd = isOpenEnd(individual.ending) ? Infinity : individual.ending;
        const componentStart = component.beginning === -1 ? -Infinity : component.beginning;
        const componentEnd = isOpenEnd(component.ending) ? Infinity : component.ending;
        const reachesHostStart = componentStart < hostStart;
        const alignsHostStart = componentStart <= hostStart;
        const reachesHostEnd = componentEnd > hostEnd;
        const alignsHostEnd = componentEnd >= hostEnd;
        const hasOpenStart =
          component.beginning === -1 || component.beginning < startOfTime || reachesHostStart;
        const hasOpenEnd =
          isOpenEnd(component.ending) || component.ending > endOfTime || reachesHostEnd;

        // Ensure path ends reflect openness after host-bound clamping.
        span.start = !hasOpenStart;
        span.stop = !hasOpenEnd;

        let minX = hostSpan.x + strokePad;
        let maxRight = hostSpan.x + hostSpan.w - strokePad;

        // ensure left edge is not outside host (include stroke padding)
        if (span.x < minX) {
          const rightEdge = span.x + span.w;
          span.x = minX;
          span.w = Math.max(1, rightEdge - span.x);
        }

        // ensure right edge is not outside host (include stroke padding)
        if (span.x + span.w > maxRight) {
          span.w = Math.max(1, maxRight - span.x);
        }
      }
      
      // Update span in list
      spans[0] = span;
      layout.set(component.id, spans);
    });
  }

  const drawnIndividuals = individuals
    .filter((individual) => layout.has(individual.id))
    .sort((a, b) => {
      // Sort by Y position so parent systems (lower Y) are drawn before
      // their contained components (higher Y).  This ensures the system's
      // white background doesn't cover its children in SVG z-order.
      const aY = rowYMap.get(a.id) ?? 0;
      const bY = rowYMap.get(b.id) ?? 0;
      return aY - bY;
    });

  const defs = svgElement.select("defs").empty()
    ? svgElement.append("defs")
    : svgElement.select("defs");

  let activityMask = defs.select("#activity-mask");
  if (activityMask.empty()) {
    activityMask = defs.append("mask")
      .attr("id", "activity-mask")
      .attr("maskUnits", "userSpaceOnUse");
  } else {
    activityMask.selectAll("*").remove(); // clear old mask
  }

  activityMask.append("rect")
    .attr("x", -50000)
    .attr("y", -50000)
    .attr("width", 100000)
    .attr("height", 100000)
    .attr("fill", "white");

  drawnIndividuals.forEach(i => {
    const spans = layout.get(i.id)!;
    if (spans.length > 0) {
      const firstSpan = spans[0];
      const rowY = firstSpan.y;
      const rowH = firstSpan.h;

      activityMask.append("rect")
        .attr("x", -50000)
        .attr("y", rowY)
        .attr("width", 100000)
        .attr("height", rowH)
        .attr("fill", "black");
        
      const baseHeight = config.layout.individual.height;
      const pathData = spans.map(s => {
          const { x, y, w, h, start, stop } = s;
          const chevOff = Math.min(h / 3, baseHeight / 3);

          return `M ${x} ${y} l ${w} 0`
            + (stop ? `l 0 ${h}` : `l ${chevOff} ${h / 2} ${-chevOff} ${h / 2}`)
            + `l ${-w} 0`
            + (start ? "" : `l ${chevOff} ${-h / 2} ${-chevOff} ${-h / 2}`)
            + "Z";
      }).join(" ");
      
      activityMask.append("path")
        .attr("d", pathData)
        .attr("fill", "white");
    }
  });

  svgElement
    .selectAll(".individual")
    .data(drawnIndividuals.values())
    .join("path")
    .attr("class", "individual")
    .attr("id", (d: Individual) => "i" + d["id"])
    .attr("d", (i: Individual) => {
      const spans = layout.get(i.id)!;
      const baseHeight = config.layout.individual.height;
      
      return spans.map(s => {
          const { x, y, w, h, start, stop } = s;
          const chevOff = Math.min(h / 3, baseHeight / 3);
          
          return `M ${x} ${y} l ${w} 0`
            + (stop ? `l 0 ${h}` : `l ${chevOff} ${h / 2} ${-chevOff} ${h / 2}`)
            + `l ${-w} 0`
            + (start ? "" : `l ${chevOff} ${-h / 2} ${-chevOff} ${-h / 2}`)
            + "Z";
      }).join(" ");
    })
    .attr("stroke", config.presentation.individual.stroke)
    .attr("stroke-width", config.presentation.individual.strokeWidth)
    .attr("fill", (d: Individual) =>
      getEntityTypeIdFromIndividual(d) === ENTITY_TYPE_IDS.SYSTEM ||
      getEntityTypeIdFromIndividual(d) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT
        ? "white"
        : config.presentation.individual.fill
    )
    .attr("data-row-y", (d: Individual) => {
         return rowYMap.get(d.id) ?? 0;
    });

  // Draw dashed row-shaped outlines in installation gaps so geometry matches
  // normal rows (including open-end chevrons) while remaining empty.
  installedRegions.forEach((rectangles, individualId) => {
    rectangles.forEach((rect) => {
      const chevOff = Math.min(rect.h / 3, baseHeight / 3);
      const pathData = `M ${rect.x} ${rect.y} l ${rect.w} 0`
        + (rect.stop ? `l 0 ${rect.h}` : `l ${chevOff} ${rect.h / 2} ${-chevOff} ${rect.h / 2}`)
        + `l ${-rect.w} 0`
        + (rect.start ? "" : `l ${chevOff} ${-rect.h / 2} ${-chevOff} ${-rect.h / 2}`)
        + "Z";

      svgElement
        .append("path")
        .attr("class", "installDash")
        .attr("d", pathData)
        .attr("fill", "none")
        .attr("stroke", config.presentation.individual.stroke)
        .attr("stroke-width", config.presentation.individual.strokeWidth)
        .attr("stroke-dasharray", config.presentation.participation?.strokeDasharray ?? "5,3")
        .attr("data-individual-id", individualId)
        .style("pointer-events", "none");
    });
  });

  return svgElement;
}

/**
 * Draw installation connectors: vertical lines from an installed individual
 * up to its target system component, and hatching on the component during
 * the installation window.
 */
export function drawInstallationConnectors(ctx: DrawContext) {
  const { config, svgElement, individuals, activities } = ctx;
  const openEndAlignmentPadding =
    config.layout.individual.openEndAlignmentPadding ?? 12;

  svgElement
    .selectAll(".installHatch,.installConnectorRibbon")
    .remove();

  const individualsById = new Map(
    individuals.map((ind) => [ind.id, ind])
  );

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
  const minSpan2 = config.viewPort.minTimelineSpan ?? 11;
  if (minSpan2 > 0 && endOfTime - startOfTime < minSpan2) {
    endOfTime = startOfTime + minSpan2;
  }

  let totalLeftMargin =
    config.viewPort.x * config.viewPort.zoom -
    config.layout.individual.xMargin * 2;
  totalLeftMargin -= config.layout.individual.temporalMargin;

  const individualLabelsEnabled =
    config.labels.individual.enabled && keepIndividualLabels(individuals);
  if (individualLabelsEnabled) {
    totalLeftMargin -= config.layout.individual.textLength;
  }

  let timeInterval = totalLeftMargin / Math.max(1, endOfTime - startOfTime);

  let lhs_x = config.layout.individual.xMargin;
  lhs_x += config.layout.individual.temporalMargin;
  if (individualLabelsEnabled) {
    lhs_x += config.layout.individual.textLength;
  }

  // Create a hatch pattern definition if not already present
  const defs = svgElement.select("defs").empty()
    ? svgElement.append("defs")
    : svgElement.select("defs");

  if (defs.select("#installHatch").empty()) {
    const pattern = defs
      .append("pattern")
      .attr("id", "installHatch")
      .attr("width", 8)
      .attr("height", 8)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("patternTransform", "rotate(45)");
    pattern
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 8)
      .attr("stroke", "#666")
      .attr("stroke-width", 1.5);
  }

  if (defs.select("#installHatchHighlight").empty()) {
    const pattern = defs
      .append("pattern")
      .attr("id", "installHatchHighlight")
      .attr("width", 8)
      .attr("height", 8)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("patternTransform", "rotate(45)");
    pattern
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 8)
      .attr("stroke", "#444")
      .attr("stroke-width", 2.0);
  }

  const timeToX = (t: number) => lhs_x + timeInterval * (t - startOfTime);

  // Find individuals installed into system components
  individuals.forEach((ind) => {
    if (getEntityTypeIdFromIndividual(ind) !== ENTITY_TYPE_IDS.INDIVIDUAL) {
      return;
    }

    // Get bounding boxes of drawn shapes
    const indNode = svgElement.select("#i" + ind.id).node() as SVGGraphicsElement;
    if (!indNode) return;

    const indBox = indNode.getBBox();
    const rowYAttr = Number(indNode.getAttribute("data-row-y") ?? "NaN");
    const lowerTopBase = Number.isFinite(rowYAttr) ? rowYAttr : indBox.y;
    const lowerHeight = indBox.height > 0 ? indBox.height : config.layout.individual.height;
    const periods = getInstallationPeriods(ind);
    periods.forEach((period, index) => {
      const target = individualsById.get(period.systemComponentId);
      if (
        !target ||
        getEntityTypeIdFromIndividual(target) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT
      ) {
        return;
      }

      const targetNode = svgElement.select("#i" + target.id).node() as SVGGraphicsElement;
      if (!targetNode) return;

      const targetBox = targetNode.getBBox();
      const installStart = period.beginning;
      const isOpenEnd = (value: number) => value === -1 || value >= Model.END_OF_TIME;
      const installEnd = isOpenEnd(period.ending) ? Infinity : period.ending;
      const visibleStart = Math.max(installStart, startOfTime);
      const visibleEnd = Math.min(installEnd, endOfTime);

      if (visibleEnd <= visibleStart) return;

      const x1 = timeToX(visibleStart);
      const targetHasOpenEnd = isOpenEnd(target.ending);
      const baseX2 = isOpenEnd(period.ending)
        ? timeToX(endOfTime) + config.layout.individual.temporalMargin
        : timeToX(visibleEnd);
      const useOpenEndChevron =
        isOpenEnd(ind.ending) && isOpenEnd(period.ending) && targetHasOpenEnd;
      const x2 =
        useOpenEndChevron
          ? Math.max(x1 + 1, baseX2 - openEndAlignmentPadding)
          : baseX2;

      const lowerTop = lowerTopBase;
      const lowerBottom = lowerTopBase + lowerHeight;
      const upperTop = targetBox.y;
      const upperBottom = targetBox.y + targetBox.height;

      const targetPathD = targetNode.getAttribute("d") || "";
      const clipId = `installClip-${target.id}`;
      const clipSelector = `#${clipId}`;
      if (defs.select(clipSelector).empty()) {
        defs
          .append("clipPath")
          .attr("id", clipId)
          .append("path")
          .attr("d", targetPathD);
      } else {
        defs.select(`${clipSelector} path`).attr("d", targetPathD);
      }

      if (useOpenEndChevron) {
        const targetChevronDepth = Math.min(
          targetBox.height / 3,
          config.layout.individual.height / 3
        );
        const targetMidY = targetBox.y + targetBox.height / 2;
        const targetChevronTipX = x2 + targetChevronDepth;
        const hatchPath = `M ${x1} ${targetBox.y}`
          + ` L ${x2} ${targetBox.y}`
          + ` L ${targetChevronTipX} ${targetMidY}`
          + ` L ${x2} ${targetBox.y + targetBox.height}`
          + ` L ${x1} ${targetBox.y + targetBox.height} Z`;

        svgElement
          .append("path")
          .attr("class", "installHatch")
          .attr("d", hatchPath)
          .attr("fill", "url(#installHatchHighlight)")
          .attr("stroke", config.presentation.individual.stroke)
          .attr("stroke-width", 2.0)
          .attr("opacity", 1.0)
          .attr("clip-path", `url(#${clipId})`)
          .attr("data-installed-id", ind.id)
          .attr("data-target-id", target.id);
      } else {
        svgElement
          .append("rect")
          .attr("class", "installHatch")
          .attr("x", x1)
          .attr("y", targetBox.y)
          .attr("width", Math.max(1, x2 - x1))
          .attr("height", targetBox.height)
          .attr("fill", "url(#installHatchHighlight)")
          .attr("stroke", config.presentation.individual.stroke)
          .attr("stroke-width", 2.0)
          .attr("opacity", 1.0)
          .attr("clip-path", `url(#${clipId})`)
          .attr("data-installed-id", ind.id)
          .attr("data-target-id", target.id);
      }

      const startLiftDx = INSTALL_RIBBON_RUN_PX;
      const endDropDx = INSTALL_RIBBON_RUN_PX;

      if (installStart >= startOfTime || installStart === 0) {
        const pathData = `M ${x1 - startLiftDx} ${lowerTop}
L ${x1 - startLiftDx} ${lowerBottom}
L ${x1} ${upperBottom}
L ${x1} ${upperTop} Z`;

        svgElement
          .append("path")
          .attr("class", "installConnectorRibbon")
          .attr("d", pathData)
          .attr("fill", config.presentation.individual.fillHover)
          .attr("fill-opacity", 1)
          .attr("stroke", config.presentation.individual.stroke)
          .attr("stroke-width", 1.5)
          .attr("data-ribbon-kind", "start")
          .attr("data-main-x", x1)
          .attr("data-side-x", x1 - startLiftDx)
          .attr("data-lower-top", lowerTop)
          .attr("data-lower-bottom", lowerBottom)
          .attr("data-upper-top", upperTop)
          .attr("data-upper-bottom", upperBottom)
          .attr("data-installed-id", ind.id)
          .attr("data-target-id", target.id);
      }

      if (installEnd <= endOfTime && !isOpenEnd(period.ending)) {
        const pathData = `M ${x2} ${upperTop}
L ${x2} ${upperBottom}
L ${x2 + endDropDx} ${lowerBottom}
L ${x2 + endDropDx} ${lowerTop} Z`;

        svgElement
          .append("path")
          .attr("class", "installConnectorRibbon")
          .attr("d", pathData)
          .attr("fill", config.presentation.individual.fillHover)
          .attr("fill-opacity", 1)
          .attr("stroke", config.presentation.individual.stroke)
          .attr("stroke-width", 1.5)
          .attr("data-ribbon-kind", "end")
          .attr("data-main-x", x2)
          .attr("data-side-x", x2 + endDropDx)
          .attr("data-lower-top", lowerTop)
          .attr("data-lower-bottom", lowerBottom)
          .attr("data-upper-top", upperTop)
          .attr("data-upper-bottom", upperBottom)
          .attr("data-installed-id", ind.id)
          .attr("data-target-id", target.id);
      }
    });
  });
}

export function hoverIndividuals(ctx: DrawContext) {
  const { config, svgElement, tooltip } = ctx;

  const resolveEntityId = (bound: any, element: Element | null): string | null => {
    if (bound?.id) return bound.id;
    const rawId = element?.getAttribute("id") ?? "";
    return rawId.startsWith("i") ? rawId.slice(1) : null;
  };

  const restoreFillForIndividual = (ind: Individual | undefined): string => {
    if (ind && (getEntityTypeIdFromIndividual(ind) === ENTITY_TYPE_IDS.SYSTEM ||
        getEntityTypeIdFromIndividual(ind) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT)) {
      return "white";
    }
    return config.presentation.individual.fill;
  };

  const positionTooltip = (event: MouseEvent, d: any) => {
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
  };

  const hoverMatching = (entityId: string) => (d: any, i: number, nodes: any[]) => {
    const node = nodes[i] as Element;
    const installedId = node.getAttribute("data-installed-id");
    const targetId = node.getAttribute("data-target-id");
    return installedId === entityId || targetId === entityId;
  };

  const applyHoverHighlight = (entityId: string) => {
    svgElement.select(`#i${entityId}`).classed("entity-hover-highlight", true);
    svgElement.select(`#il${entityId}`).classed("entity-hover-highlight", true);
    svgElement.selectAll(".installHatch").filter(hoverMatching(entityId)).classed("entity-hover-highlight", true);
    // Skip ribbon highlighting for system components, matching search behavior
    const ind = ctx.individuals.find(x => x.id === entityId);
    const isSystemComponent = ind && getEntityTypeIdFromIndividual(ind) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT;
    if (!isSystemComponent) {
      svgElement.selectAll(".installConnectorRibbon").filter(hoverMatching(entityId)).classed("entity-hover-highlight", true);
    }
  };

  const removeHoverHighlight = () => {
    svgElement.selectAll(".entity-hover-highlight").classed("entity-hover-highlight", false);
  };

  svgElement
    .selectAll(".individual")
    .on("mouseover", function (event: MouseEvent, d: any) {
      mouseOverElement = event.target as HTMLElement;
      mouseOverElement.style.fill = config.presentation.individual.fillHover;
      const entityId = resolveEntityId(d, mouseOverElement);
      if (entityId) {
        highlightInstallationForEntity(svgElement, entityId, true, config);
        applyHoverHighlight(entityId);
      }
      tooltip.style("display", "block");
    })
    .on("mouseout", function (event: MouseEvent, d: any) {
      const entityId = resolveEntityId(d, event.target as Element);
      if (entityId) {
        highlightInstallationForEntity(svgElement, entityId, false, config);
      }
      removeHoverHighlight();

      if (mouseOverElement) {
        const targetInd = d || ctx.individuals.find(x => "i" + x.id === (mouseOverElement as HTMLElement).getAttribute("id"));
        mouseOverElement.style.fill = restoreFillForIndividual(targetInd);
        mouseOverElement = null;
      }
      tooltip.style("display", "none");
    })
    .on("mousemove", function (event: MouseEvent, d: any) {
      positionTooltip(event, d);
    });

  // Apply the same hover effect when hovering on the row label text
  svgElement
    .selectAll(".individualLabel")
    .style("cursor", "pointer")
    .on("mouseover", function (event: MouseEvent, d: any) {
      const entityId = d?.id;
      if (!entityId) return;
      const rowNode = svgElement.select("#i" + entityId).node() as HTMLElement | null;
      if (rowNode) {
        mouseOverElement = rowNode;
        rowNode.style.fill = config.presentation.individual.fillHover;
      }
      highlightInstallationForEntity(svgElement, entityId, true, config);
      applyHoverHighlight(entityId);
      tooltip.style("display", "block");
    })
    .on("mouseout", function (event: MouseEvent, d: any) {
      const entityId = d?.id;
      if (entityId) {
        highlightInstallationForEntity(svgElement, entityId, false, config);
      }
      removeHoverHighlight();
      if (mouseOverElement) {
        const targetInd = d || ctx.individuals.find(x => "i" + x.id === (mouseOverElement as HTMLElement).getAttribute("id"));
        mouseOverElement.style.fill = restoreFillForIndividual(targetInd);
        mouseOverElement = null;
      }
      tooltip.style("display", "none");
    })
    .on("mousemove", function (event: MouseEvent, d: any) {
      positionTooltip(event, d);
    });
}

function individualTooltip(individual: Individual) {
  let tip = "<strong>Entity</strong>";
  if (individual.name) tip += "<br/> Name: " + individual.name;
  if (individual.type)
    tip +=
      "<br/> Type: " +
      getEntityTypeLabel(
        individual.type,
        individual.installedIn,
        individual.entityType
      );
  if (individual.description)
    tip += "<br/> Description: " + individual.description;
  return tip;
}

export function clickIndividuals(
  ctx: DrawContext,
  clickIndividual: any,
  rightClickIndividual: any
) {
  const { config, svgElement, individuals } = ctx;
  individuals.forEach((i) => {
    const lclick = (e: MouseEvent) => clickIndividual(i);
    const rclick = (e: MouseEvent) => {
      e.preventDefault();
      rightClickIndividual(i);
    };

    svgElement.select("#i" + i.id)
      .on("click", lclick)
      .on("contextmenu", rclick);
    svgElement.select("#il" + i.id)
      .on("click", lclick)
      .on("contextmenu", rclick);
  });
}

export function labelIndividuals(ctx: DrawContext) {
  const { config, svgElement, individuals } = ctx;

  if (config.labels.individual.enabled === false) {
    return;
  }

  const individualsById = new Map(individuals.map((individual) => [individual.id, individual]));
  const componentsBySystem = new Map<string, Individual[]>();
  individuals.forEach((individual) => {
    if (!individual.installedIn) return;
    if (
      getEntityTypeIdFromIndividual(individual) !==
      ENTITY_TYPE_IDS.SYSTEM_COMPONENT
    ) {
      return;
    }
    const host = individualsById.get(individual.installedIn);
    if (!host || getEntityTypeIdFromIndividual(host) !== ENTITY_TYPE_IDS.SYSTEM) {
      return;
    }
    const list = componentsBySystem.get(host.id);
    if (list) list.push(individual);
    else componentsBySystem.set(host.id, [individual]);
  });

  let labels: Label[] = [];

  svgElement
    .selectAll(".individualLabel")
    .data(individuals.values())
    .join("text")
    .attr("class", "individualLabel")
    .attr("id", (i: Individual) => `il${i.id}`)
    .attr("x", (d: Individual) => {
      // Keep system-component labels at the start (no indent)
      const isComponent =
        getEntityTypeIdFromIndividual(d) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT;
      const depth = isComponent ? 0 : getInstallDepth(d, individualsById);
      return (
        config.layout.individual.xMargin +
        config.labels.individual.leftMargin +
        depth * INDENT_STEP_PX
      );
    })
    .attr("y", (d: Individual) => {
      const shape = svgElement.select("#i" + d.id).node() as SVGGraphicsElement;
      if (!shape) {
        return (
          config.layout.individual.topMargin +
          config.layout.individual.gap +
          config.layout.individual.height / 2 +
          config.labels.individual.topMargin
        );
      }
      
      let startY = 0;
      let height = 0;
      
      // Try to get stored row Y, useful if the shape is invisible/split
      const rowYAttr = shape.getAttribute("data-row-y");
      
      const hasContainedComponents = (componentsBySystem.get(d.id)?.length ?? 0) > 0;
      
      // If it's a Host (has components), it draws a large box so BBox is reliable and necessary for height
      // If it's not a Host, it might be a split individual timeline.
      if (hasContainedComponents) {
          const bbox = shape.getBBox();
          startY = bbox.y;
          height = config.layout.individual.height; // Label is at top of container usually? 
          // Code says: bbox.y + config.layout.individual.height / 2
          // This puts it at the top "header" area of the system.
          
          return (
            bbox.y +
            config.layout.individual.height / 2 +
            config.labels.individual.topMargin
          );
      } else {
          // Leaf node or simple individual
          if (rowYAttr) {
              startY = parseFloat(rowYAttr);
              height = config.layout.individual.height;
          } else {
              const bbox = shape.getBBox();
              startY = bbox.y;
              height = bbox.height;
          }
      }

      return startY + height / 2 + config.labels.individual.topMargin;
    })
    .attr("text-anchor", "start")
    .attr("font-family", "Roboto, Arial, sans-serif")
    .attr("font-size", config.labels.individual.fontSize)
    .text((d: Individual) => {
      let label = `${getEntityTypeGlyph(
        d.type,
        d.installedIn,
        d.entityType
      )} ${d["name"]}`;
      if (label.length > config.labels.individual.maxChars) {
        label = label.substring(0, config.labels.individual.maxChars);
        label += "...";
      }
      return label;
    })
    .each((d: Individual, i: number, nodes: SVGGraphicsElement[]) => {
      const isNested =
        !!d.installedIn &&
        getEntityTypeIdFromIndividual(d) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT;
      const isHost = componentsBySystem.has(d.id);

      if (!isNested && !isHost) {
        removeLabelIfItOverlaps(labels, nodes[i]);
      }
      labels.push(nodes[i].getBBox());
    });
}
