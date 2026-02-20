import React from "react";
import Button from "react-bootstrap/Button";
import { Activity } from "@/lib/Schema";

const ExportSvg = (props: any) => {
  const { dataset, svgRef } = props;

  function serializeNode(node: any) {
    var svgxml = new XMLSerializer().serializeToString(node);
    return svgxml;
  }

  function addExportLabels(svgNode: SVGSVGElement) {
    const svgCopy = svgNode.cloneNode(true) as SVGSVGElement;
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
      text.setAttribute("font-family", "Roboto, Arial, sans-serif");
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

    const legendItems = [
      { glyph: "▣", label: "System" },
      { glyph: "◇", label: "System Component" },
      { glyph: "○", label: "Individual" },
    ];

    const legendWidth = 220;
    const legendHeaderHeight = 20;
    const legendRowHeight = 18;
    const legendPadding = 10;
    const legendHeight =
      legendPadding * 2 +
      legendHeaderHeight +
      legendItems.length * legendRowHeight;
    const extraBottomSpace = legendHeight + 16;

    svgCopy.setAttribute(
      "viewBox",
      `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight + extraBottomSpace}`
    );

    const legendGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    const legendX = viewBoxX + Math.max(12, viewBoxWidth - legendWidth - 12);
    const legendY = viewBoxY + viewBoxHeight + 8;
    legendGroup.setAttribute("transform", `translate(${legendX}, ${legendY})`);

    const background = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", `${legendWidth}`);
    background.setAttribute("height", `${legendHeight}`);
    background.setAttribute("fill", "white");
    background.setAttribute("fill-opacity", "0.92");
    background.setAttribute("stroke", "#666");
    background.setAttribute("stroke-width", "1");
    legendGroup.appendChild(background);

    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("x", `${legendPadding}`);
    title.setAttribute("y", `${legendPadding + 13}`);
    title.setAttribute("font-family", "Roboto, Arial, sans-serif");
    title.setAttribute("font-size", "13");
    title.setAttribute("font-weight", "700");
    title.setAttribute("fill", "#222");
    title.textContent = "Entity Types";
    legendGroup.appendChild(title);

    legendItems.forEach((item, index) => {
      const row = document.createElementNS("http://www.w3.org/2000/svg", "text");
      const y =
        legendPadding + legendHeaderHeight + (index + 1) * legendRowHeight - 2;
      row.setAttribute("x", `${legendPadding}`);
      row.setAttribute("y", `${y}`);
      row.setAttribute("font-family", "Roboto, Arial, sans-serif");
      row.setAttribute("font-size", "12");
      row.setAttribute("fill", "#222");
      row.textContent = `${item.glyph} ${item.label}`;
      legendGroup.appendChild(row);
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
