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

let mouseOverElement: any | null = null;

interface Layout {
  x: number;
  y: number;
  w: number;
  h: number;
  start: boolean;
  stop: boolean;
  nestingLevel: number;
  showLeftChevron: boolean;
  showRightChevron: boolean;
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

/**
 * Get the appropriate icon for an entity based on its type and installation context.
 *
 * Icon system:
 * - ▣  System (square with fill - contains component slots)
 * - ◇  System Component - uninstalled (empty diamond)
 * - ◆  SC in System (filled diamond - installed directly in system)
 * - ◈  SC in SC (diamond variant - nested in another SC)
 * - ⬡  Installed Component - uninstalled (empty hexagon)
 * - ⬢  IC in SC (filled hexagon - installed in a system component)
 * - ○  Individual (circle)
 */
function getEntityIcon(ind: Individual, dataset: Model): string {
  const entityType = ind.entityType ?? EntityType.Individual;
  const isVirtual = ind._isVirtualRow === true;
  const parentPath = ind._parentPath ?? "";

  // If it's a virtual row, determine the icon based on what it is and where it's installed
  if (isVirtual) {
    const originalId = ind.id.split("__installed_in__")[0];
    const original = dataset.individuals.get(originalId);

    if (original) {
      const origType = original.entityType ?? EntityType.Individual;

      if (origType === EntityType.SystemComponent) {
        // SC installed somewhere
        // Check if it's installed in another SC (nested) or directly in a System
        const pathParts = parentPath.split("__").filter(Boolean);

        if (pathParts.length > 1) {
          // Nested in another SC (path has more than just the system)
          // e.g., path = "systemId__scId" means this SC is in another SC
          return "◈"; // SC in SC
        } else {
          // Directly in a System (path only has systemId)
          return "◆"; // SC in System
        }
      }

      if (origType === EntityType.InstalledComponent) {
        // IC installed in an SC
        return "⬢"; // IC in SC (filled hexagon)
      }
    }
  }

  // Top-level (non-virtual) entities
  switch (entityType) {
    case EntityType.System:
      return "▣"; // System (square with fill)
    case EntityType.SystemComponent:
      return "◇"; // SC uninstalled (empty diamond)
    case EntityType.InstalledComponent:
      return "⬡"; // IC uninstalled (empty hexagon)
    default:
      return "○"; // Individual (circle)
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

  // If no activities, use a default range
  if (activities.length === 0 || !isFinite(startOfTime)) {
    startOfTime = 0;
  }
  if (activities.length === 0 || !isFinite(endOfTime)) {
    endOfTime = 10; // Default end time when no activities
  }

  // Expand time range to include all individuals (including virtual rows)
  for (const ind of individuals) {
    // For regular individuals with defined bounds
    if (ind.beginning >= 0 && ind.beginning < startOfTime) {
      startOfTime = ind.beginning;
    }
    if (ind.ending < Model.END_OF_TIME && ind.ending > endOfTime) {
      endOfTime = ind.ending;
    }

    // For installation references, also check their installation periods
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

  // Ensure we have a valid duration (at least 1)
  if (endOfTime <= startOfTime) {
    endOfTime = startOfTime + 10;
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

    // Determine chevron visibility
    let showLeftChevron: boolean;
    let showRightChevron: boolean;

    if (isVirtualRow(i)) {
      // Virtual rows (SystemComponent or InstalledComponent installations):
      // - Left chevron: only if beginning is 0
      // - Right chevron: only if ending is END_OF_TIME (no defined end)
      showLeftChevron = effectiveBeginning === 0;
      showRightChevron = effectiveEnding >= Model.END_OF_TIME;
    } else {
      // Regular individuals:
      // - Left chevron: not if beginsWithParticipant is true, otherwise based on time range
      // - Right chevron: not if endsWithParticipant is true, otherwise based on time range
      const startsBeforeRange = effectiveBeginning < startOfTime;
      const endsAfterRange = effectiveEnding > endOfTime;

      showLeftChevron = startsBeforeRange && !i.beginsWithParticipant;
      showRightChevron = endsAfterRange && !i.endsWithParticipant;
    }

    const start = effectiveBeginning >= startOfTime;
    const stop = effectiveEnding <= endOfTime;

    let x: number;
    if (start) {
      x = lhs_x + timeInterval * (effectiveBeginning - startOfTime);
    } else {
      x = config.layout.individual.xMargin - (showLeftChevron ? chevOff : 0);
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

    layout.set(i.id, {
      x,
      y,
      w,
      h,
      start,
      stop,
      nestingLevel,
      showLeftChevron,
      showRightChevron,
    });
  }

  svgElement
    .selectAll(".individual")
    .data(individuals.values())
    .join("path")
    .attr("class", "individual")
    .attr("id", (d: Individual) => "i" + d["id"])
    .attr("d", (i: Individual) => {
      const { x, y, w, h, showLeftChevron, showRightChevron } = layout.get(
        i.id
      )!;

      // Right side: chevron or flat
      const rightSide = showRightChevron
        ? `l ${chevOff} ${h / 2} ${-chevOff} ${h / 2}`
        : `l 0 ${h}`;

      // Left side: chevron or flat
      const leftSide = showLeftChevron
        ? `l ${chevOff} ${-h / 2} ${-chevOff} ${-h / 2}`
        : `l 0 ${-h}`;

      return `M ${x} ${y} l ${w} 0` + rightSide + `l ${-w} 0` + leftSide + "Z";
    })
    .attr("stroke", config.presentation.individual.stroke)
    .attr("stroke-width", config.presentation.individual.strokeWidth)
    .attr("fill", (d: Individual) => {
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
    } else if (originalType === EntityType.InstalledComponent) {
      tip = "<strong>Installed Component</strong>";
      tip += "<br/><em>(Installation instance)</em>";
    }
  } else {
    const entityType = individual.entityType ?? EntityType.Individual;
    switch (entityType) {
      case EntityType.System:
        tip = "<strong>System</strong>";
        break;
      case EntityType.SystemComponent:
        tip = "<strong>System Component</strong>";
        break;
      case EntityType.InstalledComponent:
        tip = "<strong>Installed Component</strong>";
        break;
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

    // Attach click handlers to the individual shape
    svgElement
      .select("#i" + CSS.escape(i.id))
      .on("click", lclick)
      .on("contextmenu", rclick);

    // Attach click handlers to the primary label
    svgElement
      .select("#il" + CSS.escape(i.id))
      .on("click", lclick)
      .on("contextmenu", rclick);

    // Also attach to wrapped label lines (for nested items with multi-line labels)
    svgElement
      .selectAll(`[id^="il${CSS.escape(i.id)}_"]`)
      .on("click", lclick)
      .on("contextmenu", rclick);

    // Attach to icon as well
    svgElement
      .select("#ii" + CSS.escape(i.id))
      .on("click", lclick)
      .on("contextmenu", rclick);
  });
}

// Labels all aligned to the left (no indent), icons show the type
export function labelIndividuals(ctx: DrawContext) {
  const { config, svgElement, individuals, dataset, activities } = ctx;

  if (config.labels.individual.enabled === false) {
    return;
  }

  let labels: Label[] = [];

  // Update the indent calculation for deeper nesting
  const INDENT_PER_LEVEL = 14; // pixels per nesting level
  const MAX_CHARS_PER_LINE_NESTED = 16; // Wrap nested labels after this many chars
  const CHAR_WIDTH_ESTIMATE = 6; // Approximate width per character in pixels
  const MIN_CHARS = 6; // Minimum characters to show before truncating

  // Parse the base font size from config (handles formats like "0.8em", "12px", "12")
  const parseConfigFontSize = (
    fontSize: string
  ): { value: number; unit: string } => {
    const match = fontSize.match(/^([\d.]+)(em|px|rem|pt)?$/i);
    if (match) {
      return {
        value: parseFloat(match[1]),
        unit: match[2]?.toLowerCase() || "px",
      };
    }
    // Fallback for unrecognized formats
    return { value: 12, unit: "px" };
  };

  const baseFontConfig = parseConfigFontSize(config.labels.individual.fontSize);

  // Nested elements use 75% of the base font size
  const NESTED_FONT_SCALE = 0.75;

  // Helper to get font size based on nesting level (derived from config)
  const getFontSize = (ind: Individual): string => {
    const nestingLevel = ind._nestingLevel ?? getNestingLevel(ind);
    if (nestingLevel > 0) {
      // For nested entities, use scaled-down version of config font size
      const nestedValue = baseFontConfig.value * NESTED_FONT_SCALE;
      return `${nestedValue}${baseFontConfig.unit}`;
    }
    return config.labels.individual.fontSize;
  };

  // Helper to get numeric font size in pixels for calculations
  const getNumericFontSize = (ind: Individual): number => {
    const nestingLevel = ind._nestingLevel ?? getNestingLevel(ind);

    // Convert config font size to approximate pixel value for calculations
    let basePx: number;
    switch (baseFontConfig.unit) {
      case "em":
      case "rem":
        // Assume 1em ≈ 16px (browser default)
        basePx = baseFontConfig.value * 16;
        break;
      case "pt":
        // 1pt ≈ 1.333px
        basePx = baseFontConfig.value * 1.333;
        break;
      case "px":
      default:
        basePx = baseFontConfig.value;
        break;
    }

    if (nestingLevel > 0) {
      return basePx * NESTED_FONT_SCALE;
    }
    return basePx;
  };

  // Calculate time range (same as in drawIndividuals)
  let startOfTime = Math.min(...activities.map((a) => a.beginning));
  let endOfTime = Math.max(...activities.map((a) => a.ending));

  if (activities.length === 0 || !isFinite(startOfTime)) {
    startOfTime = 0;
  }
  if (activities.length === 0 || !isFinite(endOfTime)) {
    endOfTime = 10;
  }

  // Expand time range to include all individuals
  for (const ind of individuals) {
    if (ind.beginning >= 0 && ind.beginning < startOfTime) {
      startOfTime = ind.beginning;
    }
    if (ind.ending < Model.END_OF_TIME && ind.ending > endOfTime) {
      endOfTime = ind.ending;
    }
  }

  if (endOfTime <= startOfTime) {
    endOfTime = startOfTime + 10;
  }

  // Calculate layout parameters (same as in drawIndividuals)
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

  // Helper to find the earliest activity start position for an individual
  const getEarliestActivityX = (ind: Individual): number | null => {
    // Find all activities that this individual participates in
    const participatingActivities: Activity[] = [];

    activities.forEach((activity) => {
      if (activity.participations) {
        // Check if this individual (or its virtual row ID) is a participant
        if (activity.participations.has(ind.id)) {
          participatingActivities.push(activity);
        }
      }
    });

    if (participatingActivities.length === 0) {
      return null; // No activities, label can use full space
    }

    // Find the earliest beginning time among participating activities
    const earliestBeginning = Math.min(
      ...participatingActivities.map((a) => a.beginning)
    );

    // Convert to X position
    const activityX = lhs_x + timeInterval * (earliestBeginning - startOfTime);
    return activityX;
  };

  // Helper to wrap text into multiple lines (handles long words without spaces)
  const wrapText = (text: string, maxCharsPerLine: number): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      // If the word itself is longer than maxCharsPerLine, break it into chunks
      if (word.length > maxCharsPerLine) {
        // First, push any existing current line
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = "";
        }

        // Break the long word into chunks
        let remaining = word;
        while (remaining.length > 0) {
          if (remaining.length <= maxCharsPerLine) {
            // Last chunk - either start new line or add to current
            if (currentLine.length === 0) {
              currentLine = remaining;
            } else if (
              currentLine.length + 1 + remaining.length <=
              maxCharsPerLine
            ) {
              currentLine += " " + remaining;
            } else {
              lines.push(currentLine);
              currentLine = remaining;
            }
            remaining = "";
          } else {
            // Take a chunk and add to lines
            const chunk = remaining.substring(0, maxCharsPerLine - 1) + "-";
            lines.push(chunk);
            remaining = remaining.substring(maxCharsPerLine - 1);
          }
        }
      } else if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    // Limit to max 2 lines to fit within row height, truncate last line if needed
    if (lines.length > 2) {
      lines.length = 2;
      const lastLine = lines[1];
      if (lastLine.length > maxCharsPerLine - 3) {
        lines[1] = lastLine.substring(0, maxCharsPerLine - 3) + "...";
      } else {
        lines[1] = lastLine + "...";
      }
    }

    return lines;
  };

  // Remove existing labels and icons
  svgElement.selectAll(".individualIcon").remove();
  svgElement.selectAll(".individualLabel").remove();

  // Draw icons with indentation to show hierarchy
  individuals.forEach((ind, idx) => {
    const nestingLevel = ind._nestingLevel ?? getNestingLevel(ind);
    const indent = nestingLevel * INDENT_PER_LEVEL;
    const fontSize = getFontSize(ind);

    const iconX =
      config.layout.individual.xMargin +
      config.labels.individual.leftMargin +
      indent;

    const baseY =
      config.layout.individual.topMargin +
      config.layout.individual.gap +
      config.layout.individual.height / 2 +
      config.labels.individual.topMargin +
      idx * (config.layout.individual.height + config.layout.individual.gap);

    // Draw icon
    svgElement
      .append("text")
      .attr("class", "individualIcon")
      .attr("id", `ii${ind.id}`)
      .attr("x", iconX)
      .attr("y", baseY)
      .attr("text-anchor", "start")
      .attr("font-family", "Arial, sans-serif")
      .attr("font-size", fontSize)
      .attr("fill", "#374151")
      .text(getEntityIcon(ind, dataset));

    // Draw label(s)
    const labelX = iconX + 14;
    const label = ind.name ?? "";

    if (nestingLevel === 0) {
      // Top-level: calculate available space based on activity positions
      const earliestActivityX = getEarliestActivityX(ind);

      let displayLabel = label;

      if (earliestActivityX !== null) {
        // There's an activity - calculate available space
        const availableWidth = earliestActivityX - labelX - 10; // 10px padding before activity
        const maxChars = Math.max(
          MIN_CHARS,
          Math.floor(availableWidth / CHAR_WIDTH_ESTIMATE)
        );

        if (label.length > maxChars) {
          displayLabel = label.substring(0, maxChars - 3) + "...";
        }
      }
      // If no activity, show full label (no truncation needed)

      svgElement
        .append("text")
        .attr("class", "individualLabel")
        .attr("id", `il${ind.id}`)
        .attr("x", labelX)
        .attr("y", baseY)
        .attr("text-anchor", "start")
        .attr("font-family", "Roboto, Arial, sans-serif")
        .attr("font-size", fontSize)
        .attr("fill", "#111827")
        .text(displayLabel);
    } else {
      // Nested: wrap text to multiple lines
      const lines = wrapText(label, MAX_CHARS_PER_LINE_NESTED);
      const numericFontSize = getNumericFontSize(ind);
      const lineHeight = numericFontSize * 1.2;
      const totalHeight = lines.length * lineHeight;

      // Center the text block vertically within the row
      const startY = baseY - (totalHeight - lineHeight) / 2;

      lines.forEach((line, lineIdx) => {
        svgElement
          .append("text")
          .attr("class", "individualLabel")
          .attr("id", lineIdx === 0 ? `il${ind.id}` : `il${ind.id}_${lineIdx}`)
          .attr("x", labelX)
          .attr("y", startY + lineIdx * lineHeight)
          .attr("text-anchor", "start")
          .attr("font-family", "Roboto, Arial, sans-serif")
          .attr("font-size", fontSize)
          .attr("fill", "#111827")
          .text(line);
      });
    }
  });
}
