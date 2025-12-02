import React, { useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
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

const DiagramLegend = ({
  activities,
  activityColors,
  partsCount,
  onOpenActivity,
}: Props) => {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <Card className="legend-card mb-2">
      <Card.Body className="legend-body">
        <Card.Title className="legend-title">Activity Legend</Card.Title>

        {/* Scrollable container for activity items */}
        <div
          style={{
            maxHeight: "200px",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {activities.map((activity, idx) => {
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
                      background: activityColors[idx % activityColors.length],
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

                {/* open/edit button on the right */}
                <div className="flex-shrink-0">
                  {onOpenActivity ? (
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
                  ) : null}
                </div>
              </div>
            );
          })}
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
