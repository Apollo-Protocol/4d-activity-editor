import { DrawContext, keepIndividualLabels } from "./DrawHelpers";
import { EntityType, Installation, Individual } from "@/lib/Schema";
import { Model } from "@/lib/Model";

// Helper to check if this is an "installation reference" (virtual row)
function isInstallationRef(ind: Individual): boolean {
  return ind.id.includes("__installed_in__");
}

// Get the original ID from an installation reference
function getOriginalId(ind: Individual): string {
  if (isInstallationRef(ind)) {
    return ind.id.split("__installed_in__")[0];
  }
  return ind.id;
}

// Get the slot ID from an installation reference
function getSlotId(ind: Individual): string | undefined {
  if (isInstallationRef(ind)) {
    const parts = ind.id.split("__installed_in__")[1];
    if (parts) {
      const subParts = parts.split("__");
      return subParts[0];
    }
  }
  return undefined;
}

// Get the installation ID from an installation reference
function getInstallationId(ind: Individual): string | undefined {
  if (isInstallationRef(ind)) {
    const parts = ind.id.split("__installed_in__")[1];
    if (parts) {
      const subParts = parts.split("__");
      return subParts[1];
    }
  }
  return ind._installationId;
}

export function drawInstallations(ctx: DrawContext) {
  const { svgElement, individuals, config, dataset } = ctx;

  if (!individuals || individuals.length === 0) return;

  // Remove existing installation hatches
  svgElement.selectAll(".installation-period").remove();

  // Create or get the defs element for patterns
  let defs = svgElement.select("defs");
  if (defs.empty()) {
    defs = svgElement.append("defs");
  }

  // Create diagonal hatch pattern if it doesn't exist
  if (defs.select("#diagonal-hatch").empty()) {
    const pattern = defs
      .append("pattern")
      .attr("id", "diagonal-hatch")
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 8)
      .attr("height", 8)
      .attr("patternTransform", "rotate(45)");

    pattern
      .append("rect")
      .attr("width", 8)
      .attr("height", 8)
      .attr("fill", "white")
      .attr("fill-opacity", 0.3);

    pattern
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 8)
      .attr("stroke", "#374151")
      .attr("stroke-width", 1.5);
  }

  // For each installation reference row, draw a hatched overlay matching the chevron shape
  individuals.forEach((ind) => {
    if (!isInstallationRef(ind)) return;

    // Get the path data from the individual element
    const escapedId = CSS.escape("i" + ind.id);
    const node = svgElement
      .select("#" + escapedId)
      .node() as SVGPathElement | null;
    if (!node) return;

    const pathData = node.getAttribute("d");
    if (!pathData) return;

    // Draw hatch overlay using the same path as the individual
    svgElement
      .append("path")
      .attr("class", "installation-period")
      .attr("d", pathData)
      .attr("fill", "url(#diagonal-hatch)")
      .attr("stroke", "none")
      .attr("pointer-events", "none");
  });
}
