import React, { useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { Activity } from "@/lib/Schema";
import { ArrowUp } from "../components/svg/ArrowUp";

interface Props {
  activities: Activity[];
  activityColors: string[];
  partsCount?: Record<string, number>;
  onOpenActivity?: (a: Activity) => void;
}

////typescript
// filepath: c:\Users\me1meg\Documents\4d-activity-editor\editor-app\components\DiagramLegend.tsx
// ...existing code...
const DiagramLegend = ({
  activities,
  activityColors,
  partsCount,
  onOpenActivity,
}: Props) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter activities based on search term
  const filteredActivities = activities.filter((activity) =>
    activity.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Decide threshold based on screen size:
  // - big screens: 12
  // - smaller screens (laptops/tablets): 8
  const [scrollThreshold, setScrollThreshold] = useState(12);

  React.useEffect(() => {
    const updateThreshold = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // "Laptop-ish" widths or limited height → smaller threshold
      if (width <= 1400 || height <= 800) {
        setScrollThreshold(8);
      } else {
        setScrollThreshold(12);
      }
    };

    updateThreshold();
    window.addEventListener("resize", updateThreshold);
    return () => window.removeEventListener("resize", updateThreshold);
  }, []);

  // Only show scrollbar when we exceed the threshold
  const needsScroll = filteredActivities.length > scrollThreshold;

  return (
    <Card className="legend-card mb-2">
      <Card.Body className="legend-body">
        <Card.Title className="legend-title">Activity Legend</Card.Title>

        {/* Search input - only show if there are more than 5 activities */}
        {activities.length > 5 && (
          <Form.Control
            type="text"
            placeholder="Search activities..."
            size="sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-2"
            style={{ fontSize: "0.8rem" }}
          />
        )}

        {/* Scrollable container - only scroll when needed */}
        <div
          style={{
            maxHeight: needsScroll ? "200px" : "none",
            overflowY: needsScroll ? "auto" : "visible",
            overflowX: "hidden",
          }}
        >
          {filteredActivities.length === 0 && searchTerm ? (
            <div className="text-muted small">No activities found</div>
          ) : (
            filteredActivities.map((activity) => {
              const originalIdx = activities.findIndex(
                (a) => a.id === activity.id
              );
              const count = partsCount ? partsCount[activity.id] ?? 0 : 0;
              return (
                <div
                  key={activity.id}
                  className="legend-item justify-content-between"
                >
                  <div className="d-flex align-items-center overflow-hidden">
                    <span
                      className="legend-color-box"
                      style={{
                        background:
                          activityColors[originalIdx % activityColors.length],
                      }}
                    />
                    <span className="legend-label text-truncate">
                      {count > 0 ? (
                        <>
                          {activity.name}{" "}
                          <span style={{ fontWeight: "bolder" }}>
                            ({count} subtask{count !== 1 ? "s" : ""})
                          </span>
                        </>
                      ) : (
                        activity.name
                      )}
                    </span>
                  </div>

                  <div className="flex-shrink-0">
                    {onOpenActivity && (
                      <OverlayTrigger
                        placement="top"
                        overlay={
                          <Tooltip id={`open-act-${activity.id}`}>
                            Open activity editor
                          </Tooltip>
                        }
                      >
                        <Button
                          variant="none"
                          size="sm"
                          className="legend-action-btn"
                          onClick={() => onOpenActivity(activity)}
                          aria-label={`Open ${activity.name}`}
                          onMouseEnter={() => setHovered(activity.id)}
                          onMouseLeave={() => setHovered(null)}
                        >
                          <ArrowUp />
                        </Button>
                      </OverlayTrigger>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* No Activity item - outside scrollable area */}
        <div className="legend-item mt-2">
          <span className="legend-color-box" style={{ background: "#ccc" }} />
          <span className="legend-label">No Activity</span>
        </div>
      </Card.Body>
    </Card>
  );
};

export default DiagramLegend;
