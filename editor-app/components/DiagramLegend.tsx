import React from "react";
import Card from "react-bootstrap/Card";
import { Activity } from "@/lib/Schema";

interface Props {
  activities: Activity[];
  activityColors: string[];
  partsCount?: Record<string, number>;
}

const DiagramLegend = ({ activities, activityColors, partsCount }: Props) => (
  <Card className="ms-3 mb-2" style={{ minWidth: 220 }}>
    <Card.Body>
      <Card.Title>Legend</Card.Title>
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
          <span>Not Participating</span>
        </div>
      </div>
    </Card.Body>
  </Card>
);

export default DiagramLegend;
