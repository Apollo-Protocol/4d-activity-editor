import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Card from "react-bootstrap/Card";
import { Model } from "../lib/Model";
import { EntityType, Individual, Installation } from "../lib/Schema";

interface Props {
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  individual: Individual | undefined;
  setIndividual: (individual: Individual) => void;
  dataset: Model;
}

const EditInstalledComponent = (props: Props) => {
  const { show, setShow, individual, setIndividual, dataset } = props;

  const [installations, setInstallations] = useState<Installation[]>([]);

  // Load installations when modal opens
  useEffect(() => {
    if (show && individual) {
      setInstallations(
        individual.installations ? [...individual.installations] : []
      );
    }
  }, [show, individual]);

  // Get all SystemComponents as potential installation targets
  const availableSlots = useMemo(() => {
    return Array.from(dataset.individuals.values()).filter(
      (i) =>
        (i.entityType ?? EntityType.Individual) === EntityType.SystemComponent
    );
  }, [dataset]);

  // Group slots by their parent system for better UX
  const slotsBySystem = useMemo(() => {
    const groups: Map<
      string,
      { system: Individual | null; slots: Individual[] }
    > = new Map();

    availableSlots.forEach((slot) => {
      const parentId = slot.parentSystemId || "unassigned";
      const parent = slot.parentSystemId
        ? dataset.individuals.get(slot.parentSystemId)
        : null;

      if (!groups.has(parentId)) {
        groups.set(parentId, { system: parent || null, slots: [] });
      }
      groups.get(parentId)!.slots.push(slot);
    });

    return groups;
  }, [availableSlots, dataset]);

  const handleClose = () => {
    setShow(false);
    setInstallations([]);
  };

  const handleSave = () => {
    if (!individual) return;

    const updated: Individual = {
      ...individual,
      installations: installations,
    };

    setIndividual(updated);
    handleClose();
  };

  const addInstallation = () => {
    const newInst: Installation = {
      id: `inst_${Date.now()}`,
      componentId: individual?.id || "",
      targetId: "",
      beginning: 0,
      ending: 10,
    };
    setInstallations([...installations, newInst]);
  };

  const updateInstallation = (
    id: string,
    field: keyof Installation,
    value: any
  ) => {
    setInstallations(
      installations.map((inst) =>
        inst.id === id ? { ...inst, [field]: value } : inst
      )
    );
  };

  const removeInstallation = (id: string) => {
    setInstallations(installations.filter((inst) => inst.id !== id));
  };

  // Get the system name for a given slot
  const getSlotLabel = (slot: Individual): string => {
    if (slot.parentSystemId) {
      const parent = dataset.individuals.get(slot.parentSystemId);
      if (parent) {
        return `${parent.name} → ${slot.name}`;
      }
    }
    return slot.name;
  };

  if (!individual) return null;

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Installation Periods: {individual.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted mb-3">
          Define when and where this physical component is installed. A
          component can be installed into different slots at different times.
        </p>

        {installations.length === 0 ? (
          <div className="text-center py-4 text-muted">
            <p>No installation periods defined.</p>
            <p>This component is currently not installed anywhere.</p>
          </div>
        ) : (
          installations.map((inst, idx) => (
            <Card key={inst.id} className="mb-3">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <strong>Installation {idx + 1}</strong>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => removeInstallation(inst.id)}
                >
                  Remove
                </Button>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label>Install Into Slot</Form.Label>
                  <Form.Select
                    value={inst.targetId}
                    onChange={(e) =>
                      updateInstallation(inst.id, "targetId", e.target.value)
                    }
                  >
                    <option value="">-- Select a slot --</option>
                    {Array.from(slotsBySystem.entries()).map(
                      ([parentId, group]) => (
                        <optgroup
                          key={parentId}
                          label={
                            group.system
                              ? group.system.name
                              : "Unassigned Slots"
                          }
                        >
                          {group.slots.map((slot) => (
                            <option key={slot.id} value={slot.id}>
                              {slot.name}
                            </option>
                          ))}
                        </optgroup>
                      )
                    )}
                  </Form.Select>
                  {inst.targetId && (
                    <Form.Text className="text-muted">
                      Installing into:{" "}
                      {getSlotLabel(
                        availableSlots.find((s) => s.id === inst.targetId)!
                      )}
                    </Form.Text>
                  )}
                </Form.Group>

                <Row>
                  <Col>
                    <Form.Group>
                      <Form.Label>Installed From (time)</Form.Label>
                      <Form.Control
                        type="number"
                        value={inst.beginning}
                        onChange={(e) =>
                          updateInstallation(
                            inst.id,
                            "beginning",
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label>Removed At (time)</Form.Label>
                      <Form.Control
                        type="number"
                        value={inst.ending}
                        onChange={(e) =>
                          updateInstallation(
                            inst.id,
                            "ending",
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          ))
        )}

        <Button variant="outline-primary" onClick={addInstallation}>
          + Add Installation Period
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
