import React, { useState, useEffect } from "react";
import Button from "react-bootstrap/Button";
import { saveJSONLD } from "lib/ActivityLib";

const ExportJson = (props: any) => {
  const { dataset, svgRef } = props;

  function serializeNode(node: any) {
    var svgxml = new XMLSerializer().serializeToString(node);
    return svgxml;
  }

  function addExportLabels(svgNode: SVGSVGElement) {
    const svgCopy = svgNode.cloneNode(true) as SVGSVGElement;
    const activities = new Map(
      Array.from(dataset.activities.values()).map((a) => [a.id, a])
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

      svgCopy.appendChild(text);
    });

    return svgCopy;
  }

  function downloadsvg(event: any) {
    let pom = document.createElement("a");
    const svgWithLabels = addExportLabels(svgRef.current);
    pom.setAttribute(
      "href",
      "data:image/svg+xml;base64," + btoa(serializeNode(svgWithLabels))
    );
    pom.setAttribute("download", "activity_diagram.svg");

    if (document.createEvent) {
      let event = document.createEvent("MouseEvents");
      event.initEvent("click", true, true);
      pom.dispatchEvent(event);
    } else {
      pom.click();
    }
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

export default ExportJson;
