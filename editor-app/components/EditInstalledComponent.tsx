import React, { useState, useEffect } from "react";
import { Button, Modal, Form, Row, Col, Card } from "react-bootstrap";
import { v4 as uuidv4 } from "uuid";
import { Individual, Installation, EntityType } from "@/lib/Schema";
import { Model } from "@/lib/Model";

interface Props {
  show: boolean;
  setShow: (show: boolean) => void;
  individual: Individual | undefined;
  setIndividual: (individual: Individual) => void;
  dataset: Model;
  updateDataset?: (updater: (d: Model) => void) => void;
}

const EditInstalledComponent = (props: Props) => {
  const { show, setShow, individual, setIndividual, dataset, updateDataset } =
    props;

  const [localInstallations, setLocalInstallations] = useState<Installation[]>(
    []
  );

  // Track removed installations to clean up participations on save
  const [removedInstallations, setRemovedInstallations] = useState<
    Installation[]
  >([]);

  useEffect(() => {
    if (individual && individual.installations) {
      setLocalInstallations([...individual.installations]);
    } else {
      setLocalInstallations([]);
    }
    setRemovedInstallations([]);
  }, [individual, show]);

  const handleClose = () => {
    setShow(false);
    setRemovedInstallations([]);
  };

  const handleSave = () => {
    if (!individual) return;

    // If we have updateDataset, use it to clean up participations for removed installations
    if (updateDataset && removedInstallations.length > 0) {
      updateDataset((d: Model) => {
        // Clean up participations for each removed installation
        removedInstallations.forEach((removedInst) => {
          const participationKey = `${individual.id}__installed_in__${removedInst.targetId}`;

          const activitiesToDelete: string[] = [];
          d.activities.forEach((activity) => {
            const parts = activity.participations;
            if (!parts) return;

            if (parts instanceof Map) {
              if (parts.has(participationKey)) {
                parts.delete(participationKey);
                d.activities.set(activity.id, activity);
              }
              if (parts.size === 0) activitiesToDelete.push(activity.id);
            }
          });

          activitiesToDelete.forEach((aid) => d.activities.delete(aid));
        });

        // Update the individual with new installations
        const updated: Individual = {
          ...individual,
          installations: localInstallations,
        };
        d.addIndividual(updated);
      });
    } else {
      // Fallback: just update the individual
      const updated: Individual = {
        ...individual,
        installations: localInstallations,
      };
      setIndividual(updated);
    }

    handleClose();
  };

  const addInstallation = () => {
    const newInst: Installation = {
      id: uuidv4(),
      componentId: individual?.id || "",
      targetId: "",
      beginning: 0,
      ending: 10,
    };
    setLocalInstallations([...localInstallations, newInst]);
  };

  const removeInstallation = (instId: string) => {
    const removed = localInstallations.find((inst) => inst.id === instId);
    if (removed) {
      setRemovedInstallations([...removedInstallations, removed]);
    }
    setLocalInstallations(
      localInstallations.filter((inst) => inst.id !== instId)
    );
  };

  const updateInstallation = (
    instId: string,
    field: keyof Installation,
    value: any
  ) => {
    setLocalInstallations(
      localInstallations.map((inst) =>
        inst.id === instId ? { ...inst, [field]: value } : inst
      )
    );
  };

  // Get available slots (SystemComponents)
  const availableSlots = Array.from(dataset.individuals.values()).filter(
    (ind) =>
      (ind.entityType ?? EntityType.Individual) === EntityType.SystemComponent
  );

  if (!individual) return null;

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Edit Installed Component: {individual.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted">
          Manage where this component is installed and for what time periods.
        </p>

        {localInstallations.length === 0 && (
          <div className="alert alert-info">
            No installations yet. Click "Add Installation" to install this
            component into a slot.
          </div>
        )}

        {localInstallations.map((inst, idx) => (
          <Card key={inst.id} className="mb-3">
            <Card.Body>
              <Row className="align-items-end">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Target Slot</Form.Label>
                    <Form.Select
                      value={inst.targetId}
                      onChange={(e) =>
                        updateInstallation(inst.id, "targetId", e.target.value)
                      }
                    >
                      <option value="">Select Slot</option>
                      {availableSlots.map((slot) => {
                        // Find parent system name
                        let parentName = "";
                        if (slot.parentSystemId) {
                          const parent = dataset.individuals.get(
                            slot.parentSystemId
                          );
                          if (parent) parentName = parent.name + " - ";
                        }
                        return (
                          <option key={slot.id} value={slot.id}>
                            {parentName}
                            {slot.name}
                          </option>
                        );
                      })}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Installed From (time)</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={inst.beginning}
                      onChange={(e) =>
                        updateInstallation(
                          inst.id,
                          "beginning",
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        )
                      }
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Removed At (time)</Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      value={inst.ending}
                      onChange={(e) =>
                        updateInstallation(
                          inst.id,
                          "ending",
                          Math.max(1, parseInt(e.target.value, 10) || 1)
                        )
                      }
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => removeInstallation(inst.id)}
                  >
                    Remove
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        ))}

        <Button variant="outline-primary" onClick={addInstallation}>
          + Add Installation
        </Button>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EditInstalledComponent;
