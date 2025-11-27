import React, { useState, useEffect } from "react";
import { Button, Modal, Form, Table, Alert } from "react-bootstrap";
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
  // Optional: specific slot ID to filter installations (when clicking on an installed component row)
  targetSlotId?: string;
}

const EditInstalledComponent = (props: Props) => {
  const {
    show,
    setShow,
    individual,
    setIndividual,
    dataset,
    updateDataset,
    targetSlotId,
  } = props;

  const [localInstallations, setLocalInstallations] = useState<Installation[]>(
    []
  );
  const [allInstallations, setAllInstallations] = useState<Installation[]>([]);

  // Track removed installations to clean up participations on save
  const [removedInstallations, setRemovedInstallations] = useState<
    Installation[]
  >([]);

  // Validation errors
  const [errors, setErrors] = useState<string[]>([]);

  // Track raw input values for better UX (allows empty fields while typing)
  const [rawInputs, setRawInputs] = useState<
    Map<string, { beginning: string; ending: string }>
  >(new Map());

  // Whether we're showing all installations or just filtered ones
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (individual && individual.installations) {
      const allInst = [...individual.installations];
      setAllInstallations(allInst);

      // If a specific slot is targeted, filter to just installations for that slot
      if (targetSlotId) {
        const filtered = allInst.filter(
          (inst) => inst.targetId === targetSlotId
        );
        setLocalInstallations(filtered);
        setShowAll(false);
      } else {
        setLocalInstallations(allInst);
        setShowAll(true);
      }

      // Initialize raw inputs for all installations
      const inputs = new Map<string, { beginning: string; ending: string }>();
      allInst.forEach((inst) => {
        inputs.set(inst.id, {
          beginning: String(inst.beginning ?? 0),
          ending: String(inst.ending ?? 10),
        });
      });
      setRawInputs(inputs);
    } else {
      setLocalInstallations([]);
      setAllInstallations([]);
      setRawInputs(new Map());
      setShowAll(!targetSlotId);
    }
    setRemovedInstallations([]);
    setErrors([]);
  }, [individual, show, targetSlotId]);

  const handleClose = () => {
    setShow(false);
    setRemovedInstallations([]);
    setErrors([]);
    setShowAll(false);
  };

  const validateInstallations = (): boolean => {
    const newErrors: string[] = [];

    localInstallations.forEach((inst, idx) => {
      const raw = rawInputs.get(inst.id);
      const beginningStr = raw?.beginning ?? String(inst.beginning);
      const endingStr = raw?.ending ?? String(inst.ending);

      const slotName = getSlotName(inst.targetId) || `Row ${idx + 1}`;

      if (!inst.targetId) {
        newErrors.push(`${slotName}: Please select a target slot.`);
      }

      if (beginningStr.trim() === "") {
        newErrors.push(`${slotName}: "From" time is required.`);
      }

      if (endingStr.trim() === "") {
        newErrors.push(`${slotName}: "Until" time is required.`);
      }

      const beginning = parseInt(beginningStr, 10);
      const ending = parseInt(endingStr, 10);

      if (!isNaN(beginning) && !isNaN(ending)) {
        if (beginning < 0) {
          newErrors.push(`${slotName}: "From" cannot be negative.`);
        }
        if (ending < 1) {
          newErrors.push(`${slotName}: "Until" must be at least 1.`);
        }
        if (beginning >= ending) {
          newErrors.push(`${slotName}: "From" must be less than "Until".`);
        }
      }
    });

    // Check for overlapping periods in the same slot
    const bySlot = new Map<string, Installation[]>();
    localInstallations.forEach((inst) => {
      if (!inst.targetId) return;
      const raw = rawInputs.get(inst.id);
      const beginning = parseInt(raw?.beginning ?? String(inst.beginning), 10);
      const ending = parseInt(raw?.ending ?? String(inst.ending), 10);
      if (isNaN(beginning) || isNaN(ending)) return;

      const list = bySlot.get(inst.targetId) || [];
      list.push({ ...inst, beginning, ending });
      bySlot.set(inst.targetId, list);
    });

    bySlot.forEach((installations, slotId) => {
      if (installations.length < 2) return;
      const slotName = getSlotName(slotId);

      // Sort by beginning time
      installations.sort((a, b) => a.beginning - b.ending);

      for (let i = 0; i < installations.length - 1; i++) {
        const current = installations[i];
        const next = installations[i + 1];
        if (current.ending > next.beginning) {
          newErrors.push(
            `${slotName}: Periods overlap (${current.beginning}-${current.ending} and ${next.beginning}-${next.ending}).`
          );
        }
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (!individual) return;

    if (!validateInstallations()) {
      return;
    }

    // Parse raw inputs into final values
    const updatedInstallations = localInstallations.map((inst) => {
      const raw = rawInputs.get(inst.id);
      return {
        ...inst,
        beginning: parseInt(raw?.beginning ?? String(inst.beginning), 10) || 0,
        ending: parseInt(raw?.ending ?? String(inst.ending), 10) || 10,
      };
    });

    // Merge with existing installations
    let finalInstallations: Installation[];

    if (targetSlotId && !showAll) {
      // We're editing installations for a specific slot only
      // Keep installations for OTHER slots, add/update installations for THIS slot
      const keptFromOtherSlots = allInstallations.filter(
        (i) => i.targetId !== targetSlotId
      );

      // Remove any that were marked for removal
      const removedIds = new Set(removedInstallations.map((i) => i.id));
      const filteredUpdated = updatedInstallations.filter(
        (i) => !removedIds.has(i.id)
      );

      finalInstallations = [...keptFromOtherSlots, ...filteredUpdated];
    } else {
      // We're showing all, so just use the updated list (minus removed)
      const removedIds = new Set(removedInstallations.map((i) => i.id));
      finalInstallations = updatedInstallations.filter(
        (i) => !removedIds.has(i.id)
      );
    }

    console.log("Saving installations:", finalInstallations);

    if (updateDataset) {
      updateDataset((d: Model) => {
        // Clean up participations for removed installations
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

        const updated: Individual = {
          ...individual,
          installations: finalInstallations,
        };
        d.addIndividual(updated);
      });
    } else {
      const updated: Individual = {
        ...individual,
        installations: finalInstallations,
      };
      setIndividual(updated);
    }

    handleClose();
  };

  const addInstallation = () => {
    // When adding a new installation, use the targetSlotId if we're in filtered mode
    const newInst: Installation = {
      id: uuidv4(),
      componentId: individual?.id || "",
      targetId: targetSlotId || "", // Pre-fill with current slot if filtering
      beginning: 0,
      ending: 10,
    };

    console.log("Adding new installation:", newInst);

    setLocalInstallations((prev) => [...prev, newInst]);
    setRawInputs((prev) => {
      const next = new Map(prev);
      next.set(newInst.id, { beginning: "0", ending: "10" });
      return next;
    });
  };

  const removeInstallation = (instId: string) => {
    const removed = localInstallations.find((inst) => inst.id === instId);
    if (removed) {
      setRemovedInstallations((prev) => [...prev, removed]);
    }
    setLocalInstallations((prev) => prev.filter((inst) => inst.id !== instId));
    setRawInputs((prev) => {
      const next = new Map(prev);
      next.delete(instId);
      return next;
    });
    setErrors([]);
  };

  const updateInstallation = (
    instId: string,
    field: keyof Installation,
    value: any
  ) => {
    setLocalInstallations((prev) =>
      prev.map((inst) =>
        inst.id === instId ? { ...inst, [field]: value } : inst
      )
    );
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const updateRawInput = (
    instId: string,
    field: "beginning" | "ending",
    value: string
  ) => {
    setRawInputs((prev) => {
      const next = new Map(prev);
      const current = next.get(instId) || { beginning: "0", ending: "10" };
      next.set(instId, { ...current, [field]: value });
      return next;
    });

    if (value !== "") {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        updateInstallation(instId, field, parsed);
      }
    }

    if (errors.length > 0) {
      setErrors([]);
    }
  };

  // Get available slots (SystemComponents)
  const availableSlots = Array.from(dataset.individuals.values()).filter(
    (ind) =>
      (ind.entityType ?? EntityType.Individual) === EntityType.SystemComponent
  );

  // Helper to get slot name with parent
  const getSlotName = (slotId: string): string => {
    if (!slotId) return "";
    const slot = availableSlots.find((s) => s.id === slotId);
    if (!slot) return slotId;
    if (slot.parentSystemId) {
      const parent = dataset.individuals.get(slot.parentSystemId);
      if (parent) return `${parent.name} → ${slot.name}`;
    }
    return slot.name;
  };

  if (!individual) return null;

  const isFiltered = !!targetSlotId && !showAll;
  const totalInstallations = allInstallations.length;
  const slotName = targetSlotId ? getSlotName(targetSlotId) : "";

  const modalTitle = isFiltered
    ? `Edit Installation: ${individual.name} in ${slotName}`
    : `Edit All Installations: ${individual.name}`;

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{modalTitle}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {isFiltered && totalInstallations > localInstallations.length && (
          <div className="mb-3">
            <Button
              variant="link"
              size="sm"
              className="p-0"
              onClick={() => {
                setLocalInstallations([...allInstallations]);
                setShowAll(true);
              }}
            >
              ← Show all {totalInstallations} installations
            </Button>
          </div>
        )}

        <p className="text-muted mb-3">
          {isFiltered
            ? `Manage installation periods for this component in "${slotName}". You can have multiple non-overlapping periods (e.g., installed from 0-5, removed, then reinstalled from 8-15).`
            : "Manage all installation periods for this component across different slots."}
        </p>

        {localInstallations.length === 0 ? (
          <div className="text-center py-4 border rounded bg-light">
            <p className="text-muted mb-3">
              No installations configured.
              {isFiltered
                ? ` Add a period when this component is installed in "${slotName}".`
                : " Add an installation to place this component in a slot."}
            </p>
            <Button variant="primary" onClick={addInstallation}>
              + Add Installation Period
            </Button>
          </div>
        ) : (
          <>
            <Table bordered hover responsive size="sm">
              <thead className="table-light">
                <tr>
                  <th style={{ width: "5%" }} className="text-center">
                    #
                  </th>
                  {!isFiltered && (
                    <th style={{ width: "35%" }}>
                      Target Slot <span className="text-danger">*</span>
                    </th>
                  )}
                  <th style={{ width: isFiltered ? "30%" : "20%" }}>
                    From <span className="text-danger">*</span>
                  </th>
                  <th style={{ width: isFiltered ? "30%" : "20%" }}>
                    Until <span className="text-danger">*</span>
                  </th>
                  <th
                    style={{ width: isFiltered ? "35%" : "20%" }}
                    className="text-center"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {localInstallations.map((inst, idx) => {
                  const raw = rawInputs.get(inst.id) || {
                    beginning: String(inst.beginning),
                    ending: String(inst.ending),
                  };

                  return (
                    <tr key={inst.id}>
                      <td className="text-center text-muted">{idx + 1}</td>
                      {!isFiltered && (
                        <td>
                          <Form.Select
                            size="sm"
                            value={inst.targetId}
                            onChange={(e) =>
                              updateInstallation(
                                inst.id,
                                "targetId",
                                e.target.value
                              )
                            }
                            className={!inst.targetId ? "border-warning" : ""}
                          >
                            <option value="">-- Select slot --</option>
                            {availableSlots.map((slot) => {
                              let parentName = "";
                              if (slot.parentSystemId) {
                                const parent = dataset.individuals.get(
                                  slot.parentSystemId
                                );
                                if (parent) parentName = parent.name + " → ";
                              }
                              return (
                                <option key={slot.id} value={slot.id}>
                                  {parentName}
                                  {slot.name}
                                </option>
                              );
                            })}
                          </Form.Select>
                        </td>
                      )}
                      <td>
                        <Form.Control
                          type="number"
                          size="sm"
                          min="0"
                          value={raw.beginning}
                          onChange={(e) =>
                            updateRawInput(inst.id, "beginning", e.target.value)
                          }
                          placeholder="0"
                          className={
                            raw.beginning === "" ? "border-warning" : ""
                          }
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          size="sm"
                          min="1"
                          value={raw.ending}
                          onChange={(e) =>
                            updateRawInput(inst.id, "ending", e.target.value)
                          }
                          placeholder="10"
                          className={raw.ending === "" ? "border-warning" : ""}
                        />
                      </td>
                      <td className="text-center">
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => removeInstallation(inst.id)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            <div className="mt-3">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={addInstallation}
              >
                + Add Another Period
              </Button>
            </div>
          </>
        )}

        {availableSlots.length === 0 && !isFiltered && (
          <Alert variant="warning" className="mt-3 mb-0">
            No slots available. Create a System Component first to define slots.
          </Alert>
        )}

        {errors.length > 0 && (
          <Alert variant="danger" className="mt-3 mb-0">
            <strong>Please fix the following:</strong>
            <ul className="mb-0 mt-2 ps-3">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <div className="text-muted small">
          {isFiltered
            ? `${localInstallations.length} period${
                localInstallations.length !== 1 ? "s" : ""
              } in this slot`
            : `${localInstallations.length} total installation${
                localInstallations.length !== 1 ? "s" : ""
              }`}
        </div>
        <div className="d-flex gap-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default EditInstalledComponent;
