import React from "react";
import Card from "react-bootstrap/Card";
import { Activity } from "@/lib/Schema";

interface Props {
  activities: Activity[];
  activityColors: string[];
}

const DiagramLegend = ({ activities, activityColors }: Props) => (
  <Card className="ms-3 mb-2" style={{ minWidth: 220 }}>
    <Card.Body>
      <Card.Title>Legend</Card.Title>
      {activities.map((activity, idx) => (
        <div key={activity.id} className="mb-1 d-flex align-items-center">
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
          <span>{activity.name}</span>
        </div>
      ))}
      <div className="mt-2">
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
    </Card.Body>
  </Card>
);

export default DiagramLegend;
