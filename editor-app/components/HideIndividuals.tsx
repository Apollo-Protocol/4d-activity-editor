import React, { Dispatch, SetStateAction } from "react";
import Button from "react-bootstrap/Button";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { Model } from "@/lib/Model";
import { Activity, EntityType, Individual } from "@/lib/Schema";

interface Props {
  compactMode: boolean;
  setCompactMode: Dispatch<SetStateAction<boolean>>;
  dataset: Model;
  activitiesInView: Activity[];
}

/**
 * Determines which individuals should be visible based on activity participation.
 *
 * Rules:
 * 1. If a virtual row (installation) participates, show:
 *    - The virtual row itself
 *    - Its parent System (not the top-level SC/IC definition)
 *    - Any intermediate SystemComponent virtual rows in the hierarchy
 *
 * 2. Top-level SystemComponent and InstalledComponent definitions should be HIDDEN
 *    if they have virtual rows that participate (since the virtual rows are shown instead)
 *
 * 3. Top-level SC/IC definitions should be SHOWN only if:
 *    - They have NO installations at all, OR
 *    - They directly participate (not through virtual rows)
 *
 * 4. Regular Individuals are shown if they participate
 *
 * 5. Systems are shown if any of their children (virtual rows) participate
 */
function getVisibilityInfo(
  participatingIds: Set<string>,
  dataset: Model
): {
  visibleIds: Set<string>;
  hiddenTopLevelIds: Set<string>;
} {
  const visibleIds = new Set<string>();
  const hiddenTopLevelIds = new Set<string>();

  // Track which top-level SC/ICs have participating virtual rows
  const topLevelWithParticipatingVirtualRows = new Set<string>();

  // Track parent Systems that should be visible
  const parentSystemsToShow = new Set<string>();

  // First pass: identify all participating IDs and their relationships
  participatingIds.forEach((id) => {
    if (id.includes("__installed_in__")) {
      // This is a virtual row (installation reference)
      const parts = id.split("__installed_in__");
      const originalId = parts[0];
      const rest = parts[1];
      const targetId = rest.split("__")[0];

      // Mark the virtual row as visible
      visibleIds.add(id);

      // Mark the original top-level component as having participating virtual rows
      topLevelWithParticipatingVirtualRows.add(originalId);

      // Find the parent System to keep visible
      const target = dataset.individuals.get(targetId);
      if (target) {
        const targetType = target.entityType ?? EntityType.Individual;

        if (targetType === EntityType.System) {
          // Direct installation into System - show the System
          parentSystemsToShow.add(targetId);
        } else if (targetType === EntityType.SystemComponent) {
          // Installation into SystemComponent - find the parent System
          if (target.installations) {
            target.installations.forEach((inst) => {
              const parentTarget = dataset.individuals.get(inst.targetId);
              if (parentTarget) {
                const parentType =
                  parentTarget.entityType ?? EntityType.Individual;
                if (parentType === EntityType.System) {
                  parentSystemsToShow.add(inst.targetId);
                  // Also show the intermediate SC virtual row
                  const scVirtualId = `${targetId}__installed_in__${inst.targetId}__${inst.id}`;
                  visibleIds.add(scVirtualId);
                }
              }
            });
          }
        }
      }
    } else {
      // Regular individual or top-level entity participating directly
      visibleIds.add(id);

      // If it's an SC or IC with installations, check if this is direct participation
      const individual = dataset.individuals.get(id);
      if (individual) {
        const entityType = individual.entityType ?? EntityType.Individual;

        if (entityType === EntityType.System) {
          parentSystemsToShow.add(id);
        }
      }
    }
  });

  // Add parent Systems to visible
  parentSystemsToShow.forEach((id) => visibleIds.add(id));

  // Second pass: determine which top-level SC/ICs should be hidden
  dataset.individuals.forEach((ind) => {
    const entityType = ind.entityType ?? EntityType.Individual;

    if (
      entityType === EntityType.SystemComponent ||
      entityType === EntityType.InstalledComponent
    ) {
      // If this SC/IC has participating virtual rows, hide the top-level definition
      if (topLevelWithParticipatingVirtualRows.has(ind.id)) {
        hiddenTopLevelIds.add(ind.id);
        visibleIds.delete(ind.id); // Remove from visible if it was added
      } else if (ind.installations && ind.installations.length > 0) {
        // Has installations but none participate - hide it
        hiddenTopLevelIds.add(ind.id);
      } else if (!participatingIds.has(ind.id)) {
        // No installations and doesn't directly participate - hide it
        hiddenTopLevelIds.add(ind.id);
      }
    }
  });

  return { visibleIds, hiddenTopLevelIds };
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

  // Get visibility information
  const { visibleIds, hiddenTopLevelIds } = getVisibilityInfo(
    participating,
    dataset
  );

  // Check if there are entities that would be hidden
  const hasHideableEntities = (() => {
    const displayIndividuals = dataset.getDisplayIndividuals();

    for (const ind of displayIndividuals) {
      // Skip if already visible
      if (visibleIds.has(ind.id)) continue;

      // Check if this is a virtual row
      if (ind.id.includes("__installed_in__")) {
        // Virtual row not participating - can be hidden
        return true;
      }

      const entityType = ind.entityType ?? EntityType.Individual;

      // Top-level SC/IC with participating virtual rows - should be hidden
      if (hiddenTopLevelIds.has(ind.id)) {
        return true;
      }

      // Regular individual or System not participating
      if (!participating.has(ind.id)) {
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
      Hide entities with no activity. Top-level component definitions are hidden
      when their installations participate.
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
