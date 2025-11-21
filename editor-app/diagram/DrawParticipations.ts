import { MouseEvent } from "react";
import { Activity, Participation } from "@/lib/Schema";
import { ConfigData } from "./config";
import { DrawContext } from "./DrawHelpers";

let mouseOverElement: any | null = null;

export function drawParticipations(ctx: DrawContext) {
  const { config, svgElement, activities } = ctx;

  if (!activities || activities.length === 0) return svgElement;

  const startOfTime = Math.min(...activities.map((a) => a.beginning));
  const endOfTime = Math.max(...activities.map((a) => a.ending));
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

  const parts: {
    activity: Activity;
    participation: Participation;
    activityIndex: number;
  }[] = [];
  activities.forEach((a, idx) => {
    (a.participations || []).forEach((p: Participation) =>
      parts.push({ activity: a, participation: p, activityIndex: idx })
    );
  });

  const rectHeight = Math.min(36, config.layout.individual.height); // glass height, bounded by row
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
    .attr(
      "x",
      (d: any) => xBase + timeInterval * (d.activity.beginning - startOfTime)
    )
    .attr("width", (d: any) =>
      Math.max(1, (d.activity.ending - d.activity.beginning) * timeInterval)
    )
    .attr("y", (d: any) => {
      const node = svgElement
        .select("#i" + d.participation.individualId)
        .node();
      if (!node) return 0;
      const box = node.getBBox();
      // vertically center the glass rect inside the individual row
      return box.y + Math.max(0, (box.height - rectHeight) / 2);
    })
    .attr("height", () => rectHeight)
    .attr("rx", rx)
    .attr("ry", rx)
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
