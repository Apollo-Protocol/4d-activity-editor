import React, { Dispatch, SetStateAction } from "react";
import Button from "react-bootstrap/Button";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { Model } from "@/lib/Model";

interface Props {
  compactMode: boolean;
  setCompactMode: Dispatch<SetStateAction<boolean>>;
  dataset: Model;
}

const HideIndividuals = ({ compactMode, setCompactMode, dataset }: Props) => {
  // Find if there are individuals with no activity
  const hasInactiveIndividuals = (() => {
    const participating = new Set<string>();
    dataset.activities.forEach((a) =>
      a.participations.forEach((p: any) => participating.add(p.individualId))
    );
    for (const i of Array.from(dataset.individuals.values())) {
      if (!participating.has(i.id)) return true;
    }
    return false;
  })();

  if (!hasInactiveIndividuals) return null;

  const tooltip = (
    <Tooltip id="hide-individuals-tooltip">
      This will hide individuals with no activity.
    </Tooltip>
  );

  const unhideTooltip = (
    <Tooltip id="unhide-individuals-tooltip">
      This will show all individuals with no activity.
    </Tooltip>
  );

  return (
    <div className="ms-2 d-flex align-items-center">
      <OverlayTrigger
        placement="top"
        overlay={compactMode ? unhideTooltip : tooltip}
      >
        <Button
          variant={compactMode ? "secondary" : "primary"}
          onClick={() => setCompactMode(!compactMode)}
        >
          {compactMode ? " Show Individuals" : "Hide Individuals"}
        </Button>
      </OverlayTrigger>
    </div>
  );
};

export default HideIndividuals;
