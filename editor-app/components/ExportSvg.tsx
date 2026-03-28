import React from "react";
import Button from "react-bootstrap/Button";
import { Activity } from "@/lib/Schema";
import { getDiagramFontFamily, getHeadingFontFamily } from "@/utils/appearance";

const ExportSvg = (props: any) => {
  const { dataset, svgRef } = props;

  function serializeNode(node: any) {
    var svgxml = new XMLSerializer().serializeToString(node);
    return svgxml;
  }

  function addExportLabels(svgNode: SVGSVGElement) {
    const svgCopy = svgNode.cloneNode(true) as SVGSVGElement;
    const diagramFontFamily = getDiagramFontFamily();
    const headingFontFamily = getHeadingFontFamily();
    const activities = new Map<string, Activity>(
      Array.from(dataset.activities.values() as Iterable<Activity>).map((a) => [
        a.id,
        a,
      ])
    );

    const rects = svgCopy.querySelectorAll("rect.activity");
    rects.forEach((rect) => {
      const rectId = rect.getAttribute("id") || "";
      if (!rectId.startsWith("a")) return;
      const activityId = rectId.slice(1);
      const activity = activities.get(activityId);
      if (!activity) return;

      const existing = svgCopy.querySelector(`#al${activityId}`);
      if (existing) return;

      const x = parseFloat(rect.getAttribute("x") || "0");
      const y = parseFloat(rect.getAttribute("y") || "0");
      const width = parseFloat(rect.getAttribute("width") || "0");
      const height = parseFloat(rect.getAttribute("height") || "0");

      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      text.setAttribute("class", "activityLabel");
      text.setAttribute("id", `al${activityId}`);
      text.setAttribute("x", `${x + width / 2}`);
      text.setAttribute("y", `${y + height / 2 + 4}`);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-family", diagramFontFamily);
      text.setAttribute("font-size", "0.7em");
      text.setAttribute("fill", "#441d62");
      text.textContent = activity.name || "";

      // Append the label into the same group that contains the activity rects so
      // it inherits any transform (zoom/translate) applied to the diagram group.
      const activityGroup = svgCopy.querySelector('#activity-diagram-group');
      if (activityGroup) {
        activityGroup.appendChild(text);
      } else {
        svgCopy.appendChild(text);
      }
    });

    const viewBoxRaw = svgCopy.getAttribute("viewBox") || "0 0 1200 600";
    const viewBoxValues = viewBoxRaw
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const viewBoxX = viewBoxValues[0] ?? 0;
    const viewBoxY = viewBoxValues[1] ?? 0;
    const viewBoxWidth = viewBoxValues[2] ?? 1200;
    const viewBoxHeight = viewBoxValues[3] ?? 600;

    // ── Entity Legend (matches EntityTypeLegend component) ──
    const NS = "http://www.w3.org/2000/svg";

    const legendItems: {
      label: string;
      drawIcon: (g: SVGGElement, cx: number, cy: number, s: number) => void;
    }[] = [
      {
        label: "System",
        drawIcon: (g, cx, cy, s) => {
          // Text glyph ▣ matching the app
          const t = document.createElementNS(NS, "text");
          t.setAttribute("x", `${cx}`);
          t.setAttribute("y", `${cy + s * 0.35}`);
          t.setAttribute("text-anchor", "middle");
          t.setAttribute("font-size", `${s}`);
          t.setAttribute("fill", "#333");
          t.textContent = "\u25A3";
          g.appendChild(t);
        },
      },
      {
        label: "System Component",
        drawIcon: (g, cx, cy, s) => {
          // Text glyph ◇ matching the app
          const t = document.createElementNS(NS, "text");
          t.setAttribute("x", `${cx}`);
          t.setAttribute("y", `${cy + s * 0.35}`);
          t.setAttribute("text-anchor", "middle");
          t.setAttribute("font-size", `${s}`);
          t.setAttribute("fill", "#333");
          t.textContent = "\u25C7";
          g.appendChild(t);
        },
      },
      {
        label: "Individual",
        drawIcon: (g, cx, cy, s) => {
          // Text glyph ○ matching the app
          const t = document.createElementNS(NS, "text");
          t.setAttribute("x", `${cx}`);
          t.setAttribute("y", `${cy + s * 0.35}`);
          t.setAttribute("text-anchor", "middle");
          t.setAttribute("font-size", `${s}`);
          t.setAttribute("fill", "#333");
          t.textContent = "\u25CB";
          g.appendChild(t);
        },
      },
      {
        label: "Installation Period",
        drawIcon: (g, cx, cy, _s) => {
          // Hatched rect matching HatchedIcon in EntityTypeLegend
          const patId = "exportInstallHatch";
          let defs = svgCopy.querySelector("defs");
          if (!defs) {
            defs = document.createElementNS(NS, "defs");
            svgCopy.prepend(defs);
          }
          if (!defs.querySelector(`#${patId}`)) {
            const pat = document.createElementNS(NS, "pattern");
            pat.setAttribute("id", patId);
            pat.setAttribute("width", "4");
            pat.setAttribute("height", "4");
            pat.setAttribute("patternUnits", "userSpaceOnUse");
            pat.setAttribute("patternTransform", "rotate(45)");
            const line = document.createElementNS(NS, "line");
            line.setAttribute("x1", "0");
            line.setAttribute("y1", "0");
            line.setAttribute("x2", "0");
            line.setAttribute("y2", "4");
            line.setAttribute("stroke", "#444");
            line.setAttribute("stroke-width", "1.5");
            pat.appendChild(line);
            defs.appendChild(pat);
          }
          const rect = document.createElementNS(NS, "rect");
          rect.setAttribute("x", `${cx - 5}`);
          rect.setAttribute("y", `${cy - 4}`);
          rect.setAttribute("width", "10");
          rect.setAttribute("height", "7.5");
          rect.setAttribute("rx", "1.5");
          rect.setAttribute("fill", `url(#${patId})`);
          rect.setAttribute("stroke", "#666");
          rect.setAttribute("stroke-width", "0.8");
          g.appendChild(rect);
        },
      },
      {
        label: "Currently Installed",
        drawIcon: (g, cx, cy, _s) => {
          // Dashed border rect matching DashedIcon in EntityTypeLegend
          const rect = document.createElementNS(NS, "rect");
          rect.setAttribute("x", `${cx - 5}`);
          rect.setAttribute("y", `${cy - 4}`);
          rect.setAttribute("width", "10");
          rect.setAttribute("height", "7.5");
          rect.setAttribute("rx", "1.5");
          rect.setAttribute("fill", "none");
          rect.setAttribute("stroke", "#666");
          rect.setAttribute("stroke-width", "1");
          rect.setAttribute("stroke-dasharray", "3,2");
          g.appendChild(rect);
        },
      },
    ];

    const legendPadding = 6;
    const legendHeaderHeight = 14;
    const legendRowHeight = 13;
    const legendWidth = 120;
    const legendHeight =
      legendPadding * 2 +
      legendHeaderHeight +
      legendItems.length * legendRowHeight;
    const extraBottomSpace = legendHeight + 10;

    svgCopy.setAttribute(
      "viewBox",
      `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight + extraBottomSpace}`
    );

    const legendGroup = document.createElementNS(NS, "g");
    const legendX = viewBoxX + Math.max(8, viewBoxWidth - legendWidth - 8);
    const legendY = viewBoxY + viewBoxHeight + 4;
    legendGroup.setAttribute("transform", `translate(${legendX}, ${legendY})`);

    // Background card
    const background = document.createElementNS(NS, "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", `${legendWidth}`);
    background.setAttribute("height", `${legendHeight}`);
    background.setAttribute("fill", "white");
    background.setAttribute("stroke", "rgba(0,0,0,0.175)");
    background.setAttribute("stroke-width", "0.5");
    background.setAttribute("rx", "3");
    legendGroup.appendChild(background);

    // Title
    const title = document.createElementNS(NS, "text");
    title.setAttribute("x", `${legendPadding}`);
    title.setAttribute("y", `${legendPadding + 9}`);
    title.setAttribute("font-family", headingFontFamily);
    title.setAttribute("font-size", "9");
    title.setAttribute("font-weight", "500");
    title.setAttribute("fill", "#212529");
    title.textContent = "Entity Legend";
    legendGroup.appendChild(title);

    // Rows
    const iconSize = 9;
    legendItems.forEach((item, index) => {
      const rowY =
        legendPadding + legendHeaderHeight + index * legendRowHeight + legendRowHeight / 2;
      const iconCx = legendPadding + 5;

      const rowGroup = document.createElementNS(NS, "g");
      item.drawIcon(rowGroup, iconCx, rowY, iconSize);

      const label = document.createElementNS(NS, "text");
      label.setAttribute("x", `${legendPadding + 14}`);
      label.setAttribute("y", `${rowY + 3}`);
      label.setAttribute("font-family", diagramFontFamily);
      label.setAttribute("font-size", "7.5");
      label.setAttribute("fill", "#111827");
      label.textContent = item.label;
      rowGroup.appendChild(label);

      legendGroup.appendChild(rowGroup);
    });

    svgCopy.appendChild(legendGroup);

    return svgCopy;
  }

  function downloadsvg(event: any) {
    let pom = document.createElement("a");
    const svgWithLabels = addExportLabels(svgRef.current);
    const svgXml = serializeNode(svgWithLabels);
    const svgBlob = new Blob([svgXml], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);
    pom.setAttribute("href", url);
    pom.setAttribute("download", "activity_diagram.svg");

    if (document.createEvent) {
      let event = document.createEvent("MouseEvents");
      event.initEvent("click", true, true);
      pom.dispatchEvent(event);
    } else {
      pom.click();
    }

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  return (
    <>
      <Button
        variant="primary"
        onClick={downloadsvg}
        className={
          dataset.individuals.size > 0 ? "mx-1 d-block" : "mx-1 d-none"
        }
      >
        Export&nbsp;SVG
      </Button>
    </>
  );
};

export default ExportSvg;
