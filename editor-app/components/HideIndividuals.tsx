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

// Helper to get parent IDs that should be kept visible (bottom-to-top only)
// When a CHILD has activity, keep its PARENTS visible
// But NOT the reverse - if only parent has activity, don't automatically keep children
function getParentIdsToKeep(
  participatingIds: Set<string>,
  dataset: Model
): Set<string> {
  const parentsToKeep = new Set<string>();

  participatingIds.forEach((id) => {
    // Check if this is a virtual row (installation reference)
    if (id.includes("__installed_in__")) {
      const parts = id.split("__installed_in__");
      const rest = parts[1];
      const targetId = rest.split("__")[0];

      // Virtual row has activity - keep its target (parent) visible
      parentsToKeep.add(targetId);

      // If target is a SystemComponent, also keep its parent System
      const target = dataset.individuals.get(targetId);
      if (target) {
        const targetType = target.entityType ?? EntityType.Individual;
        if (targetType === EntityType.SystemComponent && target.installations) {
          target.installations.forEach((inst) => {
            if (inst.targetId) {
              parentsToKeep.add(inst.targetId);
            }
          });
        }
      }
    } else {
      // Regular individual - check if it's an InstalledComponent or SystemComponent
      const individual = dataset.individuals.get(id);
      if (individual) {
        const entityType = individual.entityType ?? EntityType.Individual;

        if (entityType === EntityType.InstalledComponent) {
          // InstalledComponent has activity - keep parent SystemComponents and their parent Systems
          if (individual.installations) {
            individual.installations.forEach((inst) => {
              if (inst.targetId) {
                parentsToKeep.add(inst.targetId);

                // Get the SystemComponent's parent System
                const sc = dataset.individuals.get(inst.targetId);
                if (sc && sc.installations) {
                  sc.installations.forEach((scInst) => {
                    if (scInst.targetId) {
                      parentsToKeep.add(scInst.targetId);
                    }
                  });
                }
              }
            });
          }
        } else if (entityType === EntityType.SystemComponent) {
          // SystemComponent has activity - keep parent Systems
          if (individual.installations) {
            individual.installations.forEach((inst) => {
              if (inst.targetId) {
                parentsToKeep.add(inst.targetId);
              }
            });
          }
        }
        // Note: If a System has activity, we do NOT automatically keep its children
        // This is the "bottom-to-top only" behavior
      }
    }
  });

  return parentsToKeep;
}

// Helper to check what should be visible
function getVisibleIds(
  participatingIds: Set<string>,
  parentsToKeep: Set<string>,
  dataset: Model
): Set<string> {
  const visible = new Set<string>();

  // Add all direct participants
  participatingIds.forEach((id) => visible.add(id));

  // Add parents that should be kept
  parentsToKeep.forEach((id) => visible.add(id));

  return visible;
}

const HideIndividuals = ({
  compactMode,
  setCompactMode,
  dataset,
  activitiesInView,
}: Props) => {
  // Find all participating individual IDs (direct participants only)
  const participating = new Set<string>();
  activitiesInView.forEach((a) =>
    a.participations.forEach((p: any) => participating.add(p.individualId))
  );

  // Get parent IDs that should also be kept visible (bottom-to-top only)
  const parentsToKeep = getParentIdsToKeep(participating, dataset);

  // Get all IDs that should be visible
  const visibleIds = getVisibleIds(participating, parentsToKeep, dataset);

  // Find if there are entities with no activity in the current view
  const hasInactiveEntities = (() => {
    for (const i of Array.from(dataset.individuals.values())) {
      // Check if this entity should be hidden
      if (!visibleIds.has(i.id)) {
        // For virtual rows, check if original participates
        if (i.id.includes("__installed_in__")) {
          const parts = i.id.split("__installed_in__");
          const originalId = parts[0];
          if (!participating.has(originalId) && !participating.has(i.id)) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
    return false;
  })();

  if (!hasInactiveEntities) return null;

  const tooltip = compactMode ? (
    <Tooltip id="show-entities-tooltip">
      This will show entities with no activity.
    </Tooltip>
  ) : (
    <Tooltip id="hide-entities-tooltip">
      This will hide entities with no activity.
    </Tooltip>
  );

  return (
    <div className="ms-2 d-flex align-items-center">
      <OverlayTrigger placement="top" overlay={tooltip}>
        <Button
          variant={compactMode ? "secondary" : "primary"}
          onClick={() => setCompactMode(!compactMode)}
        >
          {compactMode ? "Show Entities" : "Hide Entities"}
        </Button>
      </OverlayTrigger>
    </div>
  );
};

export default HideIndividuals;
