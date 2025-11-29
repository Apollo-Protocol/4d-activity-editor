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
  targetSystemId?: string; // NEW: The System context when opening from a nested view
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

  // Get all Systems
  const allSystems = Array.from(dataset.individuals.values()).filter(
    (ind) => (ind.entityType ?? EntityType.Individual) === EntityType.System
  );

  // Get available slots (SystemComponents) - but only show them if they're NOT in the filtered list
  // When in filtered mode (targetSlotId is set), we don't show the slot selector
  const availableSlots = useMemo(() => {
    if (targetSlotId) {
      // In filtered mode, only return the target slot
      const slot = dataset.individuals.get(targetSlotId);
      return slot ? [slot] : [];
    }

    // In unfiltered mode, return all SystemComponents that have installations
    // (Only virtual SystemComponent rows can be installation targets)
    return Array.from(dataset.individuals.values()).filter((ind) => {
      if (
        (ind.entityType ?? EntityType.Individual) !== EntityType.SystemComponent
      ) {
        return false;
      }
      // Only show SystemComponents that are installed somewhere
      return ind.installations && ind.installations.length > 0;
    });
  }, [dataset, targetSlotId]);

  // Helper to get Systems where a slot is installed
  const getSystemsForSlot = (slotId: string): Individual[] => {
    const slot = dataset.individuals.get(slotId);
    if (!slot || !slot.installations) return [];

    const systemIds = new Set(slot.installations.map((inst) => inst.targetId));
    return Array.from(systemIds)
      .map((sysId) => dataset.individuals.get(sysId))
      .filter((sys): sys is Individual => !!sys);
  };

  // Helper to get the SC installation ID for a specific System
  const getScInstallationForSystem = (
    slotId: string,
    systemId: string
  ): Installation | undefined => {
    const slot = dataset.individuals.get(slotId);
    if (!slot || !slot.installations) return undefined;
    return slot.installations.find((inst) => inst.targetId === systemId);
  };

  // Helper function to get effective slot time bounds for a specific System context
  const getSlotTimeBoundsForSystem = (
    slotId: string,
    systemId?: string
  ): { beginning: number; ending: number; slotName: string } => {
    const slot = dataset.individuals.get(slotId);
    if (!slot) {
      return { beginning: 0, ending: Model.END_OF_TIME, slotName: slotId };
    }

    // If a specific System is provided, get bounds from that installation
    if (systemId && slot.installations) {
      const scInst = slot.installations.find(
        (inst) => inst.targetId === systemId
      );
      if (scInst) {
        return {
          beginning: scInst.beginning ?? 0,
          ending: scInst.ending ?? Model.END_OF_TIME,
          slotName: slot.name,
        };
      }
    }

    // Fallback: use union of all installations
    let beginning = slot.beginning;
    let ending = slot.ending;

    if (slot.installations && slot.installations.length > 0) {
      const instBeginnings = slot.installations.map((inst) =>
        Math.max(0, inst.beginning ?? 0)
      );
      const instEndings = slot.installations.map(
        (inst) => inst.ending ?? Model.END_OF_TIME
      );
      const earliestBeginning = Math.min(...instBeginnings);
      const latestEnding = Math.max(...instEndings);

      if (beginning < 0) {
        beginning = earliestBeginning;
      }
      if (ending >= Model.END_OF_TIME && latestEnding < Model.END_OF_TIME) {
        ending = latestEnding;
      }
    } else if (beginning < 0) {
      beginning = 0;
    }

    return { beginning, ending, slotName: slot.name };
  };

  // For backward compatibility
  const getSlotTimeBounds = (slotId: string) =>
    getSlotTimeBoundsForSystem(slotId, undefined);

  useEffect(() => {
    if (individual && individual.installations) {
      const allInst = [...individual.installations];
      setAllInstallations(allInst);

      if (targetSlotId) {
        // Filter by slot AND optionally by system context
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
      const endingStr = raw?.ending ?? String(inst.ending);

      const slotInfo = inst.targetId
        ? getSlotTimeBoundsForSystem(inst.targetId, inst.systemContextId)
        : {
            beginning: 0,
            ending: Model.END_OF_TIME,
            slotName: `Row ${idx + 1}`,
          };
      const slotName = slotInfo.slotName;

      if (!inst.targetId) {
        newErrors.push(`${slotName}: Please select a target slot.`);
        return;
      }

      // Validate that a slot is selected AND it must be a virtual row (installed SystemComponent)
      const slot = dataset.individuals.get(inst.targetId);
      if (slot) {
        const slotType = slot.entityType ?? EntityType.Individual;
        if (slotType === EntityType.SystemComponent) {
          // Check if this SystemComponent has any installations
          if (!slot.installations || slot.installations.length === 0) {
            newErrors.push(
              `${slotName}: Cannot install into an uninstalled SystemComponent. The SystemComponent must be installed in a System first.`
            );
            return;
          }
        }
      }

      // Validate that if a slot is selected, a System context is also selected
      // (if the slot is installed in multiple systems)
      const systemsForSlot = getSystemsForSlot(inst.targetId);

      // Auto-fill system context if only one option exists
      if (systemsForSlot.length === 1 && !inst.systemContextId) {
        // This will be handled during save, but we need the context for validation
        const autoSystemId = systemsForSlot[0].id;
        inst.systemContextId = autoSystemId;
        const scInst = getScInstallationForSystem(inst.targetId, autoSystemId);
        if (scInst) {
          inst.scInstallationContextId = scInst.id;
        }
      }

      if (systemsForSlot.length > 1 && !inst.systemContextId) {
        newErrors.push(
          `${slotName}: Please select which System this installation belongs to.`
        );
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

        // Validate against slot bounds (using System context if available)
        const contextBounds = getSlotTimeBoundsForSystem(
          inst.targetId,
          inst.systemContextId
        );
        if (beginning < contextBounds.beginning) {
          newErrors.push(
            `${slotName}: "From" (${beginning}) cannot be before slot starts (${contextBounds.beginning}).`
          );
        }
        if (
          contextBounds.ending < Model.END_OF_TIME &&
          ending > contextBounds.ending
        ) {
          newErrors.push(
            `${slotName}: "Until" (${ending}) cannot be after slot ends (${contextBounds.ending}).`
          );
        }
      }
    });

    // Check for overlapping periods in the same slot AND same system context
    const bySlotAndSystem = new Map<string, Installation[]>();
    localInstallations.forEach((inst) => {
      if (!inst.targetId) return;
      const raw = rawInputs.get(inst.id);
      const beginning = parseInt(raw?.beginning ?? String(inst.beginning), 10);
      const ending = parseInt(raw?.ending ?? String(inst.ending), 10);
      if (isNaN(beginning) || isNaN(ending)) return;

      // Key includes both slot and system context
      const key = `${inst.targetId}__${inst.systemContextId || "any"}`;
      const list = bySlotAndSystem.get(key) || [];
      list.push({ ...inst, beginning, ending });
      bySlotAndSystem.set(key, list);
    });

    bySlotAndSystem.forEach((installations, key) => {
      if (installations.length < 2) return;
      const [slotId] = key.split("__");
      const slotInfo = getSlotTimeBounds(slotId);

      installations.sort((a, b) => (a.beginning ?? 0) - (b.beginning ?? 0));

      for (let i = 0; i < installations.length - 1; i++) {
        const current = installations[i];
        const next = installations[i + 1];
        if ((current.ending ?? 0) > (next.beginning ?? 0)) {
          newErrors.push(
            `${slotInfo.slotName}: Periods overlap (${current.beginning}-${current.ending} and ${next.beginning}-${next.ending}).`
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

      // Get the SC installation ID for the system context
      let scInstallationContextId = inst.scInstallationContextId;
      let systemContextId = inst.systemContextId;

      // Auto-fill system context if only one option
      if (inst.targetId && !systemContextId) {
        const systemsForSlot = getSystemsForSlot(inst.targetId);
        if (systemsForSlot.length === 1) {
          systemContextId = systemsForSlot[0].id;
        }
      }

      if (inst.targetId && systemContextId && !scInstallationContextId) {
        const scInst = getScInstallationForSystem(
          inst.targetId,
          systemContextId
        );
        if (scInst) {
          scInstallationContextId = scInst.id;
        }
      }

      return {
        ...inst,
        beginning: parseInt(raw?.beginning ?? String(inst.beginning), 10) || 0,
        ending: parseInt(raw?.ending ?? String(inst.ending), 10) || 10,
        systemContextId,
        scInstallationContextId,
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
    // Get slot bounds if we have a target slot
    const slotBounds = targetSlotId
      ? getSlotTimeBoundsForSystem(targetSlotId, targetSystemId)
      : { beginning: 0, ending: 10 };

    const defaultBeginning = slotBounds.beginning;
    const defaultEnding =
      slotBounds.ending < Model.END_OF_TIME
        ? slotBounds.ending
        : defaultBeginning + 10;

    // Get the SC installation ID if we have both slot and system context
    let scInstallationContextId: string | undefined;
    let systemContextId: string | undefined = targetSystemId;

    if (targetSlotId) {
      // If we have a target slot, check if there's only one system - auto-select it
      const systemsForSlot = getSystemsForSlot(targetSlotId);
      if (systemsForSlot.length === 1 && !systemContextId) {
        systemContextId = systemsForSlot[0].id;
      }

      if (systemContextId) {
        const scInst = getScInstallationForSystem(
          targetSlotId,
          systemContextId
        );
        if (scInst) {
          scInstallationContextId = scInst.id;
        }
      }
    }

    const newInst: Installation = {
      id: uuidv4(),
      componentId: individual?.id || "",
      targetId: targetSlotId || "",
      beginning: defaultBeginning,
      ending: defaultEnding,
      systemContextId: systemContextId,
      scInstallationContextId,
    };

    setLocalInstallations((prev) => [...prev, newInst]);
    setRawInputs((prev) => {
      const next = new Map(prev);
      next.set(newInst.id, {
        beginning: String(defaultBeginning),
        ending: String(defaultEnding),
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

  // Helper to get slot name with system
  const getSlotDisplayName = (slotId: string): string => {
    if (!slotId) return "";
    const slot = availableSlots.find((s) => s.id === slotId);
    if (!slot) return slotId;

    if (slot.installations && slot.installations.length > 0) {
      const systemIds = Array.from(
        new Set(slot.installations.map((inst) => inst.targetId))
      );
      const systemNames = systemIds
        .map((sysId) => {
          const system = dataset.individuals.get(sysId);
          return system?.name ?? sysId;
        })
        .join(", ");
      return `${slot.name} (in ${systemNames})`;
    }

    return slot.name;
  };

  // Helper to check if a value is outside slot bounds
  const isOutsideSlotBounds = (
    instId: string,
    field: "beginning" | "ending"
  ): boolean => {
    const inst = localInstallations.find((i) => i.id === instId);
    if (!inst || !inst.targetId) return false;

    const raw = rawInputs.get(instId);
    const value = parseInt(
      field === "beginning" ? raw?.beginning ?? "" : raw?.ending ?? "",
      10
    );
    if (isNaN(value)) return false;

    const slotBounds = getSlotTimeBoundsForSystem(
      inst.targetId,
      inst.systemContextId
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
  const slotName = targetSlotId ? getSlotDisplayName(targetSlotId) : "";
  const systemName = targetSystemId
    ? dataset.individuals.get(targetSystemId)?.name
    : undefined;

  // Get slot bounds for display
  const targetSlotBounds = targetSlotId
    ? getSlotTimeBoundsForSystem(targetSlotId, targetSystemId)
    : null;

  const modalTitle = isFiltered
    ? systemName
      ? `Edit Installation: ${individual.name} in ${slotName} (${systemName})`
      : `Edit Installation: ${individual.name} in ${slotName}`
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
            ? `Manage installation periods for this component in "${slotName}"${
                systemName ? ` within "${systemName}"` : ""
              }. You can have multiple non-overlapping periods.`
            : `Manage all installation periods for this component across different slots.`}
          {!isFiltered && availableSlots.length === 0 && (
            <>
              {" "}
              System Components must be installed in a System before they can
              receive Installed Components.{" "}
            </>
          )}
        </p>

        {/* Always show the table structure */}
        <Table bordered hover responsive size="sm">
          <thead className="table-light">
            <tr>
              <th style={{ width: "5%" }} className="text-center">
                #
              </th>
              {!isFiltered && (
                <>
                  <th style={{ width: "25%" }}>
                    Target Slot <span className="text-danger">*</span>
                  </th>
                  <th style={{ width: "20%" }}>
                    System Context <span className="text-danger">*</span>
                  </th>
                </>
              )}
              <th style={{ width: isFiltered ? "30%" : "15%" }}>
                From <span className="text-danger">*</span>
              </th>
              <th style={{ width: isFiltered ? "30%" : "15%" }}>
                Until <span className="text-danger">*</span>
              </th>
              <th
                style={{ width: isFiltered ? "35%" : "15%" }}
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

              // Get Systems where this slot is installed
              const systemsForSlot = inst.targetId
                ? getSystemsForSlot(inst.targetId)
                : [];

              // Get slot bounds for this installation
              const instSlotBounds = inst.targetId
                ? getSlotTimeBoundsForSystem(
                    inst.targetId,
                    inst.systemContextId
                  )
                : null;

              const beginningOutOfBounds = isOutsideSlotBounds(
                inst.id,
                "beginning"
              );
              const endingOutOfBounds = isOutsideSlotBounds(inst.id, "ending");

              return (
                <tr key={inst.id}>
                  <td className="text-center text-muted">{idx + 1}</td>
                  {!isFiltered && (
                    <>
                      <td>
                        <Form.Select
                          size="sm"
                          value={inst.targetId}
                          onChange={(e) => {
                            const newSlotId = e.target.value;
                            updateInstallation(inst.id, "targetId", newSlotId);
                            // Clear system context when changing slot
                            updateInstallation(
                              inst.id,
                              "systemContextId",
                              undefined
                            );
                            updateInstallation(
                              inst.id,
                              "scInstallationContextId",
                              undefined
                            );
                            // Reset times to slot defaults when changing slot
                            if (newSlotId) {
                              const newSlotBounds =
                                getSlotTimeBounds(newSlotId);
                              const newEnding =
                                newSlotBounds.ending < Model.END_OF_TIME
                                  ? newSlotBounds.ending
                                  : newSlotBounds.beginning + 10;
                              updateRawInput(
                                inst.id,
                                "beginning",
                                String(newSlotBounds.beginning)
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
                          <option value="">-- Select slot --</option>
                          {availableSlots.map((slot) => (
                            <option key={slot.id} value={slot.id}>
                              {slot.name}
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>
                        <Form.Select
                          size="sm"
                          value={inst.systemContextId || ""}
                          onChange={(e) => {
                            const newSystemId = e.target.value || undefined;
                            updateInstallation(
                              inst.id,
                              "systemContextId",
                              newSystemId
                            );
                            // Set the SC installation context ID
                            if (inst.targetId && newSystemId) {
                              const scInst = getScInstallationForSystem(
                                inst.targetId,
                                newSystemId
                              );
                              updateInstallation(
                                inst.id,
                                "scInstallationContextId",
                                scInst?.id
                              );
                              // Update times to match system context
                              const newBounds = getSlotTimeBoundsForSystem(
                                inst.targetId,
                                newSystemId
                              );
                              const newEnding =
                                newBounds.ending < Model.END_OF_TIME
                                  ? newBounds.ending
                                  : newBounds.beginning + 10;
                              updateRawInput(
                                inst.id,
                                "beginning",
                                String(newBounds.beginning)
                              );
                              updateRawInput(
                                inst.id,
                                "ending",
                                String(newEnding)
                              );
                            } else {
                              updateInstallation(
                                inst.id,
                                "scInstallationContextId",
                                undefined
                              );
                            }
                          }}
                          disabled={!inst.targetId}
                          className={
                            inst.targetId &&
                            systemsForSlot.length > 1 &&
                            !inst.systemContextId
                              ? "border-warning"
                              : ""
                          }
                        >
                          <option value="">
                            {systemsForSlot.length === 0
                              ? "-- Slot not installed --"
                              : systemsForSlot.length === 1
                              ? systemsForSlot[0].name
                              : "-- Select System --"}
                          </option>
                          {systemsForSlot.length > 1 &&
                            systemsForSlot.map((sys) => {
                              const scInst = getScInstallationForSystem(
                                inst.targetId,
                                sys.id
                              );
                              const boundsStr = scInst
                                ? ` (${scInst.beginning ?? 0}-${
                                    scInst.ending ?? "∞"
                                  })`
                                : "";
                              return (
                                <option key={sys.id} value={sys.id}>
                                  {sys.name}
                                  {boundsStr}
                                </option>
                              );
                            })}
                        </Form.Select>
                        {inst.targetId &&
                          systemsForSlot.length === 1 &&
                          !inst.systemContextId && (
                            <Form.Text className="text-muted">
                              Auto: {systemsForSlot[0].name}
                            </Form.Text>
                          )}
                      </td>
                    </>
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
                      placeholder={String(instSlotBounds?.ending ?? 10)}
                      className={
                        raw.ending === "" || endingOutOfBounds
                          ? "border-danger"
                          : ""
                      }
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
            })}
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
