import { Individual } from "@/lib/Schema";
import React, { useState, useEffect } from "react";
import { SortableList } from "@/components/SortableList/SortableList";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import DraggableModalDialog from "@/components/DraggableModalDialog";
import { ENTITY_TYPE_IDS, getEntityTypeIdFromIndividual } from "@/lib/entityTypes";

const SortIndividuals = (props: any) => {
  const {
    dataset,
    updateDataset,
    showSortIndividuals,
    setShowSortIndividuals,
  } = props;
  const [items, setItems] = useState<Individual[]>([]);

  const normalizeSystemComponentGrouping = (nextItems: Individual[]) => {
    const systems = new Set(
      nextItems
        .filter(
          (item) => getEntityTypeIdFromIndividual(item) === ENTITY_TYPE_IDS.SYSTEM
        )
        .map((item) => item.id)
    );

    const componentsBySystem = new Map<string, Individual[]>();
    nextItems.forEach((item) => {
      if (getEntityTypeIdFromIndividual(item) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        return;
      }
      if (!item.installedIn || !systems.has(item.installedIn)) {
        return;
      }

      const list = componentsBySystem.get(item.installedIn);
      if (list) {
        list.push(item);
      } else {
        componentsBySystem.set(item.installedIn, [item]);
      }
    });

    const normalized: Individual[] = [];
    const emitted = new Set<string>();

    nextItems.forEach((item) => {
      if (emitted.has(item.id)) {
        return;
      }

      const type = getEntityTypeIdFromIndividual(item);
      if (
        type === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
        item.installedIn &&
        systems.has(item.installedIn)
      ) {
        return;
      }

      normalized.push(item);
      emitted.add(item.id);

      if (type === ENTITY_TYPE_IDS.SYSTEM) {
        const children = componentsBySystem.get(item.id) ?? [];
        children.forEach((child) => {
          if (emitted.has(child.id)) {
            return;
          }
          normalized.push(child);
          emitted.add(child.id);
        });
      }
    });

    return normalized;
  };

  useEffect(() => {
    const individualsArray: Individual[] = [];
    dataset.individuals.forEach((i: Individual) => individualsArray.push(i));
    setItems(individualsArray);
  }, [dataset]);

  const handleClose = () => {
    setShowSortIndividuals(false);
  };

  const handleSave = () => {
    let individualsMap = new Map();
    normalizeSystemComponentGrouping(items).forEach((i) => {
      individualsMap.set(i.id, i);
    });
    updateDataset((d: any) => (d.individuals = individualsMap));
  };

  const handleSaveAndClose = () => {
    handleSave();
    handleClose();
  };

  const canReorderIndividuals = (activeItem: Individual, overItem: Individual) => {
    const activeType = getEntityTypeIdFromIndividual(activeItem);
    if (activeType !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
      return true;
    }

    const overType = getEntityTypeIdFromIndividual(overItem);
    if (overType === ENTITY_TYPE_IDS.SYSTEM) {
      return !!activeItem.installedIn && activeItem.installedIn === overItem.id;
    }

    if (overType !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
      return false;
    }

    return !!activeItem.installedIn && activeItem.installedIn === overItem.installedIn;
  };

  return (
    <>
      {false && (
        <Button
          variant="secondary"
          onClick={() => setShowSortIndividuals(true)}
          className={items.length > 1 ? "mx-1 d-block" : "mx-1 d-none"}
        >
          Sort Entities
        </Button>
      )}

      <Modal dialogAs={DraggableModalDialog} show={showSortIndividuals} onHide={handleClose} scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Sort Entities</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ maxWidth: 400, margin: "10px auto" }}>
            <SortableList
              items={items}
              onChange={(next) => setItems(normalizeSystemComponentGrouping(next))}
              canReorder={canReorderIndividuals}
              renderItem={(item) => (
                <SortableList.Item id={item.id} key={item.id}>
                  <div
                    style={{
                      marginLeft:
                        getEntityTypeIdFromIndividual(item) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT
                          ? "2rem"
                          : "0",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: getEntityTypeIdFromIndividual(item) === ENTITY_TYPE_IDS.SYSTEM ? "bold" : "normal" }}>
                      {item.name}
                    </span>
                  </div>
                  <SortableList.DragHandle />
                </SortableList.Item>
              )}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
          <Button variant="primary" onClick={handleSaveAndClose}>
            Save & Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SortIndividuals;
