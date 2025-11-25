import { DrawContext } from "./DrawHelpers";
import { EntityType, Installation, Individual } from "@/lib/Schema";

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

export function drawInstallations(ctx: DrawContext) {
  const { svgElement, individuals, activities, config, dataset } = ctx;

  // Calculate time scale using BOTH activities AND individuals
  let startOfTime = Infinity;
  let endOfTime = -Infinity;

  // Consider activities
  activities.forEach((a) => {
    if (a.beginning < startOfTime) startOfTime = a.beginning;
    if (a.ending > endOfTime) endOfTime = a.ending;
  });

  // Also consider individuals (in case there are no activities)
  individuals.forEach((i) => {
    if (i.beginning >= 0 && i.beginning < startOfTime)
      startOfTime = i.beginning;
    if (i.ending < 1000000 && i.ending > endOfTime) endOfTime = i.ending;
  });

  // Also consider installation periods
  individuals.forEach((ind) => {
    if (isInstallationRef(ind)) {
      const originalId = getOriginalId(ind);
      const slotId = getSlotId(ind);
      const originalComponent = dataset.individuals.get(originalId);

      if (originalComponent && originalComponent.installations) {
        originalComponent.installations
          .filter((inst) => inst.targetId === slotId)
          .forEach((inst) => {
            if (inst.beginning < startOfTime) startOfTime = inst.beginning;
            if (inst.ending > endOfTime) endOfTime = inst.ending;
          });
      }
    }
  });

  // Default fallback
  if (!isFinite(startOfTime)) startOfTime = 0;
  if (!isFinite(endOfTime)) endOfTime = 100;

  const duration = endOfTime - startOfTime;
  if (duration <= 0) return;

  let totalLeftMargin =
    config.viewPort.x * config.viewPort.zoom -
    config.layout.individual.xMargin * 2;
  totalLeftMargin -= config.layout.individual.temporalMargin;

  if (config.labels.individual.enabled) {
    totalLeftMargin -= config.layout.individual.textLength;
  }

  const timeInterval = totalLeftMargin / duration;
  const lhs_x =
    config.layout.individual.xMargin +
    config.layout.individual.temporalMargin +
    (config.labels.individual.enabled
      ? config.layout.individual.textLength
      : 0);

  // Collect installations ONLY for installation reference rows
  const installationData: Array<{
    inst: Installation;
    refId: string; // The installation reference row ID
    originalComponent: Individual;
  }> = [];

  individuals.forEach((ind) => {
    if (!isInstallationRef(ind)) return;

    const originalId = getOriginalId(ind);
    const slotId = getSlotId(ind);
    if (!slotId) return;

    const originalComponent = dataset.individuals.get(originalId);
    if (!originalComponent) return;

    const installations = originalComponent.installations || [];
    const relevantInstallations = installations.filter(
      (inst) => inst.targetId === slotId
    );

    relevantInstallations.forEach((inst) => {
      installationData.push({
        inst,
        refId: ind.id,
        originalComponent,
      });
    });
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

    // Background (optional - for slight visibility)
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
      .attr("stroke", "#374151") // Gray-700
      .attr("stroke-width", 1.5);
  }

  // Draw hatched area for each installation period
  svgElement
    .selectAll(".installation-period")
    .data(installationData)
    .join("rect")
    .attr("class", "installation-period")
    .attr(
      "x",
      (d: {
        inst: Installation;
        refId: string;
        originalComponent: Individual;
      }) => {
        // Ensure installation never starts before 0
        const effectiveStart = Math.max(0, d.inst.beginning);
        // Clamp to visible time range
        const clampedStart = Math.max(effectiveStart, startOfTime);
        return lhs_x + timeInterval * (clampedStart - startOfTime);
      }
    )
    .attr(
      "y",
      (d: {
        inst: Installation;
        refId: string;
        originalComponent: Individual;
      }) => {
        // Find the installation reference row by its composite ID
        // Need to escape special characters in the selector
        const escapedId = d.refId.replace(/__/g, "\\$&");
        const node = svgElement
          .select("#i" + escapedId)
          .node() as SVGGraphicsElement | null;
        if (!node) {
          console.log(`Could not find row for refId: ${d.refId}`);
          return 0;
        }
        return node.getBBox().y;
      }
    )
    .attr(
      "width",
      (d: {
        inst: Installation;
        refId: string;
        originalComponent: Individual;
      }) => {
        // Ensure installation never starts before 0
        const effectiveStart = Math.max(0, d.inst.beginning);
        // Clamp to visible time range
        const clampedStart = Math.max(effectiveStart, startOfTime);
        const clampedEnd = Math.min(d.inst.ending, endOfTime);
        const width = (clampedEnd - clampedStart) * timeInterval;
        return Math.max(0, width);
      }
    )
    .attr(
      "height",
      (d: {
        inst: Installation;
        refId: string;
        originalComponent: Individual;
      }) => {
        const escapedId = d.refId.replace(/__/g, "\\$&");
        const node = svgElement
          .select("#i" + escapedId)
          .node() as SVGGraphicsElement | null;
        if (!node) return 0;
        return node.getBBox().height;
      }
    )
    .attr("fill", "url(#diagonal-hatch)")
    .attr("stroke", "#374151")
    .attr("stroke-width", 1)
    .attr("rx", 2)
    .attr("ry", 2)
    .attr("pointer-events", "none")
    .raise();
}
