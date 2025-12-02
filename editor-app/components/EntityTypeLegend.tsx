import React from "react";
import Card from "react-bootstrap/Card";

interface EntityLegendItem {
  icon: string;
  label: string;
  description?: string;
  hasHatch?: boolean;
}

export const entityTypes: EntityLegendItem[] = [
  {
    icon: "▣",
    label: "System",
    description: "A system containing component slots",
  },
  {
    icon: "◇",
    label: "System Component",
    description: "A slot/role within a system (uninstalled)",
  },
  {
    icon: "◆",
    label: "SC in System",
    description: "A system component installed in a system",
  },
  {
    icon: "◈",
    label: "SC in SC",
    description: "A system component nested inside another system component",
  },
  {
    icon: "◆",
    label: "SC with children",
    description: "A system component that has other components installed in it",
    hasHatch: true,
  },
  {
    icon: "⬡",
    label: "Installed Component",
    description: "A physical component (uninstalled)",
  },
  {
    icon: "⬢",
    label: "IC in SC",
    description: "An installed component in a system component slot",
  },
  {
    icon: "○",
    label: "Individual",
    description: "A regular individual entity",
  },
];

const EntityTypeLegend = () => {
  return (
    <Card className="legend-card mb-2">
      <Card.Body className="legend-body">
        <Card.Title className="legend-title">Entity Types</Card.Title>
        {entityTypes.map((item, idx) => (
          <div key={idx} className="legend-item" title={item.description}>
            <span className="legend-icon-wrapper">
              {item.icon}
              {item.hasHatch && (
                <svg className="legend-hatch-overlay">
                  <defs>
                    <pattern
                      id="legend-hatch"
                      patternUnits="userSpaceOnUse"
                      width="4"
                      height="4"
                      patternTransform="rotate(45)"
                    >
                      <line
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="4"
                        stroke="#374151"
                        strokeWidth="1"
                      />
                    </pattern>
                  </defs>
                  <rect
                    x="2"
                    y="4"
                    width="20"
                    height="16"
                    fill="url(#legend-hatch)"
                    opacity="0.5"
                  />
                </svg>
              )}
            </span>
            <span className="legend-label">{item.label}</span>
          </div>
        ))}
      </Card.Body>
    </Card>
  );
};

export default EntityTypeLegend;
