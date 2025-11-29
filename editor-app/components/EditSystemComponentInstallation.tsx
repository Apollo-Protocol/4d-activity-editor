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
  targetSystemId?: string;
}

const EditSystemComponentInstallation = (props: Props) => {
  const {
    show,
    setShow,
    individual,
    setIndividual,
    dataset,
    updateDataset,
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

  // Helper function to get effective system time bounds
  const getSystemTimeBounds = (
    systemId: string
  ): { beginning: number; ending: number; systemName: string } => {
    const system = dataset.individuals.get(systemId);
    if (!system) {
      return { beginning: 0, ending: Model.END_OF_TIME, systemName: systemId };
    }

    let beginning = system.beginning >= 0 ? system.beginning : 0;
    let ending = system.ending;

    return { beginning, ending, systemName: system.name };
  };

  useEffect(() => {
    if (individual && individual.installations) {
      const allInst = [...individual.installations];
      setAllInstallations(allInst);

      if (targetSystemId) {
        const filtered = allInst.filter(
          (inst) => inst.targetId === targetSystemId
        );
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
          ending: String(inst.ending ?? 10),
        });
      });
      setRawInputs(inputs);
    } else {
      setLocalInstallations([]);
      setAllInstallations([]);
      setRawInputs(new Map());
      setShowAll(!targetSystemId);
    }
    setRemovedInstallations([]);
    setErrors([]);
  }, [individual, show, targetSystemId]);

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
      const endingStr = raw?.ending ?? String(inst.ending ?? "");

      const systemInfo = inst.targetId
        ? getSystemTimeBounds(inst.targetId)
        : {
            beginning: 0,
            ending: Model.END_OF_TIME,
            systemName: `Row ${idx + 1}`,
          };
      const systemName = systemInfo.systemName;

      if (!inst.targetId) {
        newErrors.push(`${systemName}: Please select a target system.`);
        return;
      }

      if (beginningStr.trim() === "") {
        newErrors.push(`${systemName}: "From" time is required.`);
      }

      // "Until" is now optional - if empty, it will inherit from system or use END_OF_TIME
      // No validation error for empty ending

      const beginning = parseInt(beginningStr, 10);
      const ending =
        endingStr.trim() === "" ? Model.END_OF_TIME : parseInt(endingStr, 10);

      if (!isNaN(beginning)) {
        if (beginning < 0) {
          newErrors.push(`${systemName}: "From" cannot be negative.`);
        }

        // Validate against system bounds
        if (beginning < systemInfo.beginning) {
          newErrors.push(
            `${systemName}: "From" (${beginning}) cannot be before system starts (${systemInfo.beginning}).`
          );
        }
      }

      if (endingStr.trim() !== "" && !isNaN(ending)) {
        if (ending < 1) {
          newErrors.push(`${systemName}: "Until" must be at least 1.`);
        }
        if (beginning >= ending) {
          newErrors.push(`${systemName}: "From" must be less than "Until".`);
        }

        if (
          systemInfo.ending < Model.END_OF_TIME &&
          ending > systemInfo.ending
        ) {
          newErrors.push(
            `${systemName}: "Until" (${ending}) cannot be after system ends (${systemInfo.ending}).`
          );
        }
      }
    });

    // Check for overlapping periods in the same system
    const bySystem = new Map<string, Installation[]>();
    localInstallations.forEach((inst) => {
      if (!inst.targetId) return;
      const raw = rawInputs.get(inst.id);
      const beginning = parseInt(raw?.beginning ?? String(inst.beginning), 10);
      const endingStr = raw?.ending ?? String(inst.ending ?? "");
      const ending =
        endingStr.trim() === "" ? Model.END_OF_TIME : parseInt(endingStr, 10);
      if (isNaN(beginning)) return;

      const list = bySystem.get(inst.targetId) || [];
      list.push({ ...inst, beginning, ending });
      bySystem.set(inst.targetId, list);
    });

    bySystem.forEach((installations, systemId) => {
      if (installations.length < 2) return;
      const systemInfo = getSystemTimeBounds(systemId);

      // Sort by beginning time
      installations.sort((a, b) => (a.beginning ?? 0) - (b.beginning ?? 0));

      for (let i = 0; i < installations.length - 1; i++) {
        const current = installations[i];
        const next = installations[i + 1];
        if ((current.ending ?? Model.END_OF_TIME) > (next.beginning ?? 0)) {
          newErrors.push(
            `${systemInfo.systemName}: Periods overlap (${current.beginning}-${
              current.ending ?? "∞"
            } and ${next.beginning}-${next.ending ?? "∞"}).`
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
      const beginningValue =
        parseInt(raw?.beginning ?? String(inst.beginning), 10) || 0;
      const endingStr = raw?.ending ?? String(inst.ending ?? "");
      const endingValue =
        endingStr.trim() === "" ? Model.END_OF_TIME : parseInt(endingStr, 10);

      return {
        ...inst,
        beginning: beginningValue,
        ending: endingValue,
      };
    });

    let finalInstallations: Installation[];

    if (targetSystemId && !showAll) {
      const keptFromOtherSystems = allInstallations.filter(
        (i) => i.targetId !== targetSystemId
      );
      const removedIds = new Set(removedInstallations.map((i) => i.id));
      const filteredUpdated = updatedInstallations.filter(
        (i) => !removedIds.has(i.id)
      );
      finalInstallations = [...keptFromOtherSystems, ...filteredUpdated];
    } else {
      const removedIds = new Set(removedInstallations.map((i) => i.id));
      finalInstallations = updatedInstallations.filter(
        (i) => !removedIds.has(i.id)
      );
    }

    if (updateDataset) {
      updateDataset((d: Model) => {
        // Clean up participations for removed installations
        removedInstallations.forEach((removedInst) => {
          const participationKey = `${individual.id}__installed_in__${removedInst.targetId}__${removedInst.id}`;

          d.activities.forEach((activity) => {
            const parts = activity.participations;
            if (!parts) return;

            if (parts instanceof Map) {
              if (parts.has(participationKey)) {
                parts.delete(participationKey);
                d.activities.set(activity.id, activity);
              }
            }
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
    // Get system bounds if we have a target system
    const systemBounds = targetSystemId
      ? getSystemTimeBounds(targetSystemId)
      : { beginning: 0, ending: Model.END_OF_TIME };

    const defaultBeginning = systemBounds.beginning;
    // Leave ending undefined/empty so it inherits from system
    const defaultEnding = undefined;

    const newInst: Installation = {
      id: uuidv4(),
      componentId: individual?.id || "",
      targetId: targetSystemId || "",
      beginning: defaultBeginning,
      ending: defaultEnding,
    };

    setLocalInstallations((prev) => [...prev, newInst]);
    setRawInputs((prev) => {
      const next = new Map(prev);
      next.set(newInst.id, {
        beginning: String(defaultBeginning),
        ending: "", // Empty string means inherit from system
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

  // Get available systems
  const availableSystems = Array.from(dataset.individuals.values()).filter(
    (ind) => (ind.entityType ?? EntityType.Individual) === EntityType.System
  );

  // Helper to get system name
  const getSystemName = (systemId: string): string => {
    if (!systemId) return "";
    const system = availableSystems.find((s) => s.id === systemId);
    return system?.name ?? systemId;
  };

  // Helper to check if a value is outside system bounds
  const isOutsideSystemBounds = (
    instId: string,
    field: "beginning" | "ending"
  ): boolean => {
    const inst = localInstallations.find((i) => i.id === instId);
    if (!inst || !inst.targetId) return false;

    const raw = rawInputs.get(instId);
    const valueStr =
      field === "beginning" ? raw?.beginning ?? "" : raw?.ending ?? "";

    // If ending is empty, it's valid (inherits from system)
    if (field === "ending" && valueStr.trim() === "") return false;

    const value = parseInt(valueStr, 10);
    if (isNaN(value)) return false;

    const systemBounds = getSystemTimeBounds(inst.targetId);

    if (field === "beginning") {
      return value < systemBounds.beginning;
    } else {
      return (
        systemBounds.ending < Model.END_OF_TIME && value > systemBounds.ending
      );
    }
  };

  if (!individual) return null;

  const isFiltered = !!targetSystemId && !showAll;
  const totalInstallations = allInstallations.length;
  const systemName = targetSystemId ? getSystemName(targetSystemId) : "";

  // Get system bounds for display
  const targetSystemBounds = targetSystemId
    ? getSystemTimeBounds(targetSystemId)
    : null;

  const modalTitle = isFiltered
    ? `Edit Installation: ${individual.name} in ${systemName}`
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

        {/* Show system time bounds if filtering by system */}
        {isFiltered && targetSystemBounds && (
          <Alert variant="info" className="py-2">
            <strong>System availability:</strong> {targetSystemBounds.beginning}{" "}
            -{" "}
            {targetSystemBounds.ending >= Model.END_OF_TIME
              ? "∞"
              : targetSystemBounds.ending}
            <br />
            <small className="text-muted">
              Installation periods must be within these bounds.
            </small>
          </Alert>
        )}

        <p className="text-muted mb-3">
          {isFiltered
            ? `Manage installation periods for this system component in "${systemName}". You can have multiple non-overlapping periods.`
            : "Manage all installation periods for this system component across different systems."}
        </p>

        {localInstallations.length === 0 ? (
          <div className="text-center py-4 border rounded bg-light">
            <p className="text-muted mb-3">
              No installations configured.
              {isFiltered
                ? ` Add a period when this component is installed in "${systemName}".`
                : " Add an installation to place this component in a system."}
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
                      Target System <span className="text-danger">*</span>
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

                  // Get system bounds for this installation
                  const instSystemBounds = inst.targetId
                    ? getSystemTimeBounds(inst.targetId)
                    : null;

                  const beginningOutOfBounds = isOutsideSystemBounds(
                    inst.id,
                    "beginning"
                  );
                  const endingOutOfBounds = isOutsideSystemBounds(
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
                            value={inst.targetId}
                            onChange={(e) => {
                              updateInstallation(
                                inst.id,
                                "targetId",
                                e.target.value
                              );
                              // Reset times to system defaults when changing system
                              if (e.target.value) {
                                const newSystemBounds = getSystemTimeBounds(
                                  e.target.value
                                );
                                const newEnding =
                                  newSystemBounds.ending < Model.END_OF_TIME
                                    ? newSystemBounds.ending
                                    : newSystemBounds.beginning + 10;
                                updateRawInput(
                                  inst.id,
                                  "beginning",
                                  String(newSystemBounds.beginning)
                                );
                                updateRawInput(
                                  inst.id,
                                  "ending",
                                  String(newEnding)
                                );
                              }
                            }}
                            className={!inst.targetId ? "border-warning" : ""}
                          >
                            <option value="">-- Select system --</option>
                            {availableSystems.map((system) => {
                              const systemBounds = getSystemTimeBounds(
                                system.id
                              );
                              const boundsStr =
                                systemBounds.ending < Model.END_OF_TIME
                                  ? ` (${systemBounds.beginning}-${systemBounds.ending})`
                                  : systemBounds.beginning > 0
                                  ? ` (${systemBounds.beginning}-∞)`
                                  : "";
                              return (
                                <option key={system.id} value={system.id}>
                                  {system.name}
                                  {boundsStr}
                                </option>
                              );
                            })}
                          </Form.Select>
                          {inst.targetId && instSystemBounds && (
                            <Form.Text className="text-muted">
                              Available: {instSystemBounds.beginning}-
                              {instSystemBounds.ending >= Model.END_OF_TIME
                                ? "∞"
                                : instSystemBounds.ending}
                            </Form.Text>
                          )}
                        </td>
                      )}
                      <td>
                        <Form.Control
                          type="number"
                          size="sm"
                          min={instSystemBounds?.beginning ?? 0}
                          max={instSystemBounds?.ending ?? undefined}
                          value={raw.beginning}
                          onChange={(e) =>
                            updateRawInput(inst.id, "beginning", e.target.value)
                          }
                          placeholder={String(instSystemBounds?.beginning ?? 0)}
                          className={
                            raw.beginning === "" || beginningOutOfBounds
                              ? "border-danger"
                              : ""
                          }
                          isInvalid={beginningOutOfBounds}
                        />
                        {beginningOutOfBounds && instSystemBounds && (
                          <Form.Text className="text-danger">
                            Min: {instSystemBounds.beginning}
                          </Form.Text>
                        )}
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          size="sm"
                          min={instSystemBounds?.beginning ?? 1}
                          max={
                            instSystemBounds &&
                            instSystemBounds.ending < Model.END_OF_TIME
                              ? instSystemBounds.ending
                              : undefined
                          }
                          value={raw.ending}
                          onChange={(e) =>
                            updateRawInput(inst.id, "ending", e.target.value)
                          }
                          placeholder={
                            instSystemBounds &&
                            instSystemBounds.ending < Model.END_OF_TIME
                              ? String(instSystemBounds.ending)
                              : "∞ (inherit from system)"
                          }
                          className={endingOutOfBounds ? "border-danger" : ""}
                          isInvalid={endingOutOfBounds}
                        />
                        {endingOutOfBounds && instSystemBounds && (
                          <Form.Text className="text-danger">
                            Max:{" "}
                            {instSystemBounds.ending >= Model.END_OF_TIME
                              ? "∞"
                              : instSystemBounds.ending}
                          </Form.Text>
                        )}
                        {!endingOutOfBounds && raw.ending.trim() === "" && (
                          <Form.Text className="text-muted">
                            Will inherit from system
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

        {availableSystems.length === 0 && !isFiltered && (
          <Alert variant="warning" className="mt-3 mb-0">
            No systems available. Create a System first to install this
            component.
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
              } in this system`
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

export default EditSystemComponentInstallation;
