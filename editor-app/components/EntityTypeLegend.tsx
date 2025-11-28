import React from "react";
import Card from "react-bootstrap/Card";

interface EntityLegendItem {
  icon: string;
  label: string;
  description?: string;
}

export const entityTypes: EntityLegendItem[] = [
  { icon: "▣", label: "System", description: "A system containing components" },
  {
    icon: "◈",
    label: "System Component",
    description: "A slot within a system",
  },
  {
    icon: "⬢",
    label: "Installed Component",
    description: "A physical component",
  },
  {
    icon: "⬡",
    label: "Installed (in system comp)",
    description: "Component installed in a system component",
  },
  {
    icon: "◇",
    label: "Installed (system)",
    description: "System component installed in a system",
  },
  { icon: "O", label: "Individual", description: "A regular individual" },
];

const EntityTypeLegend = () => {
  return (
    <Card className="ms-3 mb-2" style={{ minWidth: 220 }}>
      <Card.Body>
        <Card.Title>Entity Types</Card.Title>
        {entityTypes.map((item, idx) => (
          <div
            key={idx}
            className="mb-1 d-flex align-items-center"
            title={item.description}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                marginRight: 8,
                fontSize: 20,

                fontFamily: "Arial, sans-serif",
              }}
            >
              {item.icon}
            </span>
            <span style={{ color: "#111827" }}>{item.label}</span>
          </div>
        ))}
      </Card.Body>
    </Card>
  );
};

export default EntityTypeLegend;
