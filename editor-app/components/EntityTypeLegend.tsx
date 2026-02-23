import React from "react";
import Card from "react-bootstrap/Card";

const HatchedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" style={{ verticalAlign: "middle" }}>
    <defs>
      <pattern
        id="legendInstallHatch"
        width="4"
        height="4"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line x1="0" y1="0" x2="0" y2="4" stroke="#444" strokeWidth="1.5" />
      </pattern>
    </defs>
    <rect
      x="1"
      y="1"
      width="12"
      height="12"
      rx="2"
      fill="url(#legendInstallHatch)"
      stroke="#666"
      strokeWidth="1"
    />
  </svg>
);

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
        <div className="legend-item">
          <span className="legend-label" style={{ display: "inline-flex", alignItems: "center" }}>
            <HatchedIcon />
          </span>
          <span className="legend-label ms-2">Installed</span>
        </div>
      </Card.Body>
    </Card>
  );
};

export default EntityTypeLegend;
