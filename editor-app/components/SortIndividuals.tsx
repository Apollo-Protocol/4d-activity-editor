import { Individual } from "@/lib/Schema";
import React, { useState, useEffect } from "react";
import { SortableList } from "@/components/SortableList/SortableList";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";

const SortIndividuals = (props: any) => {
  const {
    dataset,
    updateDataset,
    showSortIndividuals,
    setShowSortIndividuals,
  } = props;
  const [items, setItems] = useState<Individual[]>([]);

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
    items.forEach((i) => {
      individualsMap.set(i.id, i);
    });
    updateDataset((d: any) => (d.individuals = individualsMap));
  };

  const handleSaveAndClose = () => {
    handleSave();
    handleClose();
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setShowSortIndividuals(true)}
        className={items.length > 1 ? "mx-1 d-block" : "mx-1 d-none"}
      >
        Sort Individuals
      </Button>

      <Modal show={showSortIndividuals} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Sort Individuals</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ maxWidth: 400, margin: "30px auto" }}>
            <SortableList
              items={items}
              onChange={setItems}
              renderItem={(item) => (
                <SortableList.Item id={item.id} key={item.id}>
                  {item.name}
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
