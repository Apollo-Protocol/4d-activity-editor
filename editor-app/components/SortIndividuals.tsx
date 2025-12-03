import { Individual, EntityType } from "@/lib/Schema";
import React, { useState, useEffect } from "react";
import { SortableList } from "@/components/SortableList/SortableList";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { Model } from "@/lib/Model";

interface Props {
  dataset: Model;
  updateDataset: (updater: (d: Model) => void) => void;
  showSortIndividuals: boolean;
  setShowSortIndividuals: (show: boolean) => void;
}

const SortIndividuals = (props: Props) => {
  const {
    dataset,
    updateDataset,
    showSortIndividuals,
    setShowSortIndividuals,
  } = props;

  // Only regular Individuals (not System, SC, IC)
  const [sortableItems, setSortableItems] = useState<Individual[]>([]);

  // Items that won't be sorted (hierarchical entities)
  const [fixedItems, setFixedItems] = useState<Individual[]>([]);

  useEffect(() => {
    const sortable: Individual[] = [];
    const fixed: Individual[] = [];

    dataset.individuals.forEach((ind: Individual) => {
      const entityType = ind.entityType ?? EntityType.Individual;

      if (entityType === EntityType.Individual) {
        // Regular individuals can be sorted
        sortable.push(ind);
      } else {
        // Systems, SystemComponents, InstalledComponents maintain hierarchy
        fixed.push(ind);
      }
    });

    setSortableItems(sortable);
    setFixedItems(fixed);
  }, [dataset]);

  const handleClose = () => {
    setShowSortIndividuals(false);
  };

  const handleSave = () => {
    // Rebuild the individuals map preserving the order:
    // 1. Fixed items (Systems, SCs, ICs) in their original order
    // 2. Sortable items (Individuals) in the new user-defined order
    updateDataset((d: Model) => {
      // Clear the existing individuals map
      d.individuals.clear();

      // First add fixed items in their original order
      fixedItems.forEach((ind) => {
        d.individuals.set(ind.id, ind);
      });

      // Then add sortable items in the new order
      sortableItems.forEach((ind) => {
        d.individuals.set(ind.id, ind);
      });
    });
  };

  const handleSaveAndClose = () => {
    handleSave();
    handleClose();
  };

  // Only show button if there are multiple sortable individuals
  const showButton = sortableItems.length > 1;

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setShowSortIndividuals(true)}
        className={showButton ? "mx-1 d-block" : "mx-1 d-none"}
      >
        Sort Entities
      </Button>

      <Modal show={showSortIndividuals} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Sort Individuals</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {sortableItems.length === 0 ? (
            <p className="text-muted text-center">
              No regular Individuals to sort. Systems, System Components, and
              Installed Components are organized hierarchically and cannot be
              manually sorted.
            </p>
          ) : (
            <>
              <p className="text-muted small mb-3">
                Drag to reorder regular Individuals. Systems, System Components,
                and Installed Components maintain their hierarchical order.
              </p>
              <div style={{ maxWidth: 400, margin: "0 auto" }}>
                <SortableList
                  items={sortableItems}
                  onChange={setSortableItems}
                  renderItem={(item) => (
                    <SortableList.Item id={item.id} key={item.id}>
                      <span className="me-2">○</span>
                      {item.name}
                      <SortableList.DragHandle />
                    </SortableList.Item>
                  )}
                />
              </div>
            </>
          )}

          {fixedItems.length > 0 && (
            <div className="mt-4">
              <p className="text-muted small mb-2">
                <strong>Hierarchical entities (not sortable):</strong>
              </p>
              <ul className="list-unstyled text-muted small ps-3">
                {fixedItems.slice(0, 5).map((ind) => {
                  const entityType = ind.entityType ?? EntityType.Individual;
                  let icon = "○";
                  if (entityType === EntityType.System) icon = "▣";
                  else if (entityType === EntityType.SystemComponent)
                    icon = "◇";
                  else if (entityType === EntityType.InstalledComponent)
                    icon = "⬡";

                  return (
                    <li key={ind.id}>
                      <span className="me-2">{icon}</span>
                      {ind.name}
                    </li>
                  );
                })}
                {fixedItems.length > 5 && (
                  <li className="fst-italic">
                    ...and {fixedItems.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={sortableItems.length === 0}
          >
            Save
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveAndClose}
            disabled={sortableItems.length === 0}
          >
            Save & Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SortIndividuals;
