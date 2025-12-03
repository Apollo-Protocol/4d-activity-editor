import { useState, useEffect, MutableRefObject, JSX, useRef } from "react";
import Breadcrumb from "react-bootstrap/Breadcrumb";
import { drawActivityDiagram } from "@/diagram/DrawActivityDiagram";
import { ConfigData } from "@/diagram/config";
import { Model } from "@/lib/Model";
import { Activity, Id, Individual, Maybe, Participation } from "@/lib/Schema";

interface Props {
  dataset: Model;
  configData: ConfigData;
  activityContext: Maybe<Id>;
  setActivityContext: (c: Maybe<Id>) => void;
  clickIndividual: (i: Individual) => void;
  clickActivity: (a: Activity) => void;
  clickParticipation: (a: Activity, p: Participation) => void;
  rightClickIndividual: (i: Individual) => void;
  rightClickActivity: (a: Activity) => void;
  rightClickParticipation: (a: Activity, p: Participation) => void;
  svgRef: MutableRefObject<any>;
  hideNonParticipating: boolean;
  sortedIndividuals?: Individual[];
  highlightedActivityId?: string | null;
}

const ActivityDiagram = (props: Props) => {
  const {
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
    svgRef,
    hideNonParticipating,
    sortedIndividuals,
    highlightedActivityId,
  } = props;

  const [plot, setPlot] = useState({
    width: 0,
    height: 0,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null); // NEW: Ref for the outer wrapper
  const [wrapperHeight, setWrapperHeight] = useState(0); // NEW: State for wrapper height
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });

  // Track scroll position for axis positioning
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setScrollPosition({
        x: scrollContainerRef.current.scrollLeft,
        y: scrollContainerRef.current.scrollTop,
      });
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // NEW: Measure wrapper height to draw axis correctly
  useEffect(() => {
    if (!wrapperRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWrapperHeight(entry.contentRect.height);
      }
    });
    resizeObserver.observe(wrapperRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  useEffect(() => {
    setPlot(
      drawActivityDiagram(
        dataset,
        configData,
        activityContext,
        svgRef.current,
        clickIndividual,
        clickActivity,
        clickParticipation,
        rightClickIndividual,
        rightClickActivity,
        rightClickParticipation,
        hideNonParticipating,
        sortedIndividuals
      )
    );

    // Apply highlighting logic to participation rects (the actual visible colored blocks)
    const svg = svgRef.current;
    if (svg) {
      // Target participation-rect elements (the visible colored blocks)
      const allParticipationRects = svg.querySelectorAll(".participation-rect");

      if (highlightedActivityId) {
        // Dim all participation rects
        allParticipationRects.forEach((el: SVGElement) => {
          el.style.opacity = "0.15";
          el.style.stroke = "";
          el.style.strokeWidth = "";
        });

        // Track bounding box of all highlighted rects
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        let foundHighlighted = false;

        // Highlight participation rects belonging to the selected activity
        // Participation rect IDs are in format: p_{activityId}_{individualId}_{segStart}_{segEnd}
        allParticipationRects.forEach((el: SVGElement) => {
          const elId = el.getAttribute("id") || "";

          // Check if this participation rect belongs to the highlighted activity
          // ID format: p_{activityId}_{rest...}
          if (elId.startsWith("p_" + highlightedActivityId + "_")) {
            el.style.opacity = "1";
            el.style.stroke = "#000";
            el.style.strokeWidth = "2px";
            // Bring to front
            el.parentNode?.appendChild(el);

            // Calculate bounding box from this element
            const rect = el as SVGGraphicsElement;
            const bbox = rect.getBBox?.();
            if (bbox) {
              foundHighlighted = true;
              minX = Math.min(minX, bbox.x);
              minY = Math.min(minY, bbox.y);
              maxX = Math.max(maxX, bbox.x + bbox.width);
              maxY = Math.max(maxY, bbox.y + bbox.height);
            }
          }
        });

        // Remove any existing highlight borders first
        svg
          .querySelectorAll(".highlight-border")
          .forEach((el: Element) => el.remove());

        // Draw a dashed border around the calculated bounding box
        if (foundHighlighted && minX < Infinity) {
          const ns = "http://www.w3.org/2000/svg";
          const highlightRect = document.createElementNS(ns, "rect");
          highlightRect.setAttribute("class", "highlight-border");
          highlightRect.setAttribute("x", String(minX - 3));
          highlightRect.setAttribute("y", String(minY - 3));
          highlightRect.setAttribute("width", String(maxX - minX + 6));
          highlightRect.setAttribute("height", String(maxY - minY + 6));
          highlightRect.setAttribute("fill", "none");
          highlightRect.setAttribute("stroke", "#000000");
          highlightRect.setAttribute("stroke-width", "2");
          highlightRect.setAttribute("stroke-dasharray", "6,3");
          highlightRect.setAttribute("rx", "6");
          highlightRect.setAttribute("pointer-events", "none");
          svg.appendChild(highlightRect);
        }
      } else {
        // Reset styles if nothing highlighted
        allParticipationRects.forEach((el: SVGElement) => {
          el.style.opacity = "";
          el.style.stroke = "";
          el.style.strokeWidth = "";
        });

        // Remove any highlight borders
        svg
          .querySelectorAll(".highlight-border")
          .forEach((el: Element) => el.remove());
      }
    }
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
    sortedIndividuals,
    highlightedActivityId,
  ]);

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

  // Axis configuration
  const axisMargin = configData.presentation.axis.margin;
  const axisWidth = configData.presentation.axis.width;
  const axisColour = configData.presentation.axis.colour;
  const axisEndMargin = configData.presentation.axis.endMargin;

  // Calculate visible dimensions
  // Use measured wrapper height, fallback to calculation if 0 (initial render)
  const containerHeight =
    wrapperHeight || Math.min(plot.height, window.innerHeight - 250);
  const bottomAxisHeight = axisMargin + 30;

  return (
    <>
      <Breadcrumb>{crumbs}</Breadcrumb>
      <div
        ref={wrapperRef} // Attach ref here
        style={{
          position: "relative",
          border: "1px solid #e0e0e0",
          borderRadius: "4px",
          backgroundColor: "#fafafa",
        }}
      >
        {/* Fixed Y-Axis (Space) - left side */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: `${axisMargin + 30}px`,
            height: "100%",
            backgroundColor: "#fafafa",
            zIndex: 10,
            pointerEvents: "none",
            borderRight: "1px solid #e5e5e5",
          }}
        >
          <svg
            width={axisMargin + 30}
            height="100%"
            style={{ display: "block" }}
          >
            {/* Y-Axis arrow */}
            <defs>
              <marker
                id="triangle-y"
                refX="0"
                refY="10"
                markerWidth="20"
                markerHeight="20"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M 0 0 L 20 10 L 0 20 z" fill={axisColour} />
              </marker>
            </defs>
            <line
              x1={axisMargin}
              y1={containerHeight - bottomAxisHeight + axisWidth / 2} // Adjusted to stop exactly at X-axis
              x2={axisMargin}
              y2={axisEndMargin}
              stroke={axisColour}
              strokeWidth={axisWidth}
              markerEnd="url(#triangle-y)"
            />
            {/* Y-Axis label "Space" */}
            <text
              x={axisMargin + configData.presentation.axis.textOffsetY}
              y={containerHeight / 2 + axisMargin}
              fill="white"
              stroke="white"
              fontSize="0.8em"
              fontWeight="200"
              textAnchor="middle"
              fontFamily="Roboto, Arial, sans-serif"
              transform={`rotate(270 ${
                axisMargin + configData.presentation.axis.textOffsetY
              } ${containerHeight / 2 + axisMargin})`}
            >
              Space
            </text>
          </svg>
        </div>

        {/* Fixed X-Axis (Time) - bottom */}
        <div
          style={{
            position: "absolute",
            left: `${axisMargin + 30}px`,
            bottom: 0,
            right: 0,
            height: `${bottomAxisHeight}px`,
            backgroundColor: "#fafafa",
            zIndex: 10,
            pointerEvents: "none",
            borderTop: "1px solid #e5e5e5",
          }}
        >
          <svg
            width="100%"
            height={bottomAxisHeight}
            style={{ display: "block" }}
          >
            {/* X-Axis arrow */}
            <defs>
              <marker
                id="triangle-x"
                refX="0"
                refY="10"
                markerWidth="20"
                markerHeight="20"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M 0 0 L 20 10 L 0 20 z" fill={axisColour} />
              </marker>
            </defs>
            <line
              x1={0}
              y1={axisMargin}
              x2={`calc(100% - ${axisEndMargin}px)`}
              y2={axisMargin}
              stroke={axisColour}
              strokeWidth={axisWidth}
              markerEnd="url(#triangle-x)"
            />
            {/* X-Axis label "Time" */}
            <text
              x="50%"
              y={axisMargin + configData.presentation.axis.textOffsetX}
              fill="white"
              stroke="white"
              fontSize="0.8em"
              fontWeight="200"
              textAnchor="middle"
              fontFamily="Roboto, Arial, sans-serif"
            >
              Time
            </text>
          </svg>
        </div>

        {/* Corner piece to cover overlap */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: `${axisMargin + 30}px`,
            height: `${bottomAxisHeight}px`,
            backgroundColor: "#fafafa",
            zIndex: 11,
          }}
        />

        {/* Scrollable diagram content */}
        <div
          id="activity-diagram-scrollable-div"
          ref={scrollContainerRef}
          style={{
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: `calc(100vh - 250px)`,
            marginLeft: `${axisMargin + 30}px`,
            marginBottom: `${bottomAxisHeight}px`,
          }}
        >
          <svg
            viewBox={`0 0 ${plot.width} ${plot.height}`}
            ref={svgRef}
            style={{
              minWidth: configData.viewPort.zoom * 100 + "%",
              display: "block",
            }}
          />
        </div>
      </div>
    </>
  );
};

export default ActivityDiagram;
