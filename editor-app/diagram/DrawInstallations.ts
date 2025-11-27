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
    return ind.id.split("__installed_in__")[1];
  }
  return undefined;
}

// Type for installation draw data
interface InstallationDrawData {
  ind: Individual;
  inst: Installation;
  refId: string;
  originalComponent: Individual;
}

export function drawInstallations(ctx: DrawContext) {
  const { svgElement, individuals, activities, config, dataset } = ctx;

  if (!individuals || individuals.length === 0) return;
  if (!activities || activities.length === 0) return;

  // Collect installations ONLY for installation reference rows
  const installationData: InstallationDrawData[] = [];

  individuals.forEach((ind) => {
    if (!isInstallationRef(ind)) return;
    const originalId = getOriginalId(ind);
    const slotId = getSlotId(ind);
    if (!slotId) return;
    const originalComponent = dataset.individuals.get(originalId);
    if (!originalComponent) return;

    const relevant = (originalComponent.installations || []).filter(
      (inst) => inst.targetId === slotId
    );
    relevant.forEach((inst) =>
      installationData.push({ ind, inst, refId: ind.id, originalComponent })
    );
  });

  if (installationData.length === 0) return;

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

    // Background
    pattern
      .append("rect")
      .attr("width", 8)
      .attr("height", 8)
      .attr("fill", "white")
      .attr("fill-opacity", 0.3);

    // Diagonal lines
    pattern
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 8)
      .attr("stroke", "#374151")
      .attr("stroke-width", 1.5);
  }

  // Draw hatched area using the same path as the individual (chevron shape)
  // This clips the hatch to match exactly
  svgElement
    .selectAll(".installation-period")
    .data(
      installationData,
      (d: InstallationDrawData) => `${d.refId}:${d.inst.id}`
    )
    .join("path")
    .attr("class", "installation-period")
    .attr("d", (d: InstallationDrawData) => {
      // Get the path data from the individual element
      const escapedId = CSS.escape("i" + d.refId);
      const node = svgElement
        .select("#" + escapedId)
        .node() as SVGPathElement | null;
      if (node) {
        // Copy the exact path from the individual shape
        return node.getAttribute("d") || "";
      }
      return "";
    })
    .attr("fill", "url(#diagonal-hatch)")
    .attr("stroke", "none")
    .attr("pointer-events", "none")
    .raise();
}
