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
    <Card className="ms-3 mb-2" style={{ minWidth: 220 }}>
      <Card.Body>
        <Card.Title>Activity Legend</Card.Title>
        {activities.map((activity, idx) => {
          const count = partsCount ? partsCount[activity.id] ?? 0 : 0;
          return (
            <div
              key={activity.id}
              className="mb-1 d-flex align-items-center justify-content-between"
            >
              <div className="d-flex align-items-center">
                <span
                  style={{
                    display: "inline-block",
                    width: 16,
                    height: 16,
                    background: activityColors[idx % activityColors.length],
                    borderRadius: 3,
                    marginRight: 8,
                    border: "1px solid #888",
                  }}
                />
                {count > 0 ? (
                  <span>
                    {activity.name}{" "}
                    <span style={{ fontWeight: "bolder" }}>
                      ({count} subtask{count !== 1 ? "s" : ""})
                    </span>
                  </span>
                ) : (
                  <span>{activity.name}</span>
                )}
              </div>

              {/* open/edit button on the right */}
              <div>
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
        <div className="mt-2 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <span
              style={{
                display: "inline-block",
                width: 16,
                height: 16,
                background: "#ccc",
                borderRadius: 3,
                marginRight: 8,
                border: "1px solid #888",
              }}
            />
            <span>No Activity</span>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default DiagramLegend;
