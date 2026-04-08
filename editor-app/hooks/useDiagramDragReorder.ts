import { useEffect, MutableRefObject } from "react";
import { ConfigData } from "@/diagram/config";
import { Model } from "@/lib/Model";
import { Activity, Individual } from "@/lib/Schema";
import { ENTITY_TYPE_IDS, getEntityTypeIdFromIndividual } from "@/lib/entityTypes";
import { getActiveInstallationForActivity, splitParticipationByInstallations } from "@/utils/installations";
import * as d3 from "d3";

export type PlotDimensions = {
  width: number;
  height: number;
};

export function useDiagramDragReorder(
  svgRef: MutableRefObject<SVGSVGElement | null>,
  plot: PlotDimensions,
  dataset: Model,
  configData: ConfigData,
  interactionMode: "pointer" | "zoom",
  onReorderIndividuals: ((orderedIds: string[]) => void) | undefined,
) {
  useEffect(() => {
    if (!svgRef.current || !onReorderIndividuals || interactionMode !== "pointer") {
      return;
    }

    const svg = d3.select(svgRef.current);
    const rowSelection = svg.selectAll<SVGPathElement, Individual>(".individual");
    const tooltipSelection = d3.select("#tooltip");

    if (rowSelection.empty()) return;

    const updateTooltipDuringDrag = (sourceEvent: any) => {
      if (tooltipSelection.empty()) {
        return;
      }

      if (tooltipSelection.style("display") === "none") {
        return;
      }

      const pointerEvent = sourceEvent as MouseEvent | undefined;
      if (!pointerEvent || pointerEvent.pageX == null || pointerEvent.pageY == null) {
        return;
      }

      if (pointerEvent.pageX < window.innerWidth / 2) {
        tooltipSelection
          .style("top", pointerEvent.pageY + 20 + "px")
          .style("left", pointerEvent.pageX + "px");
      } else {
        const ttNode = tooltipSelection.node() as HTMLElement | null;
        const ttWidth = ttNode?.getBoundingClientRect().width ?? 0;
        tooltipSelection
          .style("top", pointerEvent.pageY + 20 + "px")
          .style("left", pointerEvent.pageX - ttWidth + "px");
      }
    };

    // ── Helpers for system grouping ──
    const isNestedComponent = (ind: Individual | undefined): boolean => {
      if (!ind) return false;
      if (getEntityTypeIdFromIndividual(ind) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) return false;
      if (!ind.installedIn) return false;
      const host = dataset.individuals.get(ind.installedIn);
      return !!host && getEntityTypeIdFromIndividual(host) === ENTITY_TYPE_IDS.SYSTEM;
    };

    const getComponentIdsForSystem = (systemId: string): string[] => {
      return Array.from(dataset.individuals.values())
        .filter(
          (ind) =>
            ind.installedIn === systemId &&
            getEntityTypeIdFromIndividual(ind) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT
        )
        .map((ind) => ind.id);
    };

    const canReorderIndividuals = (
      activeItem: Individual | undefined,
      overItem: Individual | undefined
    ) => {
      if (!activeItem || !overItem) return false;

      const activeType = getEntityTypeIdFromIndividual(activeItem);
      if (activeType !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        return true;
      }

      const overType = getEntityTypeIdFromIndividual(overItem);
      if (overType === ENTITY_TYPE_IDS.SYSTEM) {
        return !!activeItem.installedIn && activeItem.installedIn === overItem.id;
      }

      if (overType !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        return false;
      }

      return (
        !!activeItem.installedIn && activeItem.installedIn === overItem.installedIn
      );
    };

    const getClosestTargetRow = (
      rows: Array<{ id: string; centerY: number; node: SVGPathElement }>,
      draggedId: string,
      draggedCenter: number
    ) => {
      let closestRow: { id: string; centerY: number; node: SVGPathElement } | null =
        null;
      let closestDist = Infinity;

      for (const row of rows) {
        if (row.id === draggedId) continue;
        const dist = Math.abs(draggedCenter - row.centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closestRow = row;
        }
      }

      return closestRow;
    };

    const updateLinkedLabel = (entityId: string, offset: number) => {
      svg.select(`#il${entityId}`).attr("transform", `translate(0, ${offset})`);
    };

    const updateLinkedHatches = (entityId: string, offset: number) => {
      const t = offset === 0 ? null : `translate(0, ${offset})`;
      // Hatches are drawn ON the target component, so only move them
      // when the target component moves (not when the installed individual moves).
      // The hatches use clip-path with userSpaceOnUse, which doesn't follow
      // the element's transform, so we temporarily remove clip-path during drag
      // and restore it when the transform is cleared.
      svg
        .selectAll<SVGRectElement, unknown>(".installHatch")
        .filter(function () {
          return (this as SVGElement).getAttribute("data-target-id") === entityId;
        })
        .each(function () {
          const el = this as SVGElement;
          if (offset !== 0) {
            const cp = el.getAttribute("clip-path");
            if (cp) el.setAttribute("data-saved-clip", cp);
            el.removeAttribute("clip-path");
          } else {
            const saved = el.getAttribute("data-saved-clip");
            if (saved) {
              el.setAttribute("clip-path", saved);
              el.removeAttribute("data-saved-clip");
            }
          }
        })
        .attr("transform", t);
    };

    /** Read the current Y translate offset from an element's transform attribute */
    const getElementOffset = (id: string): number => {
      const el = svg.select(`#i${id}`).node() as SVGElement | null;
      if (!el) return 0;
      const t = el.getAttribute("transform");
      if (!t) return 0;
      const m = t.match(/translate\(\s*[\d.eE+-]+\s*,\s*([\d.eE+-]+)\s*\)/);
      return m ? Number(m[1]) : 0;
    };

    const updateLinkedRibbons = (entityId: string, offset: number) => {
      svg
        .selectAll<SVGPathElement, unknown>(".installConnectorRibbon")
        .filter(function () {
          const node = this as SVGElement;
          const installedId = node.getAttribute("data-installed-id");
          const targetId = node.getAttribute("data-target-id");
          return installedId === entityId || targetId === entityId;
        })
        .attr("d", function () {
          const node = this as SVGElement;
          const installedId = node.getAttribute("data-installed-id");
          const targetId = node.getAttribute("data-target-id");
          const kind = node.getAttribute("data-ribbon-kind");

          const mainX = Number(node.getAttribute("data-main-x") ?? "0");
          const sideX = Number(node.getAttribute("data-side-x") ?? "0");
          const lowerTopBase = Number(node.getAttribute("data-lower-top") ?? "0");
          const lowerBottomBase = Number(node.getAttribute("data-lower-bottom") ?? "0");
          const upperTopBase = Number(node.getAttribute("data-upper-top") ?? "0");
          const upperBottomBase = Number(node.getAttribute("data-upper-bottom") ?? "0");

          // For the endpoint being explicitly moved, use the passed offset.
          // For the OTHER endpoint, read its current transform from the DOM.
          const lowerShift = installedId === entityId ? offset : getElementOffset(installedId!);
          const upperShift = targetId === entityId ? offset : getElementOffset(targetId!);
          const lowerTop = lowerTopBase + lowerShift;
          const lowerBottom = lowerBottomBase + lowerShift;
          const upperTop = upperTopBase + upperShift;
          const upperBottom = upperBottomBase + upperShift;

          if (kind === "start") {
            return `M ${sideX} ${lowerTop}
L ${sideX} ${lowerBottom}
L ${mainX} ${upperBottom}
L ${mainX} ${upperTop} Z`;
          }

          return `M ${mainX} ${upperTop}
L ${mainX} ${upperBottom}
L ${sideX} ${lowerBottom}
L ${sideX} ${lowerTop} Z`;
        });
    };

    const updateLinkedParticipationRibbons = (entityId: string, offset: number) => {
      svg
        .selectAll<SVGPathElement, unknown>(".participationRibbon, .participationRibbonEdge")
        .filter(function () {
          const node = this as SVGElement;
          const upperRowId = node.getAttribute("data-upper-row-id");
          const lowerRowId = node.getAttribute("data-lower-row-id");
          return upperRowId === entityId || lowerRowId === entityId;
        })
        .attr("d", function () {
          const node = this as SVGElement;
          const upperRowId = node.getAttribute("data-upper-row-id");
          const lowerRowId = node.getAttribute("data-lower-row-id");
          if (!upperRowId || !lowerRowId) {
            return node.getAttribute("d") ?? "";
          }

          const xUpper = Number(node.getAttribute("data-x-upper") ?? "0");
          const xLower = Number(node.getAttribute("data-x-lower") ?? "0");
          const upperTopBase = Number(node.getAttribute("data-upper-top") ?? "0");
          const upperBottomBase = Number(node.getAttribute("data-upper-bottom") ?? "0");
          const lowerTopBase = Number(node.getAttribute("data-lower-top") ?? "0");
          const lowerBottomBase = Number(node.getAttribute("data-lower-bottom") ?? "0");
          const direction = node.getAttribute("data-ribbon-direction");

          const upperShift = upperRowId === entityId ? offset : getElementOffset(upperRowId);
          const lowerShift = lowerRowId === entityId ? offset : getElementOffset(lowerRowId);
          const upperTop = upperTopBase + upperShift;
          const upperBottom = upperBottomBase + upperShift;
          const lowerTop = lowerTopBase + lowerShift;
          const lowerBottom = lowerBottomBase + lowerShift;

          if (direction === "upper-to-lower") {
            if (node.classList.contains("participationRibbonEdge")) {
              return `M ${xUpper} ${upperTop} L ${xLower} ${lowerTop} M ${xUpper} ${upperBottom} L ${xLower} ${lowerBottom}`;
            }
            return `M ${xUpper} ${upperTop} L ${xUpper} ${upperBottom} L ${xLower} ${lowerBottom} L ${xLower} ${lowerTop} Z`;
          }

          if (node.classList.contains("participationRibbonEdge")) {
            return `M ${xUpper} ${upperTop} L ${xLower} ${lowerTop} M ${xUpper} ${upperBottom} L ${xLower} ${lowerBottom}`;
          }
          return `M ${xLower} ${lowerTop} L ${xLower} ${lowerBottom} L ${xUpper} ${upperBottom} L ${xUpper} ${upperTop} Z`;
        });
    };

    const updateLinkedParticipations = (entityId: string, offset: number) => {
      const t = offset === 0 ? null : `translate(0, ${offset})`;
      svg
        .selectAll<SVGRectElement, unknown>(".participation")
        .filter(function () {
          return (this as SVGElement).getAttribute("data-row-id") === entityId;
        })
        .attr("transform", t);
    };

    interface ActivityBoundsSnapshot {
      y: number;
      height: number;
    }

    let activityBoundsSnapshot = new Map<string, ActivityBoundsSnapshot>();

    const snapshotActivityBounds = () => {
      activityBoundsSnapshot = new Map();
      svg.selectAll<SVGRectElement, unknown>(".activity").each(function () {
        const activityNode = this as SVGRectElement;
        activityBoundsSnapshot.set(activityNode.id.substring(1), {
          y: Number(activityNode.getAttribute("y") ?? "0"),
          height: Number(activityNode.getAttribute("height") ?? "0"),
        });
      });
    };

    const restoreActivityBounds = () => {
      svg.selectAll<SVGRectElement, unknown>(".activity").each(function () {
        const activityNode = this as SVGRectElement;
        const baseBounds = activityBoundsSnapshot.get(activityNode.id.substring(1));
        if (!baseBounds) return;

        d3.select(activityNode)
          .attr("y", baseBounds.y)
          .attr("height", baseBounds.height);
      });
    };

    const resolvePreviewActivityRowIds = (
      activity: Activity,
      individual: Individual,
      participationKey?: string
    ): string[] => {
      const segments = splitParticipationByInstallations(individual, activity, participationKey);
      const rowIds = new Set<string>();

      for (const segment of segments) {
        if (!segment.installationPeriod) {
          rowIds.add(individual.id);
          continue;
        }

        const componentId = segment.installationPeriod.systemComponentId;
        const installedTarget = dataset.individuals.get(componentId);
        const isInstalledInComponent =
          !!installedTarget &&
          getEntityTypeIdFromIndividual(installedTarget) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT;

        if (!isInstalledInComponent) {
          rowIds.add(individual.id);
          continue;
        }

        const installedSystem = installedTarget.installedIn
          ? dataset.individuals.get(installedTarget.installedIn)
          : undefined;
        const isInstalledInSystem =
          !!installedSystem &&
          getEntityTypeIdFromIndividual(installedSystem) === ENTITY_TYPE_IDS.SYSTEM;

        rowIds.add(isInstalledInSystem ? installedSystem.id : installedTarget.id);
      }

      return Array.from(rowIds);
    };

    const getPreviewRowBounds = (rowId: string) => {
      const rowNode = svg.select(`#i${rowId}`).node() as SVGGraphicsElement | null;
      if (!rowNode) {
        return null;
      }

      const bbox = rowNode.getBBox();
      const rowYAttr = Number(rowNode.getAttribute("data-row-y") ?? "NaN");
      const baseTop = Number.isFinite(rowYAttr) ? rowYAttr : bbox.y;
      const offset = entityOffsets.get(rowId) ?? getElementOffset(rowId);

      return {
        top: baseTop + offset,
        bottom: baseTop + offset + bbox.height,
      };
    };

    const updateLinkedActivities = () => {
      svg.selectAll<SVGRectElement, unknown>(".activity").each(function () {
        const activityNode = this as SVGRectElement;
        const activityId = activityNode.id.substring(1); // remove 'a'
        const baseBounds = activityBoundsSnapshot.get(activityId) ?? {
          y: Number(activityNode.getAttribute("y") ?? "0"),
          height: Number(activityNode.getAttribute("height") ?? "0"),
        };
        const activity = dataset.activities.get(activityId);
        
        let minTop = Infinity;
        let maxBottom = -Infinity;
        
        activity?.participations?.forEach((participation, mapKey) => {
          const individual = dataset.individuals.get(participation.individualId);
          if (!individual) {
            return;
          }

          const rowIds = resolvePreviewActivityRowIds(activity, individual, mapKey);
          for (const rowId of rowIds) {
            const rowBounds = getPreviewRowBounds(rowId);
            if (!rowBounds) continue;
            if (rowBounds.top < minTop) minTop = rowBounds.top;
            if (rowBounds.bottom > maxBottom) maxBottom = rowBounds.bottom;
          }
        });
          
        if (minTop === Infinity || maxBottom === -Infinity) {
          d3.select(activityNode)
            .attr("y", baseBounds.y)
            .attr("height", baseBounds.height);
          return;
        }

        const gap = configData.layout.individual.gap;
        const previewTop = minTop - gap * 0.3;
        const previewBottom = maxBottom + gap * 0.3;

        d3.select(activityNode)
          .attr("y", previewTop)
          .attr("height", Math.max(0, previewBottom - previewTop));
      });
    };

    // ── Snapshot types ──
    // Top-level snapshot: systems are treated as groups (system + its components).
    // Nested system components are NOT separate entries in topLevelSnapshot;
    // they are tracked via componentIds on their parent system entry.
    interface RowSnapshot {
      id: string;
      y: number;
      height: number;          // full group height (for systems this includes components)
      node: SVGPathElement;
      componentIds: string[];  // child component IDs (non-empty only for systems)
      parentSystemId?: string; // set only for nested system components
    }
    let dragSnapshot: RowSnapshot[] = [];          // ALL rows (including nested components)
    let topLevelSnapshot: RowSnapshot[] = [];      // only top-level rows (systems as groups)
    let entityOffsets = new Map<string, number>();   // intended Y offset per entity (avoids reading mid-transition DOM)

    // ── Shift helpers ──
    const shiftElement = (id: string, dy: number, animate: boolean) => {
      entityOffsets.set(id, dy);
      const t = dy === 0 ? null : `translate(0, ${dy})`;
      if (animate) {
        svg.select(`#i${id}`).transition().duration(50).attr("transform", t);
        svg.select(`#il${id}`).transition().duration(50).attr("transform", t);
        svg
          .selectAll<SVGPathElement, unknown>(".installDash")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-individual-id") === id;
          })
          .transition()
          .duration(50)
          .attr("transform", t);
        svg
          .selectAll<SVGRectElement, unknown>(".participation")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-row-id") === id;
          })
          .transition()
          .duration(50)
          .attr("transform", t);
      } else {
        svg.select(`#i${id}`).attr("transform", t);
        svg.select(`#il${id}`).attr("transform", t);
        svg
          .selectAll<SVGPathElement, unknown>(".installDash")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-individual-id") === id;
          })
          .attr("transform", t);
        svg
          .selectAll<SVGRectElement, unknown>(".participation")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-row-id") === id;
          })
          .attr("transform", t);
      }
      updateLinkedHatches(id, dy);
      updateLinkedRibbons(id, dy);
      updateLinkedParticipationRibbons(id, dy);
      
      // We need to update activities after the transition starts, but for simplicity
      // we can just update them immediately. The transition might make it look slightly out of sync,
      // but it's better than not updating.
      updateLinkedActivities();
    };

    /** Shift a top-level row and, if it's a system, all its components */
    const shiftGroup = (snap: RowSnapshot, dy: number, animate = true) => {
      shiftElement(snap.id, dy, animate);
      snap.componentIds.forEach((cid) => shiftElement(cid, dy, animate));
    };

    const clearAllPreviewShifts = () => {
      // First pass: reset all element transforms
      dragSnapshot.forEach((snap) => {
        svg.select(`#i${snap.id}`).interrupt().attr("transform", null);
        svg.select(`#il${snap.id}`).interrupt().attr("transform", null);
        svg
          .selectAll<SVGPathElement, unknown>(".installDash")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-individual-id") === snap.id;
          })
          .interrupt()
          .attr("transform", null);
        svg
          .selectAll<SVGRectElement, unknown>(".participation")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-row-id") === snap.id;
          })
          .interrupt()
          .attr("transform", null);
        updateLinkedHatches(snap.id, 0);
      });
      // Second pass: reset all ribbon paths (after all transforms are cleared,
      // so getElementOffset returns 0 for all endpoints)
      dragSnapshot.forEach((snap) => {
        updateLinkedRibbons(snap.id, 0);
        updateLinkedParticipationRibbons(snap.id, 0);
      });
      // Third pass: clear offset tracking and restore activity bounds
      entityOffsets.clear();
      restoreActivityBounds();
    };

    // ── Auto-scroll during drag ──
    const scrollContainer = document.getElementById("activity-diagram-scrollable-div");
    const AUTO_SCROLL_EDGE = 40;   // px from edge to trigger
    const AUTO_SCROLL_SPEED = 8;   // px per frame
    let autoScrollRAF: number | null = null;

    const autoScrollDuringDrag = (clientY: number) => {
      if (autoScrollRAF) cancelAnimationFrame(autoScrollRAF);
      if (!scrollContainer) return;
      const rect = scrollContainer.getBoundingClientRect();
      const distFromTop = clientY - rect.top;
      const distFromBottom = rect.bottom - clientY;

      const step = () => {
        if (!scrollContainer) return;
        const r = scrollContainer.getBoundingClientRect();
        const dTop = clientY - r.top;
        const dBot = r.bottom - clientY;
        if (dTop < AUTO_SCROLL_EDGE && scrollContainer.scrollTop > 0) {
          scrollContainer.scrollTop -= AUTO_SCROLL_SPEED;
          autoScrollRAF = requestAnimationFrame(step);
        } else if (dBot < AUTO_SCROLL_EDGE && scrollContainer.scrollTop < scrollContainer.scrollHeight - scrollContainer.clientHeight) {
          scrollContainer.scrollTop += AUTO_SCROLL_SPEED;
          autoScrollRAF = requestAnimationFrame(step);
        } else {
          autoScrollRAF = null;
        }
      };

      if (distFromTop < AUTO_SCROLL_EDGE || distFromBottom < AUTO_SCROLL_EDGE) {
        autoScrollRAF = requestAnimationFrame(step);
      }
    };

    const stopAutoScroll = () => {
      if (autoScrollRAF) {
        cancelAnimationFrame(autoScrollRAF);
        autoScrollRAF = null;
      }
    };

    // ── Drag behavior ──

    // Helper: raise a single entity's bar, label, dashes, hatches, and ribbons
    const raiseEntityVisuals = (id: string) => {
      svg.select(`#i${id}`).raise();
      svg.select(`#il${id}`).raise();
      svg
        .selectAll<SVGPathElement, unknown>(".installDash")
        .filter(function () {
          return (this as SVGElement).getAttribute("data-individual-id") === id;
        })
        .raise();
      svg
        .selectAll<SVGRectElement, unknown>(".installHatch")
        .filter(function () {
          return (this as SVGElement).getAttribute("data-target-id") === id;
        })
        .raise();
      svg
        .selectAll<SVGPathElement, unknown>(".installConnectorRibbon")
        .filter(function () {
          const node = this as SVGElement;
          return node.getAttribute("data-installed-id") === id
            || node.getAttribute("data-target-id") === id;
        })
        .raise();
      // Raise activities, participations, and participation ribbons so they stay on top
      svg.selectAll(".activity").raise();
      svg.selectAll(".participationRibbon").raise();
      svg.selectAll(".participation").raise();
    };

    const DRAG_ACTIVATION_DISTANCE = 6;

    const getDragRowSelection = (
      node: SVGGraphicsElement,
      individualId: string
    ) => {
      const nodeId = node.getAttribute("id") ?? "";
      if (nodeId === `i${individualId}`) {
        return d3.select(node as SVGPathElement);
      }
      return svg.select<SVGPathElement>(`#i${individualId}`);
    };

    const dragBehavior = d3
      .drag<SVGGraphicsElement, Individual>()
      .clickDistance(4)
      .on("start", function (event, draggedIndividual) {
        const draggedSelection = getDragRowSelection(this, draggedIndividual.id);
        if (draggedSelection.empty()) return;

        updateTooltipDuringDrag(event.sourceEvent);

        snapshotActivityBounds();

        // Build full snapshot of every .individual element
        dragSnapshot = svg
          .selectAll<SVGPathElement, Individual>(".individual")
          .nodes()
          .map((node) => {
            const id = (node.getAttribute("id") ?? "").replace(/^i/, "");
            const y = Number(node.getAttribute("data-row-y") ?? "0");
            const bbox = node.getBBox();
            const ind = dataset.individuals.get(id);
            const cIds = ind && getEntityTypeIdFromIndividual(ind) === ENTITY_TYPE_IDS.SYSTEM
              ? getComponentIdsForSystem(id) : [];
            const parentSysId = ind && isNestedComponent(ind) ? ind.installedIn : undefined;
            return { id, y, height: bbox.height, node, componentIds: cIds, parentSystemId: parentSysId };
          })
          .filter((r) => r.id.length > 0)
          .sort((a, b) => a.y - b.y);

        // Build top-level snapshot (exclude nested system components)
        topLevelSnapshot = dragSnapshot.filter((r) => !r.parentSystemId);

        draggedSelection
          .attr("data-drag-offset", "0")
          .attr("data-total-drag", "0")
          .attr("data-was-dragged", "0")
          .attr("data-raised", "0")
          .style("cursor", "default");
      })
      .on("drag", function (event, draggedIndividual) {
        const draggedSelection = getDragRowSelection(this, draggedIndividual.id);
        if (draggedSelection.empty()) return;

        updateTooltipDuringDrag(event.sourceEvent);

        const accumulatedDrag =
          Number(draggedSelection.attr("data-total-drag") ?? "0") +
          Math.abs(event.dy);
        draggedSelection.attr("data-total-drag", String(accumulatedDrag));

        const dragActivated =
          draggedSelection.attr("data-was-dragged") === "1" ||
          accumulatedDrag >= DRAG_ACTIVATION_DISTANCE;
        if (!dragActivated) {
          return;
        }

        draggedSelection.attr("data-was-dragged", "1");

        const currentOffset = Number(draggedSelection.attr("data-drag-offset") ?? "0");
        const nextOffset = currentOffset + event.dy;
        const draggedType = getEntityTypeIdFromIndividual(draggedIndividual);
        const isSystem = draggedType === ENTITY_TYPE_IDS.SYSTEM;
        const isDraggedComponent = isNestedComponent(draggedIndividual);

        // Raise dragged element above everything on the first actual movement
        if (draggedSelection.attr("data-raised") === "0") {
          draggedSelection.attr("data-raised", "1");
          raiseEntityVisuals(draggedIndividual.id);
          if (isSystem) {
            const compIds = getComponentIdsForSystem(draggedIndividual.id);
            compIds.forEach((cid) => raiseEntityVisuals(cid));
          }
        }

        draggedSelection
          .attr("data-drag-offset", String(nextOffset))
          .attr("transform", `translate(0, ${nextOffset})`);

        // Auto-scroll when near the edges of the scroll container
        autoScrollDuringDrag(event.sourceEvent.clientY);

        updateLinkedLabel(draggedIndividual.id, nextOffset);
        svg
          .selectAll<SVGPathElement, unknown>(".installDash")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-individual-id") === draggedIndividual.id;
          })
          .attr("transform", `translate(0, ${nextOffset})`);
        updateLinkedHatches(draggedIndividual.id, nextOffset);
        updateLinkedRibbons(draggedIndividual.id, nextOffset);
        updateLinkedParticipations(draggedIndividual.id, nextOffset);
        updateLinkedParticipationRibbons(draggedIndividual.id, nextOffset);
        entityOffsets.set(draggedIndividual.id, nextOffset);

        // If dragging a system, also move its components
        if (isSystem) {
          const compIds = getComponentIdsForSystem(draggedIndividual.id);
          compIds.forEach((cid) => {
            entityOffsets.set(cid, nextOffset);
            svg.select(`#i${cid}`).attr("transform", `translate(0, ${nextOffset})`);
            updateLinkedLabel(cid, nextOffset);
            svg
              .selectAll<SVGPathElement, unknown>(".installDash")
              .filter(function () {
                return (this as SVGElement).getAttribute("data-individual-id") === cid;
              })
              .attr("transform", `translate(0, ${nextOffset})`);
            updateLinkedHatches(cid, nextOffset);
            updateLinkedRibbons(cid, nextOffset);
            updateLinkedParticipations(cid, nextOffset);
            updateLinkedParticipationRibbons(cid, nextOffset);
          });
        }
        
        updateLinkedActivities();

        // ── Choose working set based on what's being dragged ──
        if (isDraggedComponent) {
          // --- SYSTEM COMPONENT DRAG (within its parent system) ---
          const parentId = draggedIndividual.installedIn!;
          // Only consider sibling components for reorder
          const siblingSnaps = dragSnapshot
            .filter((r) => r.parentSystemId === parentId)
            .sort((a, b) => a.y - b.y);

          const draggedSnap = siblingSnaps.find((r) => r.id === draggedIndividual.id);
          if (!draggedSnap) return;

          const draggedCenter = draggedSnap.y + draggedSnap.height / 2 + nextOffset;
          const siblings = siblingSnaps.filter((r) => r.id !== draggedIndividual.id);

          // Check validity globally to show red indicator if dragged out of host
          const closestRow = getClosestTargetRow(
            dragSnapshot.map((s) => ({
              id: s.id,
              centerY: s.y + s.height / 2,
              node: s.node,
            })),
            draggedIndividual.id,
            draggedCenter
          );

          let isValidTarget = true;
          if (closestRow) {
            const overIndividual = dataset.individuals.get(closestRow.id);
            isValidTarget = canReorderIndividuals(draggedIndividual, overIndividual);
          }

          svg
            .selectAll(".individual")
            .classed("drop-target-valid", false)
            .classed("drop-target-invalid", false);

          if (closestRow && !isValidTarget) {
            d3.select(closestRow.node).classed("drop-target-invalid", true);
            
            // If dragging outside the parent system, don't displace siblings
            siblings.forEach((snap) => shiftElement(snap.id, 0, true));
            return;
          }

          let insertIdx = siblings.length;
          for (let i = 0; i < siblings.length; i++) {
            if (draggedCenter < siblings[i].y + siblings[i].height / 2) {
              insertIdx = i;
              break;
            }
          }

          const origIdx = siblingSnaps.indexOf(draggedSnap);

          const draggedHeight = draggedSnap.height + (configData.layout.system?.componentGap ?? 4);

          siblings.forEach((snap, i) => {
            const origOtherIdx = siblingSnaps.indexOf(snap);
            let dy = 0;
            if (origOtherIdx < origIdx && i >= insertIdx) {
              dy = draggedHeight;
            } else if (origOtherIdx > origIdx && i < insertIdx) {
              dy = -draggedHeight;
            }
            shiftElement(snap.id, dy, true);
          });
        } else {
          // --- TOP-LEVEL DRAG (system or regular individual) ---
          const draggedSnap = topLevelSnapshot.find((r) => r.id === draggedIndividual.id);
          if (!draggedSnap) return;

          const draggedTop = draggedSnap.y + nextOffset;
          const draggedBottom = draggedTop + draggedSnap.height;
          const movingDown = nextOffset >= 0;
          const targetProbeY = movingDown ? draggedBottom : draggedTop;
          const others = topLevelSnapshot.filter((r) => r.id !== draggedIndividual.id);

          const insertIdxCandidate = others.findIndex(
            (row) => targetProbeY < row.y + row.height / 2
          );
          const insertIdx = insertIdxCandidate < 0 ? others.length : insertIdxCandidate;

          // Check validity
          const closestRow = getClosestTargetRow(
            topLevelSnapshot.map((s) => ({
              id: s.id,
              centerY: s.y + s.height / 2,
              node: s.node,
            })),
            draggedIndividual.id,
            targetProbeY
          );

          let isValidTarget = true;
          if (closestRow) {
            const overIndividual = dataset.individuals.get(closestRow.id);
            isValidTarget = canReorderIndividuals(draggedIndividual, overIndividual);
          }

          svg
            .selectAll(".individual")
            .classed("drop-target-valid", false)
            .classed("drop-target-invalid", false);
            
          if (closestRow && !isValidTarget) {
            d3.select(closestRow.node).classed("drop-target-invalid", true);
          }

          const origIdx = topLevelSnapshot.indexOf(draggedSnap);

          if (!isValidTarget) {
            others.forEach((snap) => shiftGroup(snap, 0));
            return;
          }

          // draggedHeight includes the full group height + gap
          const draggedHeight = draggedSnap.height + configData.layout.individual.gap;

          others.forEach((snap, i) => {
            const origOtherIdx = topLevelSnapshot.indexOf(snap);
            let dy = 0;
            if (origOtherIdx < origIdx && i >= insertIdx) {
              dy = draggedHeight;
            } else if (origOtherIdx > origIdx && i < insertIdx) {
              dy = -draggedHeight;
            }
            shiftGroup(snap, dy);
          });
        }
      })
      .on("end", function (_event, draggedIndividual) {
        // Stop auto-scroll
        stopAutoScroll();

        // Clean up all preview transforms
        clearAllPreviewShifts();

        // Clean up drop target visuals
        svg
          .selectAll(".individual")
          .classed("drop-target-valid", false)
          .classed("drop-target-invalid", false);

        const draggedSelection = getDragRowSelection(this, draggedIndividual.id);
        if (draggedSelection.empty()) return;
        const wasDragged = draggedSelection.attr("data-was-dragged") === "1";
        const dragOffset = Number(draggedSelection.attr("data-drag-offset") ?? "0");

        const draggedType = getEntityTypeIdFromIndividual(draggedIndividual);
        const isSystem = draggedType === ENTITY_TYPE_IDS.SYSTEM;
        const isDraggedComponent = isNestedComponent(draggedIndividual);

        // Reset transforms on dragged element (and its components if system)
        draggedSelection
          .attr("transform", null)
          .attr("data-drag-offset", null)
          .attr("data-total-drag", null)
          .attr("data-was-dragged", null)
          .attr("data-raised", null)
          .style("cursor", "default");

        svg.select(`#il${draggedIndividual.id}`).attr("transform", null);
        svg
          .selectAll<SVGPathElement, unknown>(".installDash")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-individual-id") === draggedIndividual.id;
          })
          .attr("transform", null);
        updateLinkedHatches(draggedIndividual.id, 0);
        updateLinkedRibbons(draggedIndividual.id, 0);

        if (isSystem) {
          const compIds = getComponentIdsForSystem(draggedIndividual.id);
          compIds.forEach((cid) => {
            svg.select(`#i${cid}`).attr("transform", null);
            svg.select(`#il${cid}`).attr("transform", null);
            updateLinkedHatches(cid, 0);
            updateLinkedRibbons(cid, 0);
          });
        }

        const savedTopLevel = [...topLevelSnapshot];
        const savedFull = [...dragSnapshot];
        dragSnapshot = [];
        topLevelSnapshot = [];
        activityBoundsSnapshot.clear();
        entityOffsets.clear();

        if (!wasDragged) return;

        if (isDraggedComponent) {
          // ── Component reorder within its system ──
          const parentId = draggedIndividual.installedIn!;
          const siblingSnaps = savedFull
            .filter((r) => r.parentSystemId === parentId)
            .sort((a, b) => a.y - b.y);

          const draggedSnap = siblingSnaps.find((r) => r.id === draggedIndividual.id);
          if (!draggedSnap) return;

          const draggedCenter = draggedSnap.y + draggedSnap.height / 2 + dragOffset;
          const otherSiblings = siblingSnaps.filter((r) => r.id !== draggedIndividual.id);
          const insertionIndex = otherSiblings.findIndex(
            (r) => draggedCenter < r.y + r.height / 2
          );
          const nextSiblings = [...otherSiblings];
          if (insertionIndex < 0) {
            nextSiblings.push(draggedSnap);
          } else {
            nextSiblings.splice(insertionIndex, 0, draggedSnap);
          }

          // Build full ID list: go through savedFull in order, replacing
          // sibling component order with the new order
          const newComponentOrder = nextSiblings.map((s) => s.id);
          const topRows = savedTopLevel.map((s) => s.id);
          // For the parent system, swap in the new component order
          const fullIds: string[] = [];
          topRows.forEach((id) => {
            fullIds.push(id);
            if (id === parentId) {
              newComponentOrder.forEach((cid) => fullIds.push(cid));
            } else {
              const snap = savedTopLevel.find((s) => s.id === id);
              if (snap) snap.componentIds.forEach((cid) => fullIds.push(cid));
            }
          });

          onReorderIndividuals(fullIds);
        } else {
          // ── Top-level reorder ──
          const topRows = [...savedTopLevel].sort((a, b) => a.y - b.y);
          const draggedRow = topRows.find((row) => row.id === draggedIndividual.id);
          if (!draggedRow) return;

          const draggedTop = draggedRow.y + dragOffset;
          const draggedBottom = draggedTop + draggedRow.height;
          const movingDown = dragOffset >= 0;
          const targetProbeY = movingDown ? draggedBottom : draggedTop;

          const closestRow = getClosestTargetRow(
            topRows.map((row) => ({
              id: row.id,
              centerY: row.y + row.height / 2,
              node: row.node,
            })),
            draggedIndividual.id,
            targetProbeY
          );
          const overIndividual = closestRow
            ? dataset.individuals.get(closestRow.id)
            : undefined;
          if (!canReorderIndividuals(draggedIndividual, overIndividual)) {
            return;
          }

          const otherRows = topRows.filter((row) => row.id !== draggedIndividual.id);
          const insertionIndex = otherRows.findIndex(
            (row) => targetProbeY < row.y + row.height / 2
          );
          const nextRows = [...otherRows];
          if (insertionIndex < 0) {
            nextRows.push(draggedRow);
          } else {
            nextRows.splice(insertionIndex, 0, draggedRow);
          }

          // Emit full list including components after their parent systems
          const fullIds: string[] = [];
          nextRows.forEach((row) => {
            fullIds.push(row.id);
            const snap = savedTopLevel.find((s) => s.id === row.id);
            if (snap) snap.componentIds.forEach((cid) => fullIds.push(cid));
          });

          onReorderIndividuals(fullIds);
        }
      });

    svg
      .selectAll<SVGGraphicsElement, Individual>(".individual, .individualLabel")
      .style("cursor", "default")
      .call(dragBehavior as any);

    return () => {
      svg
        .selectAll(".individual, .individualLabel")
        .on(".drag", null)
        .interrupt()
        .style("cursor", null)
        .classed("drop-target-valid", false)
        .classed("drop-target-invalid", false);
      svg.selectAll(".individual").attr("transform", null);
      svg.selectAll(".individualLabel").interrupt().attr("transform", null);
      svg.selectAll(".installDash").interrupt().attr("transform", null);
      svg.selectAll(".installHatch").interrupt().attr("transform", null)
        .each(function () {
          const el = this as SVGElement;
          const saved = el.getAttribute("data-saved-clip");
          if (saved) {
            el.setAttribute("clip-path", saved);
            el.removeAttribute("data-saved-clip");
          }
        });
      dragSnapshot = [];
      topLevelSnapshot = [];
      activityBoundsSnapshot.clear();
      entityOffsets.clear();
      stopAutoScroll();
    };
  }, [plot, svgRef, interactionMode, onReorderIndividuals, dataset]);
}