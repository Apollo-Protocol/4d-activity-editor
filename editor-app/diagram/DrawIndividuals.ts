import { MouseEvent } from "react";
import { Activity, Individual, EntityType } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import {
  DrawContext,
  keepIndividualLabels,
  Label,
  removeLabelIfItOverlaps,
} from "./DrawHelpers";
import { ConfigData } from "./config";
import { entityTypes } from "@/components/EntityTypeLegend"; // use legend as source of truth

let mouseOverElement: any | null = null;

interface Layout {
  x: number;
  y: number;
  w: number;
  h: number;
  start: boolean;
  stop: boolean;
  nestingLevel: number;
}

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

// Get the target ID from an installation reference
function getTargetId(ind: Individual): string | undefined {
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

// Get the context installation ID (parent installation) from an installation reference
function getContextInstallationId(ind: Individual): string | undefined {
  if (isInstallationRef(ind)) {
    const parts = ind.id.split("__ctx_");
    if (parts.length > 1) {
      return parts[1];
    }
  }
  return undefined;
}

// Get the nesting level for indentation (uses _nestingLevel property)
function getNestingLevel(ind: Individual): number {
  return ind._nestingLevel ?? 0;
}

// Check if this is a virtual row (installation reference)
function isVirtualRow(ind: Individual): boolean {
  return ind._isVirtualRow === true;
}

// Helper function to get icon for entity type (use EntityTypeLegend source)
function getEntityIcon(ind: Individual, dataset: Model): string {
  const findIcon = (label: string) =>
    entityTypes.find((e) => e.label === label)?.icon ?? "";

  let entityType = ind.entityType ?? EntityType.Individual;

  // If it's a virtual row, look up the original entity to get the correct icon
  if (isVirtualRow(ind)) {
    const originalId = getOriginalId(ind);
    const original = dataset.individuals.get(originalId);
    if (original) {
      const origType = original.entityType ?? EntityType.Individual;

      // For a SystemComponent virtual row (system-installed instance), use the
      // explicit "Installed (system)" icon from the legend.
      if (origType === EntityType.SystemComponent) {
        return findIcon("Installed (system)");
      }

      // For an InstalledComponent virtual row (installed into a system component),
      // use the "Installed (in system comp)" icon from the legend.
      if (origType === EntityType.InstalledComponent) {
        return findIcon("Installed (in system comp)");
      }

      // Otherwise fall back to the original's type below
      entityType = origType;
    }
  }

  switch (entityType) {
    case EntityType.System:
      return findIcon("System");
    case EntityType.SystemComponent:
      return findIcon("System Component");
    case EntityType.InstalledComponent:
      return findIcon("Installed Component");
    default:
      return findIcon("Individual");
  }
}

// Helper function to get effective time bounds for a target (System or SystemComponent)
function getTargetEffectiveTimeBounds(
  targetId: string,
  dataset: Model
): { beginning: number; ending: number } {
  const target = dataset.individuals.get(targetId);
  if (!target) {
    return { beginning: 0, ending: Model.END_OF_TIME };
  }

  let beginning = target.beginning;
  let ending = target.ending;

  const targetType = target.entityType ?? EntityType.Individual;

  // If target is a SystemComponent, get bounds from its installation into a System
  if (targetType === EntityType.SystemComponent) {
    if (target.installations && target.installations.length > 0) {
      const instBeginnings = target.installations.map((inst) =>
        Math.max(0, inst.beginning ?? 0)
      );
      const instEndings = target.installations.map(
        (inst) => inst.ending ?? Model.END_OF_TIME
      );
      const earliestBeginning = Math.min(...instBeginnings);
      const latestEnding = Math.max(...instEndings);

      if (beginning < 0) {
        beginning = earliestBeginning;
      }
      if (ending >= Model.END_OF_TIME && latestEnding < Model.END_OF_TIME) {
        ending = latestEnding;
      }
    } else if (beginning < 0) {
      beginning = 0;
    }
  }

  // If target is a System, use its defined bounds
  if (targetType === EntityType.System) {
    if (beginning < 0) beginning = 0;
  }

  if (beginning < 0) beginning = 0;

  return { beginning, ending };
}

// Determine if a separator should be drawn after this individual
function shouldDrawSeparatorAfter(
  current: Individual,
  next: Individual | undefined,
  dataset: Model
): boolean {
  if (!next) return false;

  const currentLevel = getNestingLevel(current);
  const nextLevel = getNestingLevel(next);

  // Draw separator when transitioning from nested items back to top level
  if (currentLevel > 0 && nextLevel === 0) {
    const nextType = next.entityType ?? EntityType.Individual;
    if (
      nextType === EntityType.SystemComponent ||
      nextType === EntityType.InstalledComponent ||
      nextType === EntityType.Individual
    ) {
      return true;
    }
  }
  return false;
}

export function drawIndividuals(ctx: DrawContext) {
  const { config, svgElement, activities, dataset } = ctx;
  const individuals = ctx.individuals;

  if (!individuals || individuals.length === 0) {
    return svgElement;
  }

  // Calculate time range from activities
  let startOfTime = Math.min(...activities.map((a) => a.beginning));
  let endOfTime = Math.max(...activities.map((a) => a.ending));

  // Expand time range to include installed components' actual installation periods
  for (const ind of individuals) {
    if (isInstallationRef(ind)) {
      const originalId = getOriginalId(ind);
      const targetId = getTargetId(ind);
      if (originalId && targetId) {
        const original = dataset.individuals.get(originalId);
        if (original && original.installations) {
          // Get ALL installations for this component in this target
          const installationsForTarget = original.installations.filter(
            (x) => x.targetId === targetId
          );

          for (const inst of installationsForTarget) {
            const instBeginning = Math.max(0, inst.beginning ?? 0);
            if (instBeginning < startOfTime) startOfTime = instBeginning;
            if (
              inst.ending !== undefined &&
              inst.ending < Model.END_OF_TIME &&
              inst.ending > endOfTime
            )
              endOfTime = inst.ending;
          }
        }
      }
    }
  }

  let duration = endOfTime - startOfTime;
  let totalLeftMargin =
    config.viewPort.x * config.viewPort.zoom -
    config.layout.individual.xMargin * 2;
  totalLeftMargin -= config.layout.individual.temporalMargin;

  const individualLabelsEnabled =
    config.labels.individual.enabled && keepIndividualLabels(individuals);
  if (individualLabelsEnabled) {
    totalLeftMargin -= config.layout.individual.textLength;
  }

  let timeInterval = totalLeftMargin / duration;

  let lhs_x = config.layout.individual.xMargin;
  lhs_x += config.layout.individual.temporalMargin;
  if (individualLabelsEnabled) {
    lhs_x += config.layout.individual.textLength;
  }

  const chevOff = config.layout.individual.height / 3;
  const fullWidth =
    chevOff +
    config.viewPort.x * config.viewPort.zoom +
    config.layout.individual.temporalMargin -
    config.layout.individual.xMargin * 2;

  const layout = new Map<string, Layout>();

  /* Layout calculation */
  let next_y =
    config.layout.individual.topMargin + config.layout.individual.gap;
  for (const i of individuals) {
    let effectiveBeginning = i.beginning;
    let effectiveEnding = i.ending;

    // For installation references (virtual rows)
    if (isInstallationRef(i)) {
      const originalId = getOriginalId(i);
      const targetId = getTargetId(i);
      const installationId = getInstallationId(i);
      const contextInstallationId = getContextInstallationId(i);

      let targetBounds = { beginning: 0, ending: Model.END_OF_TIME };
      let foundContext = false;

      // Try to get bounds from the specific parent installation context
      if (contextInstallationId && targetId) {
        const target = dataset.individuals.get(targetId);
        if (target && target.installations) {
          const parentInst = target.installations.find(
            (inst) => inst.id === contextInstallationId
          );
          if (parentInst) {
            targetBounds = {
              beginning: parentInst.beginning ?? 0,
              ending: parentInst.ending ?? Model.END_OF_TIME,
            };
            foundContext = true;
          }
        }
      }

      // Fallback to generic target bounds if no context found
      if (!foundContext && targetId) {
        targetBounds = getTargetEffectiveTimeBounds(targetId, dataset);
      }

      let instBeginning = i.beginning >= 0 ? i.beginning : 0;
      let instEnding =
        i.ending < Model.END_OF_TIME ? i.ending : Model.END_OF_TIME;

      if (instBeginning < 0 || instEnding >= Model.END_OF_TIME) {
        if (originalId && targetId) {
          const original = dataset.individuals.get(originalId);
          if (original && original.installations) {
            let installation = installationId
              ? original.installations.find((x) => x.id === installationId)
              : original.installations.find((x) => x.targetId === targetId);

            if (installation) {
              instBeginning = Math.max(0, installation.beginning ?? 0);
              instEnding = installation.ending ?? Model.END_OF_TIME;
            }
          }
        }
      }

      effectiveBeginning = Math.max(instBeginning, targetBounds.beginning);
      effectiveEnding = Math.min(
        instEnding,
        targetBounds.ending < Model.END_OF_TIME
          ? targetBounds.ending
          : instEnding
      );

      if (effectiveBeginning >= effectiveEnding) {
        effectiveBeginning = instBeginning;
        effectiveEnding = instEnding;
      }
    }

    const nestingLevel = getNestingLevel(i);
    const start = effectiveBeginning >= startOfTime;
    const stop = effectiveEnding <= endOfTime;

    let x: number;
    if (start) {
      x = lhs_x + timeInterval * (effectiveBeginning - startOfTime);
    } else {
      x = config.layout.individual.xMargin - chevOff;
    }

    const y = next_y;
    next_y = y + config.layout.individual.height + config.layout.individual.gap;

    let w: number;
    if (!start && !stop) {
      w = fullWidth;
    } else if (start && !stop) {
      w =
        (endOfTime - effectiveBeginning) * timeInterval +
        config.layout.individual.temporalMargin;
    } else if (!start && stop) {
      w =
        fullWidth -
        (endOfTime - effectiveEnding) * timeInterval -
        config.layout.individual.temporalMargin;
    } else {
      w = (effectiveEnding - effectiveBeginning) * timeInterval;
    }

    if (w < 20) w = 20;
    const h = config.layout.individual.height;

    layout.set(i.id, { x, y, w, h, start, stop, nestingLevel });
  }

  svgElement
    .selectAll(".individual")
    .data(individuals.values())
    .join("path")
    .attr("class", "individual")
    .attr("id", (d: Individual) => "i" + d["id"])
    .attr("d", (i: Individual) => {
      const { x, y, w, h, start, stop } = layout.get(i.id)!;
      const rightChevron = stop
        ? `l 0 ${h}`
        : `l ${chevOff} ${h / 2} ${-chevOff} ${h / 2}`;
      const leftChevron = `l ${chevOff} ${-h / 2} ${-chevOff} ${-h / 2}`;
      return (
        `M ${x} ${y} l ${w} 0` + rightChevron + `l ${-w} 0` + leftChevron + "Z"
      );
    })
    .attr("stroke", config.presentation.individual.stroke)
    .attr("stroke-width", config.presentation.individual.strokeWidth)
    .attr("fill", (d: Individual) => {
      // No hatch; fill uses presentation config for all rows
      return config.presentation.individual.fill;
    });

  // Draw separators between groups
  drawGroupSeparators(ctx, individuals, layout, config);

  return svgElement;
}

// Draw separator lines between groups
function drawGroupSeparators(
  ctx: DrawContext,
  individuals: Individual[],
  layout: Map<string, Layout>,
  config: ConfigData
) {
  const { svgElement, dataset } = ctx;

  // Remove existing separators
  svgElement.selectAll(".group-separator").remove();

  const separatorPositions: { y: number; x1: number; x2: number }[] = [];

  // Calculate the full width for separators
  const x1 = config.layout.individual.xMargin;
  const x2 =
    config.viewPort.x * config.viewPort.zoom - config.layout.individual.xMargin;

  for (let i = 0; i < individuals.length; i++) {
    const ind = individuals[i];
    const nextInd = individuals[i + 1];

    if (shouldDrawSeparatorAfter(ind, nextInd, dataset)) {
      const layoutData = layout.get(ind.id);
      if (layoutData) {
        // Position the separator below this individual
        const y =
          layoutData.y + layoutData.h + config.layout.individual.gap / 2;
        separatorPositions.push({ y, x1, x2 });
      }
    }
  }

  // Draw the separators
  separatorPositions.forEach((pos, idx) => {
    svgElement
      .append("line")
      .attr("class", "group-separator")
      .attr("id", `separator-${idx}`)
      .attr("x1", pos.x1)
      .attr("y1", pos.y)
      .attr("x2", pos.x2)
      .attr("y2", pos.y)
      .attr("stroke", "#9ca3af") // Gray color
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "6,4") // Dashed line
      .attr("opacity", 0.6);
  });
}

export function hoverIndividuals(ctx: DrawContext) {
  const { config, svgElement, tooltip } = ctx;
  svgElement
    .selectAll(".individual")
    .on("mouseover", function (event: MouseEvent) {
      mouseOverElement = event.target as HTMLElement;
      mouseOverElement.style.fill = config.presentation.individual.fillHover;
      tooltip.style("display", "block");
    })
    .on("mouseout", function (event: MouseEvent) {
      if (mouseOverElement) {
        mouseOverElement.style.fill = config.presentation.individual.fill;
        mouseOverElement = null;
      }
      tooltip.style("display", "none");
    })
    .on("mousemove", function (event: MouseEvent, d: any) {
      tooltip.html(individualTooltip(d));
      if (event.pageX < window.innerWidth / 2) {
        tooltip
          .style("top", event.pageY + 20 + "px")
          .style("left", event.pageX + "px");
      } else {
        const ttWidth = tooltip?.node().getBoundingClientRect().width;
        tooltip
          .style("top", event.pageY + 20 + "px")
          .style("left", event.pageX - ttWidth + "px");
      }
    });
}

function individualTooltip(individual: Individual) {
  let tip = "<strong>Individual</strong>";

  if (isInstallationRef(individual)) {
    const originalType = individual.entityType ?? EntityType.Individual;
    if (originalType === EntityType.SystemComponent) {
      tip = "<strong>System Component</strong>";
      tip += "<br/><em>(Installation instance)</em>";
    } else {
      tip = "<strong>Installed Component</strong>";
      tip += "<br/><em>(Installation instance)</em>";
    }
  }

  if (individual.name) tip += "<br/> Name: " + individual.name;
  if (individual.type) tip += "<br/> Type: " + individual.type.name;
  if (individual.description)
    tip += "<br/> Description: " + individual.description;
  return tip;
}

export function clickIndividuals(
  ctx: DrawContext,
  clickIndividual: any,
  rightClickIndividual: any
) {
  const { config, svgElement, individuals, dataset } = ctx;
  individuals.forEach((i) => {
    // For installation references, pass the virtual individual (with composite ID)
    // so the click handler can extract the target ID
    // For regular individuals, pass as-is
    const individualToPass = i;

    const lclick = (e: MouseEvent) => clickIndividual(individualToPass);
    const rclick = (e: MouseEvent) => {
      e.preventDefault();
      // For right-click, we might want the actual individual for editing
      const actualIndividual = isInstallationRef(i)
        ? dataset.individuals.get(getOriginalId(i))
        : i;
      if (actualIndividual) {
        rightClickIndividual(actualIndividual);
      }
    };

    svgElement
      .select("#i" + CSS.escape(i.id))
      .on("click", lclick)
      .on("contextmenu", rclick);
    svgElement
      .select("#il" + CSS.escape(i.id))
      .on("click", lclick)
      .on("contextmenu", rclick);
  });
}

// Labels all aligned to the left (no indent), icons show the type
export function labelIndividuals(ctx: DrawContext) {
  const { config, svgElement, individuals, dataset } = ctx;

  if (config.labels.individual.enabled === false) {
    return;
  }

  let labels: Label[] = [];

  let y =
    config.layout.individual.topMargin +
    config.layout.individual.gap +
    config.layout.individual.height / 2 +
    config.labels.individual.topMargin;

  // Draw icons with indentation to show hierarchy
  svgElement
    .selectAll(".individualIcon")
    .data(individuals.values())
    .join("text")
    .attr("class", "individualIcon")
    .attr("id", (i: Individual) => `ii${i.id}`)
    .attr("x", (i: Individual) => {
      const nestingLevel = getNestingLevel(i);
      const indent = nestingLevel * 20; // Indent icons
      return (
        config.layout.individual.xMargin +
        config.labels.individual.leftMargin +
        indent
      );
    })
    .attr("y", (i: Individual, idx: number) => {
      return (
        config.layout.individual.topMargin +
        config.layout.individual.gap +
        config.layout.individual.height / 2 +
        config.labels.individual.topMargin +
        idx * (config.layout.individual.height + config.layout.individual.gap)
      );
    })
    .attr("text-anchor", "start")
    .attr("font-family", "Arial, sans-serif")
    .attr("font-size", config.labels.individual.fontSize)
    .attr("fill", "#374151")
    .text((d: Individual) => getEntityIcon(d, dataset)); // Pass dataset to get correct icon

  // Draw labels with indentation
  svgElement
    .selectAll(".individualLabel")
    .data(individuals.values())
    .join("text")
    .attr("class", "individualLabel")
    .attr("id", (i: Individual) => `il${i.id}`)
    .attr("x", (i: Individual) => {
      const nestingLevel = getNestingLevel(i);
      const indent = nestingLevel * 20; // Indent labels
      return (
        config.layout.individual.xMargin +
        config.labels.individual.leftMargin +
        16 +
        indent
      );
    })
    .attr("y", () => {
      const oldY = y;
      y = y + config.layout.individual.height + config.layout.individual.gap;
      return oldY;
    })
    .attr("text-anchor", "start")
    .attr("font-family", "Roboto, Arial, sans-serif")
    .attr("font-size", config.labels.individual.fontSize)
    .attr("fill", "#111827")
    .text((d: Individual) => {
      // Truncate labels for virtual SystemComponent or virtual InstalledComponent to 6 chars + "..."
      let label = d.name ?? "";
      if (isVirtualRow(d)) {
        const originalId = getOriginalId(d);
        const original = dataset.individuals.get(originalId);
        const origType = original?.entityType ?? EntityType.Individual;
        if (
          (origType === EntityType.SystemComponent ||
            origType === EntityType.InstalledComponent) &&
          label.length > 6
        ) {
          return label.substring(0, 6) + "...";
        }
      }

      if (label.length > config.labels.individual.maxChars - 2) {
        label = label.substring(0, config.labels.individual.maxChars - 2);
        label += "...";
      }
      return label;
    })
    .each((d: Individual, i: number, nodes: SVGGraphicsElement[]) => {
      removeLabelIfItOverlaps(labels, nodes[i]);
      labels.push(nodes[i].getBBox());
    });
}
