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

    // Build legend
    const legend = buildLegendSvg();
    const legendWidth = legend.width;
    const legendHeight = legend.height;

    // Calculate new dimensions
    const totalWidth = legendWidth + origWidth + 20; // 20px gap
    const totalHeight = Math.max(legendHeight, origHeight);

    // Get original SVG content
    const originalContent = originalSvg.innerHTML;

    // Build combined SVG
    const combinedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <!-- Legend -->
  <g transform="translate(0, 0)">
    <rect x="0" y="0" width="${legendWidth}" height="${legendHeight}" fill="#ffffff" stroke="#e5e7eb" stroke-width="1" rx="4"/>
    ${legend.content}
  </g>
  
  <!-- Diagram -->
  <g transform="translate(${legendWidth + 20}, 0)">
    ${originalContent}
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
