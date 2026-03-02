import React from "react";
import Card from "react-bootstrap/Card";

const HatchedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" style={{ verticalAlign: "middle" }}>
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
      y="3"
      width="14"
      height="10"
      rx="2"
      fill="url(#legendInstallHatch)"
      stroke="#666"
      strokeWidth="1"
    />
  </svg>
);

const DashedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" style={{ verticalAlign: "middle" }}>
    <rect
      x="1"
      y="3"
      width="14"
      height="10"
      fill="none"
      stroke="#666"
      strokeWidth="1.5"
      strokeDasharray="5,3"
      rx="2"
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
        <Card.Title className="legend-title">Entity Legend</Card.Title>
        {entityTypes.map((item) => (
          <div key={item.label} className="legend-item">
            <span className="legend-icon">{item.icon}</span>
            <span className="legend-label">{item.label}</span>
          </div>
        ))}
        <div className="legend-item">
          <span className="legend-icon">
            <HatchedIcon />
          </span>
          <span className="legend-label">Installation Period</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon">
            <DashedIcon />
          </span>
          <span className="legend-label">Currently Installed</span>
        </div>
      </Card.Body>
    </Card>
  );
};

export default EntityTypeLegend;
