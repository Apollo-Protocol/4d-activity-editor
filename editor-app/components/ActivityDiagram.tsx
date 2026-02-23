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

    const getRows = () => {
      return svg
        .selectAll<SVGPathElement, Individual>(".individual")
        .nodes()
        .map((node) => {
          const id = (node.getAttribute("id") ?? "").replace(/^i/, "");
          const rowY = Number(node.getAttribute("data-row-y") ?? "0");
          const bbox = node.getBBox();
          return { id, centerY: rowY + bbox.height / 2, node };
        })
        .filter((row) => row.id.length > 0);
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

          const lowerShift = installedId === entityId ? offset : 0;
          const upperShift = targetId === entityId ? offset : 0;
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

    // Snapshot of row layout captured at drag start for live-preview shifts
    interface RowSnapshot {
      id: string;
      y: number;
      height: number;
      node: SVGPathElement;
    }
    let dragSnapshot: RowSnapshot[] = [];

    const shiftRowAndLabel = (rowId: string, dy: number) => {
      const t = dy === 0 ? null : `translate(0, ${dy})`;
      svg.select(`#i${rowId}`).transition().duration(120).attr("transform", t);
      svg.select(`#il${rowId}`).transition().duration(120).attr("transform", t);
    };

    const clearAllPreviewShifts = () => {
      dragSnapshot.forEach((snap) => {
        svg.select(`#i${snap.id}`).interrupt().attr("transform", null);
        svg.select(`#il${snap.id}`).interrupt().attr("transform", null);
      });
    };

    const dragBehavior = d3
      .drag<SVGPathElement, Individual>()
      .on("start", function (event, draggedIndividual) {
        // Take a snapshot of the current row positions before anything moves
        dragSnapshot = svg
          .selectAll<SVGPathElement, Individual>(".individual")
          .nodes()
          .map((node) => {
            const id = (node.getAttribute("id") ?? "").replace(/^i/, "");
            const y = Number(node.getAttribute("data-row-y") ?? "0");
            const bbox = node.getBBox();
            return { id, y, height: bbox.height, node };
          })
          .filter((r) => r.id.length > 0)
          .sort((a, b) => a.y - b.y);

        d3.select(this)
          .attr("data-drag-offset", "0")
          .attr("data-was-dragged", "0")
          .style("cursor", "grabbing");
      })
      .on("drag", function (event, draggedIndividual) {
        const currentOffset = Number(d3.select(this).attr("data-drag-offset") ?? "0");
        const nextOffset = currentOffset + event.dy;
        d3.select(this)
          .attr("data-drag-offset", String(nextOffset))
          .attr("data-was-dragged", "1")
          .attr("transform", `translate(0, ${nextOffset})`);

        updateLinkedLabel(draggedIndividual.id, nextOffset);
        updateLinkedRibbons(draggedIndividual.id, nextOffset);

        // --- Live reorder preview ---
        const draggedSnap = dragSnapshot.find((r) => r.id === draggedIndividual.id);
        if (!draggedSnap) return;

        const draggedCenter = draggedSnap.y + draggedSnap.height / 2 + nextOffset;
        const others = dragSnapshot.filter((r) => r.id !== draggedIndividual.id);

        // Determine where the dragged row would be inserted
        let insertIdx = others.length; // default: at the end
        for (let i = 0; i < others.length; i++) {
          const otherCenter = others[i].y + others[i].height / 2;
          if (draggedCenter < otherCenter) {
            insertIdx = i;
            break;
          }
        }

        // Check validity of the closest target
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

        // Clear previous drop target highlights
        svg
          .selectAll(".individual")
          .classed("drop-target-valid", false)
          .classed("drop-target-invalid", false);

        if (closestRow) {
          d3.select(closestRow.node)
            .classed("drop-target-valid", isValidTarget)
            .classed("drop-target-invalid", !isValidTarget);
        }

        // If invalid, don't preview-shift rows
        if (!isValidTarget) {
          others.forEach((snap) => shiftRowAndLabel(snap.id, 0));
          return;
        }

        // Calculate how far each other row needs to shift to make room
        const draggedHeight = draggedSnap.height + configData.layout.individual.gap;

        // Original index of the dragged row in the snapshot
        const origIdx = dragSnapshot.indexOf(draggedSnap);

        others.forEach((snap, i) => {
          // This row's original index (skipping the dragged row)
          const origOtherIdx = dragSnapshot.indexOf(snap);
          let dy = 0;

          if (origOtherIdx < origIdx && i >= insertIdx) {
            // Row was above the dragged row but needs to move down (dragged moved up)
            dy = draggedHeight;
          } else if (origOtherIdx > origIdx && i < insertIdx) {
            // Row was below the dragged row but needs to move up (dragged moved down)
            dy = -draggedHeight;
          }

          shiftRowAndLabel(snap.id, dy);
        });
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

        draggedSelection
          .attr("transform", null)
          .attr("data-drag-offset", null)
          .attr("data-was-dragged", null)
          .style("cursor", "ns-resize");

        svg.select(`#il${draggedIndividual.id}`).attr("transform", null);
        updateLinkedRibbons(draggedIndividual.id, 0);

        dragSnapshot = [];

        if (!wasDragged) return;

        const rows = getRows().sort((a, b) => a.centerY - b.centerY);

        const draggedRow = rows.find((row) => row.id === draggedIndividual.id);
        if (!draggedRow) return;

        const draggedCenter = draggedRow.centerY + dragOffset;
        const closestRow = getClosestTargetRow(
          rows,
          draggedIndividual.id,
          draggedCenter
        );
        const overIndividual = closestRow
          ? dataset.individuals.get(closestRow.id)
          : undefined;
        if (!canReorderIndividuals(draggedIndividual, overIndividual)) {
          return;
        }

        const otherRows = rows.filter((row) => row.id !== draggedIndividual.id);
        const insertionIndex = otherRows.findIndex((row) => draggedCenter < row.centerY);
        const nextRows = [...otherRows];
        if (insertionIndex < 0) {
          nextRows.push(draggedRow);
        } else {
          nextRows.splice(insertionIndex, 0, draggedRow);
        }

        onReorderIndividuals(nextRows.map((row) => row.id));
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
      dragSnapshot = [];
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
