import React from "react";
import Button from "react-bootstrap/Button";
import { Activity } from "@/lib/Schema";

interface LegendResult {
  content: string;
  width: number;
  height: number;
}

interface Props {
  dataset: any;
  svgRef: React.RefObject<SVGSVGElement | null>;
  activitiesInView?: Activity[];
  activityColors?: string[];
}

const ExportSvg = (props: Props) => {
  const { dataset, svgRef, activitiesInView = [], activityColors = [] } = props;

  function serializeNode(node: SVGSVGElement | null): string {
    if (!node) return "";
    const serializer = new XMLSerializer();
    return serializer.serializeToString(node);
  }

  // Safe base64 for UTF-8 SVG
  function toBase64Utf8(str: string): string {
    return window.btoa(unescape(encodeURIComponent(str)));
  }

  function escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // Build legend SVG content
  function buildLegendSvg(): LegendResult {
    const legendWidth = 200;
    const itemHeight = 20;
    const padding = 10;
    let y = padding;

    let legendContent = "";

    // Entity Types Legend
    const entityTypes = [
      { icon: "▣", label: "System" },
      { icon: "◇", label: "System Component" },
      { icon: "◆", label: "SC in System" },
      { icon: "◈", label: "SC in SC" },
      { icon: "⬡", label: "Installed Component" },
      { icon: "⬢", label: "IC in SC" },
      { icon: "○", label: "Individual" },
    ];

    // Entity Types title
    legendContent += `<text x="${padding}" y="${
      y + 12
    }" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#111827">Entity Types</text>`;
    y += itemHeight + 5;

    entityTypes.forEach((item) => {
      legendContent += `<text x="${padding}" y="${
        y + 12
      }" font-family="Arial, sans-serif" font-size="12" fill="#374151">${
        item.icon
      }</text>`;
      legendContent += `<text x="${padding + 20}" y="${
        y + 12
      }" font-family="Arial, sans-serif" font-size="12" fill="#111827">${
        item.label
      }</text>`;
      y += itemHeight;
    });

    y += 15; // Gap between legends

    // Activity Legend title
    legendContent += `<text x="${padding}" y="${
      y + 12
    }" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#111827">Activity Legend</text>`;
    y += itemHeight + 5;

    // Activities
    activitiesInView.forEach((activity, idx) => {
      const color = activityColors[idx % activityColors.length] || "#ccc";
      legendContent += `<rect x="${padding}" y="${y}" width="14" height="14" rx="3" fill="${color}" stroke="#888" stroke-width="1"/>`;
      legendContent += `<text x="${padding + 20}" y="${
        y + 11
      }" font-family="Arial, sans-serif" font-size="12" fill="#111827">${escapeXml(
        activity.name
      )}</text>`;
      y += itemHeight;
    });

    // No Activity
    legendContent += `<rect x="${padding}" y="${y}" width="14" height="14" rx="3" fill="#ccc" stroke="#888" stroke-width="1"/>`;
    legendContent += `<text x="${padding + 20}" y="${
      y + 11
    }" font-family="Arial, sans-serif" font-size="12" fill="#111827">No Activity</text>`;
    y += itemHeight;

    const legendHeight = y + padding;

    return { content: legendContent, width: legendWidth, height: legendHeight };
  }

  function downloadsvg() {
    if (!svgRef?.current) return;

    const originalSvg = svgRef.current;
    const viewBox = originalSvg.getAttribute("viewBox") || "0 0 1000 500";
    const [, , origWidth, origHeight] = viewBox.split(" ").map(Number);

    // Axis configuration
    const AXIS_SIZE = 40;
    const AXIS_COLOR = "#9ca3af";
    const AXIS_STROKE_WIDTH = 4;

    // Build legend
    const legend = buildLegendSvg();
    const legendWidth = legend.width;
    const legendHeight = legend.height;

    // Calculate dimensions for the diagram section (Diagram + Axes)
    const diagramSectionWidth = AXIS_SIZE + origWidth;
    const diagramSectionHeight = origHeight + AXIS_SIZE;

    // Total SVG dimensions
    const totalWidth = legendWidth + 20 + diagramSectionWidth;
    const totalHeight = Math.max(legendHeight, diagramSectionHeight);

    // Get original SVG content
    const originalContent = originalSvg.innerHTML;

    // Create Axis SVG parts
    const defs = `
      <defs>
        <marker id="axis-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="${AXIS_COLOR}" />
        </marker>
      </defs>
    `;

    const yAxis = `
      <g transform="translate(0, 0)">
        <!-- Y Axis Line -->
        <line x1="${AXIS_SIZE / 2}" y1="${origHeight}" x2="${
      AXIS_SIZE / 2
    }" y2="10" stroke="${AXIS_COLOR}" stroke-width="${AXIS_STROKE_WIDTH}" marker-end="url(#axis-arrow)" />
        <!-- Label -->
        <text x="${AXIS_SIZE / 2 - 10}" y="${
      origHeight / 2
    }" fill="${AXIS_COLOR}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" transform="rotate(-90, ${
      AXIS_SIZE / 2 - 10
    }, ${origHeight / 2})" text-anchor="middle">Space</text>
      </g>
    `;

    const xAxis = `
      <g transform="translate(${AXIS_SIZE}, ${origHeight})">
        <!-- X Axis Line -->
        <line x1="0" y1="${AXIS_SIZE / 2}" x2="${origWidth - 10}" y2="${
      AXIS_SIZE / 2
    }" stroke="${AXIS_COLOR}" stroke-width="${AXIS_STROKE_WIDTH}" marker-end="url(#axis-arrow)" />
        <!-- Label -->
        <text x="${origWidth / 2}" y="${
      AXIS_SIZE / 2 + 5
    }" fill="${AXIS_COLOR}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="hanging">Time</text>
      </g>
    `;

    // Build combined SVG
    const combinedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  ${defs}
  
  <!-- Legend -->
  <g transform="translate(0, 0)">
    <rect x="0" y="0" width="${legendWidth}" height="${legendHeight}" fill="#ffffff" stroke="#e5e7eb" stroke-width="1" rx="4"/>
    ${legend.content}
  </g>
  
  <!-- Diagram Section -->
  <g transform="translate(${legendWidth + 20}, 0)">
    
    <!-- Y Axis (Space) -->
    ${yAxis}

    <!-- The Diagram Content -->
    <g transform="translate(${AXIS_SIZE}, 0)">
      ${originalContent}
    </g>

    <!-- X Axis (Time) -->
    ${xAxis}
    
  </g>
</svg>`;

    const base64 = toBase64Utf8(combinedSvg);

    const pom = document.createElement("a");
    pom.setAttribute("href", "data:image/svg+xml;base64," + base64);
    pom.setAttribute("download", "activity_diagram.svg");

    if (document.createEvent) {
      const event = document.createEvent("MouseEvents");
      event.initEvent("click", true, true);
      pom.dispatchEvent(event);
    } else {
      pom.click();
    }
  }

  return (
    <Button
      variant="primary"
      onClick={downloadsvg}
      className={dataset.individuals.size > 0 ? "mx-1 d-block" : "mx-1 d-none"}
    >
      Export SVG
    </Button>
  );
};

export default ExportSvg;
