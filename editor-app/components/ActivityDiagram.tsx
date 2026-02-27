import { useState, useEffect, useRef, MutableRefObject, JSX, Dispatch, SetStateAction } from "react";
import Breadcrumb from "react-bootstrap/Breadcrumb";
import Button from "react-bootstrap/Button";
import { drawActivityDiagram } from "@/diagram/DrawActivityDiagram";
import { ConfigData } from "@/diagram/config";
import { Model } from "@/lib/Model";
import { Activity, Id, Individual, Maybe, Participation } from "@/lib/Schema";
import { ENTITY_TYPE_IDS, getEntityTypeIdFromIndividual } from "@/lib/entityTypes";
import * as d3 from "d3";

interface Props {
  dataset: Model;
  configData: ConfigData;
  setConfigData?: Dispatch<SetStateAction<ConfigData>>;
  activityContext: Maybe<Id>;
  setActivityContext: (c: Maybe<Id>) => void;
  clickIndividual: (i: Individual) => void;
  clickActivity: (a: Activity) => void;
  clickParticipation: (a: Activity, p: Participation) => void;
  rightClickIndividual: (i: Individual) => void;
  rightClickActivity: (a: Activity) => void;
  rightClickParticipation: (a: Activity, p: Participation) => void;
  svgRef: MutableRefObject<any>;
  hideNonParticipating?: boolean;
  highlightedActivityId?: string | null;
  onReorderIndividuals?: (orderedIds: string[]) => void;
}

const ActivityDiagram = (props: Props) => {
  const {
    svgRef,
    dataset,
    configData,
    activityContext,
    setActivityContext,
    clickIndividual,
    clickActivity,
    clickParticipation,
    rightClickIndividual,
    rightClickActivity,
    rightClickParticipation,
    hideNonParticipating = false,
    highlightedActivityId,
    onReorderIndividuals,
  } = props;

  const [plot, setPlot] = useState({
    width: 0,
    height: 0,
  });

  const [interactionMode, setInteractionMode] = useState<"pointer" | "zoom">("pointer");

  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomTransformRef = useRef(d3.zoomIdentity);

  const renderConfig: ConfigData = {
    ...configData,
    viewPort: {
      ...configData.viewPort,
      zoom: 1,
    },
  };

  useEffect(() => {
    setPlot(
      drawActivityDiagram(
        dataset,
        renderConfig,
        activityContext,
        svgRef.current,
        clickIndividual,
        clickActivity,
        clickParticipation,
        rightClickIndividual,
        rightClickActivity,
        rightClickParticipation,
        hideNonParticipating
      )
    );
  }, [
    dataset,
    configData,
    activityContext,
    svgRef,
    clickIndividual,
    clickActivity,
    clickParticipation,
    rightClickIndividual,
    rightClickActivity,
    rightClickParticipation,
    hideNonParticipating,
  ]);

  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .select("#activity-diagram-group")
      .attr("transform", zoomTransformRef.current.toString());
  }, [plot, svgRef]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    svg.on(".zoom", null);

    if (interactionMode === "zoom") {
      const zoomBehavior = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 4])
        .on("zoom", (event) => {
          svg
            .select("#activity-diagram-group")
            .attr("transform", event.transform.toString());
          zoomTransformRef.current = event.transform;
        });

      zoomRef.current = zoomBehavior;
      svg.call(zoomBehavior);
      svg.call(zoomBehavior.transform, zoomTransformRef.current);
    }
  }, [plot, svgRef, interactionMode]);

  // Apply highlighting when highlightedActivityId changes
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    if (highlightedActivityId) {
      // Dim all activities and participations
      svg.selectAll(".activity").attr("opacity", 0.15);
      svg.selectAll(".participation").attr("opacity", 0.1);
      svg.selectAll(".activityLabel").attr("opacity", 0.2);

      // Highlight the selected activity
      svg.select(`#a${highlightedActivityId}`)
        .attr("opacity", 1)
        .attr("stroke-width", "2.5px")
        .attr("stroke-dasharray", "none");
      svg.select(`#al${highlightedActivityId}`)
        .attr("opacity", 1);

      // Highlight participations belonging to the selected activity
      svg.selectAll(".participation")
        .filter(function () {
          const id = (this as SVGElement).getAttribute("id") || "";
          return id.startsWith(`p${highlightedActivityId}`);
        })
        .attr("opacity", 0.8);
    } else {
      // Reset all to default
      svg.selectAll(".activity")
        .attr("opacity", configData.presentation.activity.opacity)
        .attr("stroke-width", configData.presentation.activity.strokeWidth)
        .attr("stroke-dasharray", configData.presentation.activity.strokeDasharray);
      svg.selectAll(".participation").attr("opacity", configData.presentation.activity.opacity);
      svg.selectAll(".activityLabel").attr("opacity", 1);
    }
  }, [highlightedActivityId, plot, configData, svgRef]);

  useEffect(() => {
    if (!svgRef.current || !onReorderIndividuals || interactionMode !== "pointer") {
      return;
    }

    const svg = d3.select(svgRef.current);
    const rowSelection = svg.selectAll<SVGPathElement, Individual>(".individual");

    if (rowSelection.empty()) return;

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

    const updateLinkedParticipations = (entityId: string, offset: number) => {
      const t = offset === 0 ? null : `translate(0, ${offset})`;
      svg
        .selectAll<SVGRectElement, unknown>(".participation")
        .filter(function () {
          return (this as SVGElement).getAttribute("data-row-id") === entityId;
        })
        .attr("transform", t);
    };

    const updateLinkedActivities = () => {
      svg.selectAll<SVGRectElement, unknown>(".activity").each(function () {
        const activityNode = this as SVGRectElement;
        const activityId = activityNode.id.substring(1); // remove 'a'
        
        let minTop = Infinity;
        let maxBottom = -Infinity;
        
        svg.selectAll<SVGRectElement, unknown>(".participation")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-activity-id") === activityId;
          })
          .each(function () {
            const partNode = this as SVGRectElement;
            const y = Number(partNode.getAttribute("y"));
            const height = Number(partNode.getAttribute("height"));
            
            // Get the transform offset of this participation
            const t = partNode.getAttribute("transform");
            let offset = 0;
            if (t) {
              const m = t.match(/translate\(\s*[\d.eE+-]+\s*,\s*([\d.eE+-]+)\s*\)/);
              if (m) offset = Number(m[1]);
            }
            
            const actualTop = y + offset;
            const actualBottom = y + height + offset;
            
            if (actualTop < minTop) minTop = actualTop;
            if (actualBottom > maxBottom) maxBottom = actualBottom;
          });
          
        if (minTop !== Infinity && maxBottom !== -Infinity) {
          const gap = configData.layout.individual.gap;
          const newY = minTop - gap * 0.3;
          const newHeight = maxBottom - minTop + gap * 0.6;
          
          d3.select(activityNode)
            .attr("y", newY)
            .attr("height", newHeight);
        }
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

    // ── Shift helpers ──
    const shiftElement = (id: string, dy: number, animate: boolean) => {
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
      });
      // Third pass: reset all activities
      updateLinkedActivities();
    };

    // ── Drag behavior ──
    const dragBehavior = d3
      .drag<SVGPathElement, Individual>()
      .on("start", function (event, draggedIndividual) {
        const draggedType = getEntityTypeIdFromIndividual(draggedIndividual);
        const isSystem = draggedType === ENTITY_TYPE_IDS.SYSTEM;
        const isDraggedComponent = isNestedComponent(draggedIndividual);

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
          // Raise activities and participations so they stay on top
          svg.selectAll(".activity").raise();
          svg.selectAll(".participation").raise();
        };

        // Raise dragged element (and components) above everything for z-order
        raiseEntityVisuals(draggedIndividual.id);
        if (isSystem) {
          const compIds = getComponentIdsForSystem(draggedIndividual.id);
          compIds.forEach((cid) => raiseEntityVisuals(cid));
        }

        d3.select(this)
          .attr("data-drag-offset", "0")
          .attr("data-was-dragged", "0")
          .style("cursor", "grabbing");
      })
      .on("drag", function (event, draggedIndividual) {
        const currentOffset = Number(d3.select(this).attr("data-drag-offset") ?? "0");
        const nextOffset = currentOffset + event.dy;
        const draggedType = getEntityTypeIdFromIndividual(draggedIndividual);
        const isSystem = draggedType === ENTITY_TYPE_IDS.SYSTEM;
        const isDraggedComponent = isNestedComponent(draggedIndividual);

        d3.select(this)
          .attr("data-drag-offset", String(nextOffset))
          .attr("data-was-dragged", "1")
          .attr("transform", `translate(0, ${nextOffset})`);

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

        // If dragging a system, also move its components
        if (isSystem) {
          const compIds = getComponentIdsForSystem(draggedIndividual.id);
          compIds.forEach((cid) => {
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

          let insertIdx = siblings.length;
          for (let i = 0; i < siblings.length; i++) {
            if (draggedCenter < siblings[i].y + siblings[i].height / 2) {
              insertIdx = i;
              break;
            }
          }

          svg
            .selectAll(".individual")
            .classed("drop-target-valid", false)
            .classed("drop-target-invalid", false);

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
        // Clean up all preview transforms
        clearAllPreviewShifts();

        // Clean up drop target visuals
        svg
          .selectAll(".individual")
          .classed("drop-target-valid", false)
          .classed("drop-target-invalid", false);

        const draggedNode = this as SVGPathElement;
        const draggedSelection = d3.select(draggedNode);
        const wasDragged = draggedSelection.attr("data-was-dragged") === "1";
        const dragOffset = Number(draggedSelection.attr("data-drag-offset") ?? "0");

        const draggedType = getEntityTypeIdFromIndividual(draggedIndividual);
        const isSystem = draggedType === ENTITY_TYPE_IDS.SYSTEM;
        const isDraggedComponent = isNestedComponent(draggedIndividual);

        // Reset transforms on dragged element (and its components if system)
        draggedSelection
          .attr("transform", null)
          .attr("data-drag-offset", null)
          .attr("data-was-dragged", null)
          .style("cursor", "ns-resize");

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

    rowSelection
      .style("cursor", "ns-resize")
      .call(dragBehavior as any);

    return () => {
      svg
        .selectAll(".individual")
        .on(".drag", null)
        .interrupt()
        .style("cursor", null)
        .attr("transform", null)
        .classed("drop-target-valid", false)
        .classed("drop-target-invalid", false);
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
    };
  }, [plot, svgRef, interactionMode, onReorderIndividuals, dataset]);

  const buildCrumbs = () => {
    const context = [];
    let id: string | undefined = activityContext;
    while (true) {
      const link = id;
      const act = id ? dataset.activities.get(id) : null;
      const text = act ? act.name : <i>{dataset.name ?? "Top"}</i>;
      context.push(
        <Breadcrumb.Item
          active={id == activityContext}
          linkProps={{ onClick: () => setActivityContext(link) }}
          key={id ?? "."}
        >
          {text}
        </Breadcrumb.Item>
      );
      if (id == undefined) break;
      id = act!.partOf;
    }
    return context.reverse();
  };
  const crumbs: JSX.Element[] = buildCrumbs();

  return (
    <>
      <Breadcrumb>{crumbs}</Breadcrumb>
      <div
        className="diagram-viewport"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="diagram-icon-toggle"
          style={{
            marginLeft: "auto",
            display: "flex",
            justifyContent: "flex-end",
            gap: "6px",
            marginBottom: "-32px",
            marginRight: "-24px",
            width: "fit-content",
          }}
        >
          <Button
            variant={interactionMode === "pointer" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setInteractionMode("pointer")}
            aria-pressed={interactionMode === "pointer"}
            title="Pointer mode"
            style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 2l9 4-4 1 2 6-2 1-2-6-3 3V2z" fill="currentColor" />
            </svg>
          </Button>
          <Button
            variant={interactionMode === "zoom" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setInteractionMode("zoom")}
            aria-pressed={interactionMode === "zoom"}
            title="Zoom mode"
            style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M7 4.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M5 7h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Button>
        </div>

        <div
          id="activity-diagram-scrollable-div"
          style={{
            overflowX: "auto",
            overflowY: "auto",
            touchAction: "pan-x pan-y",
            cursor: interactionMode === "zoom" ? "zoom-in" : "default",
          }}
        >
          <svg
            viewBox={`0 0 ${plot.width} ${plot.height}`}
            ref={svgRef}
            style={{ minWidth: "100%" }}
          />
        </div>
      </div>
    </>
  );
};

export default ActivityDiagram;
