import { useState, useEffect, useRef, MutableRefObject, JSX, Dispatch, SetStateAction } from "react";
import Breadcrumb from "react-bootstrap/Breadcrumb";
import Button from "react-bootstrap/Button";
import { drawActivityDiagram } from "@/diagram/DrawActivityDiagram";
import { ConfigData } from "@/diagram/config";
import { Model } from "@/lib/Model";
import { Activity, Id, Individual, Maybe, Participation } from "@/lib/Schema";
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
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginBottom: "6px" }}>
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
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Button>
        </div>

        <div 
          id="activity-diagram-scrollable-div" 
          style={{ overflowX: "auto", overflowY: "hidden", touchAction: "pan-x pan-y", cursor: interactionMode === "zoom" ? "zoom-in" : "default" }}
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
