import React, { Dispatch, SetStateAction } from "react";
import Button from "react-bootstrap/Button";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { Model } from "@/lib/Model";
import { Activity, EntityType } from "@/lib/Schema";

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
  // Find all participating individual IDs
  const participating = new Set<string>();
  activitiesInView.forEach((a) =>
    a.participations.forEach((p: any) => participating.add(p.individualId))
  );

  // Check if there are entities that would be hidden
  const hasHideableEntities = (() => {
    const displayIndividuals = dataset.getDisplayIndividuals();

    for (const ind of displayIndividuals) {
      const entityType = ind.entityType ?? EntityType.Individual;
      const isVirtualRow = ind.id.includes("__installed_in__");

      // Top-level SC/IC with installations - always hideable
      if (
        (entityType === EntityType.SystemComponent ||
          entityType === EntityType.InstalledComponent) &&
        !isVirtualRow &&
        ind.installations &&
        ind.installations.length > 0
      ) {
        return true;
      }

      // Virtual row not participating - hideable
      if (isVirtualRow && !participating.has(ind.id)) {
        return true;
      }

      // Regular entity not participating - hideable
      if (!isVirtualRow && !participating.has(ind.id)) {
        return true;
      }
    }
    return false;
  })();

  if (!hasHideableEntities) return null;

  const tooltip = compactMode ? (
    <Tooltip id="show-entities-tooltip">
      Show all entities including those with no activity.
    </Tooltip>
  ) : (
    <Tooltip id="hide-entities-tooltip">
      Hide entities with no activity. Top-level component definitions are always
      hidden when they have installations.
    </Tooltip>
  );

  return (
    <OverlayTrigger placement="top" overlay={tooltip}>
      <Button
        variant={compactMode ? "secondary" : "primary"}
        onClick={() => setCompactMode(!compactMode)}
      >
        {compactMode ? "Show Entities" : "Hide Entities"}
      </Button>
    </OverlayTrigger>
  );
};

export default HideIndividuals;
