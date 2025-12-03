import { DrawContext, keepIndividualLabels } from "./DrawHelpers";
import { EntityType, Individual } from "@/lib/Schema";
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
 * Get the time periods where children are installed in this SC virtual row.
 * Returns an array of {start, end} objects representing when children exist.
 */
function getChildInstallationPeriods(
  ind: Individual,
  dataset: Model
): { start: number; end: number }[] {
  if (!ind._isVirtualRow) return [];

  const originalId = getOriginalId(ind);
  const original = dataset.individuals.get(originalId);
  if (!original) return [];

  const origType = original.entityType ?? EntityType.Individual;
  if (origType !== EntityType.SystemComponent) return [];

  // Get the installation ID for this virtual row
  const scInstallationId = ind._installationId || getInstallationId(ind);
  if (!scInstallationId) return [];

  const periods: { start: number; end: number }[] = [];

  // Find all components installed in this SC with matching context
  dataset.individuals.forEach((component) => {
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
        const start = installation.beginning ?? 0;
        const end = installation.ending ?? Model.END_OF_TIME;
        periods.push({ start, end });
      }
    }
  });

  return periods;
}

export function drawInstallations(ctx: DrawContext) {
  const { svgElement, individuals, config, dataset, activities } = ctx;

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

  // Calculate time range (same as in DrawParticipations)
  let startOfTime = Math.min(...activities.map((a) => a.beginning));
  let endOfTime = Math.max(...activities.map((a) => a.ending));

  if (activities.length === 0 || !isFinite(startOfTime)) {
    startOfTime = 0;
  }
  if (activities.length === 0 || !isFinite(endOfTime)) {
    endOfTime = 10;
  }

  // Expand time range to include all individuals
  individuals.forEach((ind) => {
    if (ind.beginning >= 0 && ind.beginning < startOfTime) {
      startOfTime = ind.beginning;
    }
    if (ind.ending < Model.END_OF_TIME && ind.ending > endOfTime) {
      endOfTime = ind.ending;
    }
  });

  if (endOfTime <= startOfTime) {
    endOfTime = startOfTime + 10;
  }

  const duration = Math.max(1, endOfTime - startOfTime);
  let totalLeftMargin =
    config.viewPort.x * config.viewPort.zoom -
    config.layout.individual.xMargin * 2;
  totalLeftMargin -= config.layout.individual.temporalMargin;

  if (config.labels.individual.enabled && keepIndividualLabels(individuals)) {
    totalLeftMargin -= config.layout.individual.textLength;
  }

  const timeInterval = totalLeftMargin / duration;
  const xBase =
    config.layout.individual.xMargin +
    config.layout.individual.temporalMargin +
    (config.labels.individual.enabled
      ? config.layout.individual.textLength
      : 0);

  // For each SystemComponent virtual row that has children, draw hatched overlays
  // ONLY for the time periods where children are installed
  individuals.forEach((ind) => {
    if (!isInstallationRef(ind)) return;

    // Only apply hatch to SystemComponent virtual rows
    const originalId = getOriginalId(ind);
    const original = dataset.individuals.get(originalId);
    if (!original) return;

    const entityType = original.entityType ?? EntityType.Individual;
    if (entityType !== EntityType.SystemComponent) return;

    // Get the periods where children are installed
    const childPeriods = getChildInstallationPeriods(ind, dataset);
    if (childPeriods.length === 0) return;

    // Get the individual's row element to find Y position and height
    const escapedId = CSS.escape("i" + ind.id);
    const node = svgElement
      .select("#" + escapedId)
      .node() as SVGGraphicsElement | null;
    if (!node) return;

    const box = node.getBBox();
    const rowY = box.y;
    const rowHeight = box.height;

    // Get the individual's visible time bounds (for clipping)
    const indStart = ind.beginning >= 0 ? ind.beginning : startOfTime;
    const indEnd = ind.ending < Model.END_OF_TIME ? ind.ending : endOfTime;

    // Draw a hatch rectangle for each child period
    childPeriods.forEach((period) => {
      // Clip period to the individual's visible time range AND the overall time range
      const clipStart = Math.max(period.start, startOfTime, indStart);
      const clipEnd = Math.min(
        period.end < Model.END_OF_TIME ? period.end : endOfTime,
        endOfTime,
        indEnd
      );

      if (clipEnd <= clipStart) return;

      // Calculate X position and width for this period
      const hatchX = xBase + timeInterval * (clipStart - startOfTime);
      const hatchWidth = timeInterval * (clipEnd - clipStart);

      if (hatchWidth <= 0) return;

      // Create a unique clip path for this hatch to clip to the row's shape
      const clipId = `hatch-clip-${ind.id.replace(/[^a-zA-Z0-9]/g, "_")}-${
        period.start
      }-${period.end}`;

      // Remove existing clip path with same ID
      defs.select(`#${clipId}`).remove();

      // Get the path data from the individual element to use as clip
      const pathData = (node as SVGPathElement).getAttribute?.("d");

      if (pathData) {
        // Create clip path using the individual's shape
        const clipPath = defs.append("clipPath").attr("id", clipId);
        clipPath.append("path").attr("d", pathData);

        // Draw hatch rectangle clipped to the individual's shape
        svgElement
          .append("rect")
          .attr("class", "installation-period")
          .attr("x", hatchX)
          .attr("y", rowY)
          .attr("width", hatchWidth)
          .attr("height", rowHeight)
          .attr("fill", "url(#diagonal-hatch)")
          .attr("stroke", "none")
          .attr("pointer-events", "none")
          .attr("clip-path", `url(#${clipId})`);
      } else {
        // Fallback: use bounding box without clip path
        svgElement
          .append("rect")
          .attr("class", "installation-period")
          .attr("x", hatchX)
          .attr("y", rowY)
          .attr("width", hatchWidth)
          .attr("height", rowHeight)
          .attr("fill", "url(#diagonal-hatch)")
          .attr("stroke", "none")
          .attr("pointer-events", "none");
      }
    });
  });
}
