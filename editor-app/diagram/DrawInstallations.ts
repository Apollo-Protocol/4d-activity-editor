import { DrawContext } from "./DrawHelpers";
import { EntityType, Installation, Individual } from "@/lib/Schema";

export function drawInstallations(ctx: DrawContext) {
  const { svgElement, individuals, activities, config } = ctx;

  // Only process installed components
  const installedComponents = individuals.filter(
    (i) =>
      (i.entityType ?? EntityType.Individual) === EntityType.InstalledComponent
  );

  if (installedComponents.length === 0) return;

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

  // Default fallback
  if (!isFinite(startOfTime)) startOfTime = 0;
  if (!isFinite(endOfTime)) endOfTime = 100;

  const duration = endOfTime - startOfTime;
  let totalLeftMargin =
    config.viewPort.x * config.viewPort.zoom -
    config.layout.individual.xMargin * 2;
  totalLeftMargin -= config.layout.individual.temporalMargin;

  const timeInterval = duration > 0 ? totalLeftMargin / duration : 1;
  const lhs_x =
    config.layout.individual.xMargin +
    config.layout.individual.temporalMargin +
    (config.labels.individual.enabled
      ? config.layout.individual.textLength
      : 0);

  // Collect all installations
  const installations: Array<{ inst: Installation; component: Individual }> =
    [];
  installedComponents.forEach((comp) => {
    if (comp.installations && comp.installations.length > 0) {
      comp.installations.forEach((inst) => {
        installations.push({ inst, component: comp });
      });
    }
  });

  if (installations.length === 0 || timeInterval <= 0) return;

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

    // Background (optional - remove for transparent background)
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
    .data(installations)
    .join("rect")
    .attr("class", "installation-period")
    .attr("x", (d: any) => {
      return lhs_x + timeInterval * (d.inst.beginning - startOfTime);
    })
    .attr("y", (d: any) => {
      // Find the component's row
      const node = svgElement.select("#i" + d.component.id).node();
      if (!node) return 0;
      return node.getBBox().y;
    })
    .attr("width", (d: any) => {
      return (d.inst.ending - d.inst.beginning) * timeInterval;
    })
    .attr("height", (d: any) => {
      const node = svgElement.select("#i" + d.component.id).node();
      if (!node) return 0;
      return node.getBBox().height;
    })
    .attr("fill", "url(#diagonal-hatch)") // Use the hatch pattern
    .attr("stroke", "#374151") // Optional border
    .attr("stroke-width", 1)
    .attr("rx", 2)
    .attr("ry", 2)
    .raise();
}
