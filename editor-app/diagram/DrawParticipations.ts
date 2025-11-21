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
      return box.y;
    })
    .attr("height", () => config.layout.individual.height)
    .attr(
      "fill",
      (d: any) =>
        config.presentation.activity.fill[
          d.activityIndex % config.presentation.activity.fill.length
        ]
    )
    .attr("stroke", "none")
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
