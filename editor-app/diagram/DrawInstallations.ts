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

/**
 * Check if a SystemComponent (virtual row) has children installed in it.
 * A SC has children if there are other components (SC or IC) with installations
 * that target this SC AND have the matching scInstallationContextId.
 */
function scHasChildren(ind: Individual, dataset: Model): boolean {
  if (!ind._isVirtualRow) return false;

  const originalId = getOriginalId(ind);
  const original = dataset.individuals.get(originalId);
  if (!original) return false;

  const origType = original.entityType ?? EntityType.Individual;
  if (origType !== EntityType.SystemComponent) return false;

  // Get the installation ID for this virtual row
  const scInstallationId = ind._installationId || getInstallationId(ind);
  if (!scInstallationId) return false;

  // Check if any component has an installation targeting this SC with matching context
  let hasChildren = false;

  dataset.individuals.forEach((component) => {
    if (hasChildren) return; // Early exit if already found

    const compType = component.entityType ?? EntityType.Individual;
    if (
      compType !== EntityType.SystemComponent &&
      compType !== EntityType.InstalledComponent
    ) {
      return;
    }

    if (!component.installations || component.installations.length === 0) {
      return;
    }

    // Check if any installation targets this SC with matching context
    for (const installation of component.installations) {
      if (installation.targetId !== originalId) continue;

      // For nested installations, the scInstallationContextId must match
      if (installation.scInstallationContextId === scInstallationId) {
        hasChildren = true;
        return;
      }
    }
  });

  return hasChildren;
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
      .attr("fill-opacity", 0.1);

    pattern
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 8)
      .attr("stroke", "#374151")
      .attr("stroke-width", 1);
  }

  // For each SystemComponent virtual row that has children, draw a hatched overlay
  individuals.forEach((ind) => {
    if (!isInstallationRef(ind)) return;

    // Only apply hatch to SystemComponent virtual rows that have children
    const originalId = getOriginalId(ind);
    const original = dataset.individuals.get(originalId);
    if (!original) return;

    const entityType = original.entityType ?? EntityType.Individual;
    if (entityType !== EntityType.SystemComponent) return;

    // Check if this SC has children installed in it
    if (!scHasChildren(ind, dataset)) return;

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
