import React, { Dispatch, SetStateAction } from "react";
import Button from "react-bootstrap/Button";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { Model } from "@/lib/Model";
import { Activity } from "@/lib/Schema";

interface Props {
  compactMode: boolean;
  setCompactMode: Dispatch<SetStateAction<boolean>>;
  dataset: Model;
  activitiesInView: Activity[];
}

const HideIndividuals = ({
  compactMode,
  setCompactMode,
  dataset,
  activitiesInView,
}: Props) => {
  // Find if there are individuals with no activity in the current view
  const hasInactiveIndividuals = (() => {
    const participating = new Set<string>();
    activitiesInView.forEach((a) =>
      a.participations.forEach((p: any) => participating.add(p.individualId))
    );
    for (const i of Array.from(dataset.individuals.values())) {
      if (!participating.has(i.id)) return true;
    }
    return false;
  })();

  if (!hasInactiveIndividuals) return null;

  const tooltip = compactMode ? (
    <Tooltip id="show-individuals-tooltip">
      This will show individuals with no activity.
    </Tooltip>
  ) : (
    <Tooltip id="hide-individuals-tooltip">
      This will hide individuals with no activity.
    </Tooltip>
  );

  return (
    <div className="ms-2 d-flex align-items-center mobile-contents">
      <OverlayTrigger placement="top" overlay={tooltip}>
        <Button
          variant={compactMode ? "secondary" : "primary"}
          onClick={() => setCompactMode(!compactMode)}
        >
          {compactMode ? "Show Individuals" : "Hide Individuals"}
        </Button>
      </OverlayTrigger>
    </div>
  );
};

export default HideIndividuals;
