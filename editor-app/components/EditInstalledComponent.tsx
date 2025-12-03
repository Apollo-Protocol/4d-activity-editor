import React, { useState, useEffect, useMemo } from "react";
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
  targetSlotId?: string;
  targetSystemId?: string;
}

// Interface for slot options that includes nesting info
interface SlotOption {
  id: string;
  virtualId: string;
  displayName: string;
  bounds: { beginning: number; ending: number };
  parentPath: string;
  nestingLevel: number;
  systemName?: string;
  scInstallationId?: string;
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
    targetSystemId,
  } = props;

  const [localInstallations, setLocalInstallations] = useState<Installation[]>(
    []
  );
  const [allInstallations, setAllInstallations] = useState<Installation[]>([]);
  const [removedInstallations, setRemovedInstallations] = useState<
    Installation[]
  >([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [rawInputs, setRawInputs] = useState<
    Map<string, { beginning: string; ending: string }>
  >(new Map());
  const [showAll, setShowAll] = useState(false);

  // Get available slots
  const availableSlots = useMemo((): SlotOption[] => {
    const slots: SlotOption[] = [];
    const displayIndividuals = dataset.getDisplayIndividuals();

    displayIndividuals.forEach((ind) => {
      if (!ind._isVirtualRow) return;

      const originalId = ind.id.split("__installed_in__")[0];
      const original = dataset.individuals.get(originalId);
      if (!original) return;

      const origType = original.entityType ?? EntityType.Individual;
      if (origType !== EntityType.SystemComponent) return;

      const pathParts = ind._parentPath?.split("__") || [];
      const pathNames: string[] = [];

      pathParts.forEach((partId) => {
        const part = dataset.individuals.get(partId);
        if (part) {
          pathNames.push(part.name);
        }
      });

      const hierarchyStr =
        pathNames.length > 0 ? pathNames.join(" → ") : "Unknown";
      const displayName = `${ind.name} (in ${hierarchyStr})`;
      const scInstallationId = ind._installationId;

      slots.push({
        id: originalId,
        virtualId: ind.id,
        displayName: displayName,
        bounds: { beginning: ind.beginning, ending: ind.ending },
        parentPath: ind._parentPath || "",
        nestingLevel: ind._nestingLevel || 1,
        systemName: pathNames[0],
        scInstallationId: scInstallationId,
      });
    });

    slots.sort((a, b) => {
      if (a.systemName !== b.systemName) {
        return (a.systemName || "").localeCompare(b.systemName || "");
      }
      if (a.parentPath !== b.parentPath) {
        if (a.parentPath.startsWith(b.parentPath + "__")) return 1;
        if (b.parentPath.startsWith(a.parentPath + "__")) return -1;
        return a.parentPath.localeCompare(b.parentPath);
      }
      if (a.nestingLevel !== b.nestingLevel) {
        return a.nestingLevel - b.nestingLevel;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    return slots;
  }, [dataset]);

  const slotsBySystem = useMemo(() => {
    const groups = new Map<string, SlotOption[]>();
    availableSlots.forEach((slot) => {
      const sysName = slot.systemName || "Unknown";
      if (!groups.has(sysName)) {
        groups.set(sysName, []);
      }
      groups.get(sysName)!.push(slot);
    });
    return groups;
  }, [availableSlots]);

  const getSlotOptionByVirtualId = (
    virtualId: string
  ): SlotOption | undefined => {
    return availableSlots.find((slot) => slot.virtualId === virtualId);
  };

  const getSlotOption = (
    targetId: string,
    scInstContextId?: string
  ): SlotOption | undefined => {
    return availableSlots.find((slot) => {
      if (slot.id !== targetId) return false;
      if (scInstContextId) {
        return slot.scInstallationId === scInstContextId;
      }
      return true;
    });
  };

  const getSlotTimeBounds = (
    slotId: string,
    scInstContextId?: string
  ): { beginning: number; ending: number; slotName: string } => {
    const slotOption = getSlotOption(slotId, scInstContextId);
    if (slotOption) {
      return {
        beginning: slotOption.bounds.beginning,
        ending: slotOption.bounds.ending,
        slotName: slotOption.displayName,
      };
    }

    const slot = dataset.individuals.get(slotId);
    if (!slot) {
      return { beginning: 0, ending: Model.END_OF_TIME, slotName: slotId };
    }

    let beginning = slot.beginning;
    let ending = slot.ending;

    if (slot.installations && slot.installations.length > 0) {
      const instBeginnings = slot.installations.map((inst) =>
        Math.max(0, inst.beginning ?? 0)
      );
      const instEndings = slot.installations.map(
        (inst) => inst.ending ?? Model.END_OF_TIME
      );
      beginning = Math.min(...instBeginnings);
      ending = Math.max(...instEndings);
    }

    if (beginning < 0) beginning = 0;

    return { beginning, ending, slotName: slot.name };
  };

  useEffect(() => {
    if (individual && individual.installations) {
      const allInst = [...individual.installations];
      setAllInstallations(allInst);

      if (targetSlotId) {
        let filtered = allInst.filter((inst) => inst.targetId === targetSlotId);
        if (targetSystemId) {
          filtered = filtered.filter(
            (inst) =>
              !inst.systemContextId || inst.systemContextId === targetSystemId
          );
        }
        setLocalInstallations(filtered);
        setShowAll(false);
      } else {
        setLocalInstallations(allInst);
        setShowAll(true);
      }

      const inputs = new Map<string, { beginning: string; ending: string }>();
      allInst.forEach((inst) => {
        inputs.set(inst.id, {
          beginning: String(inst.beginning ?? 0),
          // Use empty string for undefined/END_OF_TIME to show placeholder
          ending:
            inst.ending === undefined || inst.ending >= Model.END_OF_TIME
              ? ""
              : String(inst.ending),
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
  }, [individual, show, targetSlotId, targetSystemId]);

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
      const endingStr = raw?.ending ?? "";

      const slotInfo = inst.targetId
        ? getSlotTimeBounds(inst.targetId, inst.scInstallationContextId)
        : {
            beginning: 0,
            ending: Model.END_OF_TIME,
            slotName: `Row ${idx + 1}`,
          };
      const slotName = slotInfo.slotName;

      if (!inst.targetId) {
        newErrors.push(`Row ${idx + 1}: Please select a target slot.`);
        return;
      }

      if (beginningStr.trim() === "") {
        newErrors.push(`${slotName}: "From" time is required.`);
      }

      // "Until" is now optional - empty means inherit from parent

      const beginning = parseInt(beginningStr, 10);
      // Parse ending: empty string means inherit from parent slot
      const ending =
        endingStr.trim() === "" ? slotInfo.ending : parseInt(endingStr, 10);

      if (!isNaN(beginning)) {
        if (beginning < 0) {
          newErrors.push(`${slotName}: "From" cannot be negative.`);
        }

        if (beginning < slotInfo.beginning) {
          newErrors.push(
            `${slotName}: "From" (${beginning}) cannot be before slot starts (${slotInfo.beginning}).`
          );
        }
      }

      if (endingStr.trim() !== "" && !isNaN(ending)) {
        if (ending < 1) {
          newErrors.push(`${slotName}: "Until" must be at least 1.`);
        }
        if (!isNaN(beginning) && beginning >= ending) {
          newErrors.push(`${slotName}: "From" must be less than "Until".`);
        }
        // Allow ending to be equal to slot ending (changed from > to >)
        if (slotInfo.ending < Model.END_OF_TIME && ending > slotInfo.ending) {
          newErrors.push(
            `${slotName}: "Until" (${ending}) cannot be after slot ends (${slotInfo.ending}).`
          );
        }
      }
    });

    // Check for overlapping periods in the same slot AND same context
    const bySlotAndContext = new Map<string, Installation[]>();
    localInstallations.forEach((inst) => {
      if (!inst.targetId) return;
      const raw = rawInputs.get(inst.id);
      const beginning = parseInt(raw?.beginning ?? String(inst.beginning), 10);
      const endingStr = raw?.ending ?? "";

      // Get slot bounds for this installation
      const slotInfo = getSlotTimeBounds(
        inst.targetId,
        inst.scInstallationContextId
      );
      // If ending is empty, use slot ending
      const ending =
        endingStr.trim() === "" ? slotInfo.ending : parseInt(endingStr, 10);
      if (isNaN(beginning)) return;

      const key = `${inst.targetId}__${inst.scInstallationContextId || "any"}`;
      const list = bySlotAndContext.get(key) || [];
      list.push({ ...inst, beginning, ending });
      bySlotAndContext.set(key, list);
    });

    bySlotAndContext.forEach((installations, key) => {
      if (installations.length < 2) return;
      const [slotId, contextId] = key.split("__");
      const slotInfo = getSlotTimeBounds(
        slotId,
        contextId !== "any" ? contextId : undefined
      );

      installations.sort((a, b) => (a.beginning ?? 0) - (b.beginning ?? 0));

      for (let i = 0; i < installations.length - 1; i++) {
        const current = installations[i];
        const next = installations[i + 1];
        const currentEnding = current.ending ?? slotInfo.ending;
        const nextBeginning = next.beginning ?? 0;
        if (currentEnding > nextBeginning) {
          const currentEndingStr =
            currentEnding >= Model.END_OF_TIME ? "∞" : currentEnding;
          const nextEndingStr =
            (next.ending ?? slotInfo.ending) >= Model.END_OF_TIME
              ? "∞"
              : next.ending ?? slotInfo.ending;
          newErrors.push(
            `${slotInfo.slotName}: Periods overlap (${current.beginning}-${currentEndingStr} and ${nextBeginning}-${nextEndingStr}).`
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

    const updatedInstallations = localInstallations.map((inst) => {
      const raw = rawInputs.get(inst.id);
      const endingStr = raw?.ending ?? "";

      // Get slot bounds for this installation
      const slotInfo = inst.targetId
        ? getSlotTimeBounds(inst.targetId, inst.scInstallationContextId)
        : { beginning: 0, ending: Model.END_OF_TIME, slotName: "" };

      // If ending is empty, inherit from parent slot
      let endingValue: number | undefined;
      if (endingStr.trim() === "") {
        // Inherit from parent - use parent's ending if it's not infinity
        endingValue =
          slotInfo.ending < Model.END_OF_TIME ? slotInfo.ending : undefined;
      } else {
        endingValue = parseInt(endingStr, 10);
      }

      return {
        ...inst,
        beginning: parseInt(raw?.beginning ?? String(inst.beginning), 10) || 0,
        ending: endingValue,
      };
    });

    let finalInstallations: Installation[];

    if (targetSlotId && !showAll) {
      const keptFromOtherSlots = allInstallations.filter(
        (i) => i.targetId !== targetSlotId
      );
      const removedIds = new Set(removedInstallations.map((i) => i.id));
      const filteredUpdated = updatedInstallations.filter(
        (i) => !removedIds.has(i.id)
      );
      finalInstallations = [...keptFromOtherSlots, ...filteredUpdated];
    } else {
      const removedIds = new Set(removedInstallations.map((i) => i.id));
      finalInstallations = updatedInstallations.filter(
        (i) => !removedIds.has(i.id)
      );
    }

    if (updateDataset) {
      updateDataset((d: Model) => {
        removedInstallations.forEach((removedInst) => {
          const participationPatterns = [
            `${individual.id}__installed_in__${removedInst.targetId}__${removedInst.id}`,
            `${individual.id}__installed_in__${removedInst.targetId}`,
          ];

          d.activities.forEach((activity) => {
            const parts = activity.participations;
            if (!parts || !(parts instanceof Map)) return;

            participationPatterns.forEach((pattern) => {
              parts.forEach((_, key) => {
                if (key.startsWith(pattern)) {
                  parts.delete(key);
                }
              });
            });

            d.activities.set(activity.id, activity);
          });
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
    let slotOption: SlotOption | undefined;
    if (targetSlotId) {
      slotOption = availableSlots.find((s) => s.id === targetSlotId);
    }

    const defaultBeginning = slotOption?.bounds.beginning ?? 0;

    const newInst: Installation = {
      id: uuidv4(),
      componentId: individual?.id || "",
      targetId: targetSlotId || "",
      beginning: defaultBeginning,
      ending: undefined, // Default to undefined (infinity)
      scInstallationContextId: slotOption?.scInstallationId,
    };

    setLocalInstallations((prev) => [...prev, newInst]);
    setRawInputs((prev) => {
      const next = new Map(prev);
      next.set(newInst.id, {
        beginning: String(defaultBeginning),
        ending: "", // Empty string for infinity
      });
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
      const current = next.get(instId) || { beginning: "0", ending: "" };
      next.set(instId, { ...current, [field]: value });
      return next;
    });

    if (value !== "") {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        updateInstallation(instId, field, parsed);
      }
    } else if (field === "ending") {
      // Empty ending means undefined
      updateInstallation(instId, field, undefined);
    }

    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const isOutsideSlotBounds = (
    instId: string,
    field: "beginning" | "ending"
  ): boolean => {
    const inst = localInstallations.find((i) => i.id === instId);
    if (!inst || !inst.targetId) return false;

    const raw = rawInputs.get(instId);
    const rawValue = field === "beginning" ? raw?.beginning : raw?.ending;

    // Empty ending is valid (infinity)
    if (field === "ending" && (!rawValue || rawValue.trim() === "")) {
      return false;
    }

    const value = parseInt(rawValue ?? "", 10);
    if (isNaN(value)) return false;

    const slotBounds = getSlotTimeBounds(
      inst.targetId,
      inst.scInstallationContextId
    );

    if (field === "beginning") {
      return value < slotBounds.beginning;
    } else {
      return slotBounds.ending < Model.END_OF_TIME && value > slotBounds.ending;
    }
  };

  if (!individual) return null;

  const isFiltered = !!targetSlotId && !showAll;
  const totalInstallations = allInstallations.length;

  const modalTitle = isFiltered
    ? `Edit Installation: ${individual.name}`
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
            ? `Manage installation periods for this component. You can have multiple non-overlapping periods. Leave "Until" empty for indefinite.`
            : `Manage all installation periods for this component across different slots. Leave "Until" empty for indefinite (∞).`}
          {!isFiltered && availableSlots.length === 0 && (
            <>
              {" "}
              System Components must be installed in a System before they can
              receive Installed Components.{" "}
            </>
          )}
        </p>

        <Table bordered hover responsive size="sm">
          <thead className="table-light">
            <tr>
              <th style={{ width: "5%" }} className="text-center">
                #
              </th>
              {!isFiltered && (
                <th style={{ width: "40%" }}>
                  Target Slot <span className="text-danger">*</span>
                </th>
              )}
              <th style={{ width: isFiltered ? "35%" : "20%" }}>
                From <span className="text-danger">*</span>
              </th>
              <th style={{ width: isFiltered ? "35%" : "20%" }}>Until</th>
              <th
                style={{ width: isFiltered ? "25%" : "15%" }}
                className="text-center"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {localInstallations.length === 0 ? (
              <tr>
                <td
                  colSpan={isFiltered ? 4 : 5}
                  className="text-center text-muted py-3"
                >
                  <em>
                    No installations yet. Click "+ Add Installation Period"
                    below to add one.
                  </em>
                </td>
              </tr>
            ) : (
              localInstallations.map((inst, idx) => {
                const raw = rawInputs.get(inst.id) || {
                  beginning: String(inst.beginning),
                  ending: "",
                };

                const slotOption = inst.targetId
                  ? getSlotOption(inst.targetId, inst.scInstallationContextId)
                  : undefined;

                const instSlotBounds = inst.targetId
                  ? getSlotTimeBounds(
                      inst.targetId,
                      inst.scInstallationContextId
                    )
                  : null;

                const beginningOutOfBounds = isOutsideSlotBounds(
                  inst.id,
                  "beginning"
                );
                const endingOutOfBounds = isOutsideSlotBounds(
                  inst.id,
                  "ending"
                );

                return (
                  <tr key={inst.id}>
                    <td className="text-center text-muted">{idx + 1}</td>
                    {!isFiltered && (
                      <td>
                        <Form.Select
                          size="sm"
                          value={slotOption?.virtualId || ""}
                          onChange={(e) => {
                            const virtualId = e.target.value;
                            if (!virtualId) {
                              updateInstallation(inst.id, "targetId", "");
                              updateInstallation(
                                inst.id,
                                "scInstallationContextId",
                                undefined
                              );
                              return;
                            }

                            const selectedSlot =
                              getSlotOptionByVirtualId(virtualId);

                            if (selectedSlot) {
                              updateInstallation(
                                inst.id,
                                "targetId",
                                selectedSlot.id
                              );
                              updateInstallation(
                                inst.id,
                                "scInstallationContextId",
                                selectedSlot.scInstallationId
                              );

                              updateRawInput(
                                inst.id,
                                "beginning",
                                String(selectedSlot.bounds.beginning)
                              );
                              // Leave ending empty (infinity) by default
                              updateRawInput(inst.id, "ending", "");
                            }
                          }}
                          className={!inst.targetId ? "border-warning" : ""}
                        >
                          <option value="">-- Select slot --</option>
                          {Array.from(slotsBySystem.entries()).map(
                            ([sysName, slots]) => (
                              <optgroup key={sysName} label={`${sysName}`}>
                                {slots.map((slot) => {
                                  const indent = "  ".repeat(
                                    slot.nestingLevel - 1
                                  );
                                  const boundsStr = ` (${
                                    slot.bounds.beginning
                                  }-${
                                    slot.bounds.ending >= Model.END_OF_TIME
                                      ? "∞"
                                      : slot.bounds.ending
                                  })`;
                                  return (
                                    <option
                                      key={slot.virtualId}
                                      value={slot.virtualId}
                                    >
                                      {indent}◇ {slot.displayName}
                                      {boundsStr}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )
                          )}
                        </Form.Select>
                        {slotOption && (
                          <Form.Text className="text-muted">
                            <small>
                              Available: {slotOption.bounds.beginning}-
                              {slotOption.bounds.ending >= Model.END_OF_TIME
                                ? "∞"
                                : slotOption.bounds.ending}
                            </small>
                          </Form.Text>
                        )}
                      </td>
                    )}
                    <td>
                      <Form.Control
                        type="number"
                        size="sm"
                        min={instSlotBounds?.beginning ?? 0}
                        max={instSlotBounds?.ending ?? undefined}
                        value={raw.beginning}
                        onChange={(e) =>
                          updateRawInput(inst.id, "beginning", e.target.value)
                        }
                        placeholder={String(instSlotBounds?.beginning ?? 0)}
                        className={
                          raw.beginning === "" || beginningOutOfBounds
                            ? "border-danger"
                            : ""
                        }
                        isInvalid={beginningOutOfBounds}
                      />
                      {beginningOutOfBounds && instSlotBounds && (
                        <Form.Text className="text-danger">
                          Min: {instSlotBounds.beginning}
                        </Form.Text>
                      )}
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        size="sm"
                        min={instSlotBounds?.beginning ?? 1}
                        max={
                          instSlotBounds &&
                          instSlotBounds.ending < Model.END_OF_TIME
                            ? instSlotBounds.ending
                            : undefined
                        }
                        value={raw.ending}
                        onChange={(e) =>
                          updateRawInput(inst.id, "ending", e.target.value)
                        }
                        placeholder={
                          instSlotBounds &&
                          instSlotBounds.ending < Model.END_OF_TIME
                            ? String(instSlotBounds.ending)
                            : "∞"
                        }
                        className={endingOutOfBounds ? "border-danger" : ""}
                        isInvalid={endingOutOfBounds}
                      />
                      {endingOutOfBounds && instSlotBounds && (
                        <Form.Text className="text-danger">
                          Max:{" "}
                          {instSlotBounds.ending >= Model.END_OF_TIME
                            ? "∞"
                            : instSlotBounds.ending}
                        </Form.Text>
                      )}
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
              })
            )}
          </tbody>
        </Table>

        <div className="mt-3">
          <Button variant="outline-primary" size="sm" onClick={addInstallation}>
            + Add {localInstallations.length > 0 ? "Another " : ""}Installation
            Period
          </Button>
        </div>

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
