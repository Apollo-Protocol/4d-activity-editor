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

  // Only show scrollbar when there are more than 7 activities
  const needsScroll = filteredActivities.length > 7;

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
            filteredActivities.map((activity, idx) => {
              // Find original index for color matching
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
