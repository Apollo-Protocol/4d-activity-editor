import React from "react";
import Card from "react-bootstrap/Card";

const entityTypes = [
  { icon: "▣", label: "System" },
  { icon: "◇", label: "System Component" },
  { icon: "○", label: "Individual" },
];

const EntityTypeLegend = () => {
  return (
    <Card className="legend-card mb-2">
      <Card.Body className="legend-body">
        <Card.Title className="legend-title">Entity Types</Card.Title>
        {entityTypes.map((item) => (
          <div key={item.label} className="legend-item">
            <span className="legend-label">{item.icon}</span>
            <span className="legend-label ms-2">{item.label}</span>
          </div>
        ))}
      </Card.Body>
    </Card>
  );
};

export default EntityTypeLegend;
