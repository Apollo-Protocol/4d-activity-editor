import React, { useEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Table from "react-bootstrap/Table";
import Badge from "react-bootstrap/Badge";
import { Model } from "@/lib/Model";
import { EntityType, Individual, Installation } from "@/lib/Schema";
import { v4 as uuidv4 } from "uuid";

interface Props {
  show: boolean;
  setShow: (show: boolean) => void;
  individual: Individual | undefined;
  setIndividual: (individual: Individual) => void;
  dataset: Model;
  updateDataset: (updater: (d: Model) => void) => void;
  targetSystemId?: string;
}

interface RawInputs {
  [installationId: string]: {
    beginning: string;
    ending: string;
  };
}

interface ValidationErrors {
  [installationId: string]: {
    beginning?: string;
    ending?: string;
    overlap?: string;
    target?: string;
  };
}

// Interface for available targets (including virtual SC instances)
interface TargetOption {
  id: string; // The original target ID (System or SC ID)
  virtualId: string; // Unique identifier for this specific instance
  displayName: string;
  entityType: EntityType;
  bounds: { beginning: number; ending: number };
  isVirtual: boolean;
  parentSystemName?: string;
  scInstallationId?: string; // The SC's installation ID for context
}

// Helper function to check if two time ranges overlap
function hasTimeOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && start2 < end1;
}

// Helper to extract the SC installation ID from a virtual row ID
function extractInstallationIdFromVirtualId(
  virtualId: string
): string | undefined {
  if (!virtualId.includes("__installed_in__")) return undefined;
  const parts = virtualId.split("__installed_in__");
  if (parts.length < 2) return undefined;
  let rest = parts[1];

  const ctxIndex = rest.indexOf("__ctx_");
  if (ctxIndex !== -1) {
    rest = rest.substring(0, ctxIndex);
  }

  const restParts = rest.split("__");
  return restParts.length > 1 ? restParts[1] : undefined;
}

export default function EditSystemComponentInstallation({
  show,
  setShow,
  individual,
  setIndividual,
  dataset,
  updateDataset,
  targetSystemId,
}: Props) {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [rawInputs, setRawInputs] = useState<RawInputs>({});
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Initialize installations when modal opens
  useEffect(() => {
    if (show && individual) {
      const insts = individual.installations || [];
      setInstallations([...insts]);

      // Initialize raw inputs
      const inputs: RawInputs = {};
      insts.forEach((inst) => {
        inputs[inst.id] = {
          beginning: inst.beginning?.toString() ?? "0",
          ending: inst.ending?.toString() ?? "",
        };
      });
      setRawInputs(inputs);
      setErrors({});
    }
  }, [show, individual]);

  // Get available targets (Systems AND SystemComponent installations)
  const availableTargets = useMemo((): TargetOption[] => {
    const targets: TargetOption[] = [];

    // Add Systems as targets
    dataset.individuals.forEach((ind) => {
      const entityType = ind.entityType ?? EntityType.Individual;

      if (entityType === EntityType.System) {
        const bounds = dataset.getTargetTimeBounds(ind.id);
        targets.push({
          id: ind.id,
          virtualId: ind.id, // For systems, virtualId = id
          displayName: ind.name,
          entityType: EntityType.System,
          bounds,
          isVirtual: false,
        });
      }
    });

    // Add SystemComponent instances (from the display list) as targets
    const displayIndividuals = dataset.getDisplayIndividuals();

    displayIndividuals.forEach((ind) => {
      if (!ind._isVirtualRow) return;

      const originalId = ind.id.split("__installed_in__")[0];
      const original = dataset.individuals.get(originalId);
      if (!original) return;

      const origType = original.entityType ?? EntityType.Individual;
      if (origType !== EntityType.SystemComponent) return;

      // Don't allow installing into self (same original SC ID)
      if (originalId === individual?.id) return;

      // NO circular reference check needed here!
      // Different installation contexts (different systems) are independent.
      // SC1 can be nested in SC2 in System A, while SC2 is nested in SC1 in System B.

      // Extract parent system name for display
      const pathParts = ind._parentPath?.split("__") || [];
      const systemId = pathParts[0];
      const system = dataset.individuals.get(systemId);
      const parentSystemName = system?.name;

      // Build a better display name showing full path
      const pathNames: string[] = [];
      pathParts.forEach((partId) => {
        const part = dataset.individuals.get(partId);
        if (part) {
          pathNames.push(part.name);
        }
      });
      const hierarchyStr =
        pathNames.length > 0 ? pathNames.join(" → ") : "Unknown";

      // Extract the SC installation ID
      const scInstallationId = ind._installationId;

      targets.push({
        id: originalId,
        virtualId: ind.id, // Use the FULL virtual ID as unique key
        displayName: `${ind.name} (in ${hierarchyStr})`,
        entityType: EntityType.SystemComponent,
        bounds: { beginning: ind.beginning, ending: ind.ending },
        isVirtual: true,
        parentSystemName,
        scInstallationId,
      });
    });

    return targets;
  }, [dataset, individual?.id]);

  // Helper to get target by virtualId
  const getTargetByVirtualId = (
    virtualId: string
  ): TargetOption | undefined => {
    return availableTargets.find((t) => t.virtualId === virtualId);
  };

  // Helper to get target for an installation (by id + context)
  const getTargetForInstallation = (
    inst: Installation
  ): TargetOption | undefined => {
    if (!inst.targetId) return undefined;

    // First try to find by exact context match
    if (inst.scInstallationContextId) {
      const match = availableTargets.find(
        (t) =>
          t.id === inst.targetId &&
          t.scInstallationId === inst.scInstallationContextId
      );
      if (match) return match;
    }

    // For Systems (non-virtual), just match by ID
    const systemMatch = availableTargets.find(
      (t) => t.id === inst.targetId && !t.isVirtual
    );
    if (systemMatch) return systemMatch;

    // Fallback: return first match (shouldn't happen if data is consistent)
    return availableTargets.find((t) => t.id === inst.targetId);
  };

  // Helper function to get effective target time bounds
  const getTargetTimeBounds = (
    targetId: string,
    scInstContextId?: string
  ): {
    beginning: number;
    ending: number;
    targetName: string;
    targetType: EntityType;
  } => {
    // Try to find the specific target option
    const targetOption = scInstContextId
      ? availableTargets.find(
          (t) => t.id === targetId && t.scInstallationId === scInstContextId
        )
      : availableTargets.find((t) => t.id === targetId);

    if (targetOption) {
      return {
        beginning: targetOption.bounds.beginning,
        ending: targetOption.bounds.ending,
        targetName: targetOption.displayName,
        targetType: targetOption.entityType,
      };
    }

    // Fallback
    const target = dataset.individuals.get(targetId);
    if (!target) {
      return {
        beginning: 0,
        ending: Model.END_OF_TIME,
        targetName: targetId,
        targetType: EntityType.System,
      };
    }

    const targetType = target.entityType ?? EntityType.Individual;
    const bounds = dataset.getTargetTimeBounds(targetId);

    return {
      ...bounds,
      targetName: target.name,
      targetType: targetType as EntityType,
    };
  };

  // Validate all installations for overlaps
  const validateAllInstallations = (
    currentInstallations: Installation[],
    currentRawInputs: RawInputs
  ) => {
    const newErrors: ValidationErrors = {};

    currentInstallations.forEach((inst) => {
      newErrors[inst.id] = {};
      const raw = currentRawInputs[inst.id] || { beginning: "0", ending: "" };

      if (inst.targetId === individual?.id) {
        newErrors[inst.id].target = "Cannot install into itself";
        return;
      }

      // Get target bounds using context
      const targetOption = getTargetForInstallation(inst);
      const bounds = targetOption?.bounds || {
        beginning: 0,
        ending: Model.END_OF_TIME,
      };

      const beginning = raw.beginning === "" ? 0 : parseFloat(raw.beginning);
      const ending =
        raw.ending === "" ? Model.END_OF_TIME : parseFloat(raw.ending);

      if (isNaN(beginning)) {
        newErrors[inst.id].beginning = "Must be a number";
      } else if (beginning < bounds.beginning) {
        newErrors[
          inst.id
        ].beginning = `Must be ≥ ${bounds.beginning} (target start)`;
      } else if (
        beginning >= bounds.ending &&
        bounds.ending < Model.END_OF_TIME
      ) {
        newErrors[
          inst.id
        ].beginning = `Must be < ${bounds.ending} (target end)`;
      }

      if (raw.ending !== "" && isNaN(ending)) {
        newErrors[inst.id].ending = "Must be a number";
      } else if (ending <= beginning) {
        newErrors[inst.id].ending = "Must be > beginning";
      } else if (ending > bounds.ending && bounds.ending < Model.END_OF_TIME) {
        newErrors[inst.id].ending = `Must be ≤ ${bounds.ending} (target end)`;
      }

      // Check for overlapping installations into the SAME target AND context
      if (inst.targetId) {
        const key = `${inst.targetId}__${
          inst.scInstallationContextId || "none"
        }`;
        const otherInstallationsInSameTarget = currentInstallations.filter(
          (other) => {
            if (other.id === inst.id) return false;
            const otherKey = `${other.targetId}__${
              other.scInstallationContextId || "none"
            }`;
            return otherKey === key;
          }
        );

        for (const other of otherInstallationsInSameTarget) {
          const otherRaw = currentRawInputs[other.id] || {
            beginning: "0",
            ending: "",
          };
          const otherBeginning =
            otherRaw.beginning === "" ? 0 : parseFloat(otherRaw.beginning);
          const otherEnding =
            otherRaw.ending === ""
              ? Model.END_OF_TIME
              : parseFloat(otherRaw.ending);

          if (
            !isNaN(beginning) &&
            !isNaN(ending) &&
            !isNaN(otherBeginning) &&
            !isNaN(otherEnding)
          ) {
            if (
              hasTimeOverlap(beginning, ending, otherBeginning, otherEnding)
            ) {
              newErrors[
                inst.id
              ].overlap = `Overlaps with another installation in the same target (${otherBeginning}-${
                otherEnding === Model.END_OF_TIME ? "∞" : otherEnding
              })`;
              break;
            }
          }
        }
      }
    });

    setErrors(newErrors);
    return newErrors;
  };

  // Add new installation
  const addInstallation = () => {
    const newInst: Installation = {
      id: uuidv4(),
      componentId: individual?.id ?? "",
      targetId: "",
      beginning: 0,
      ending: undefined,
      scInstallationContextId: undefined,
    };
    const newInstallations = [...installations, newInst];
    const newRawInputs = {
      ...rawInputs,
      [newInst.id]: { beginning: "0", ending: "" },
    };
    setInstallations(newInstallations);
    setRawInputs(newRawInputs);
    validateAllInstallations(newInstallations, newRawInputs);
  };

  // Remove installation
  const removeInstallation = (instId: string) => {
    const newInstallations = installations.filter((i) => i.id !== instId);
    const newRawInputs = { ...rawInputs };
    delete newRawInputs[instId];
    setInstallations(newInstallations);
    setRawInputs(newRawInputs);
    validateAllInstallations(newInstallations, newRawInputs);
  };

  // Update raw input and validate
  const updateRawInput = (
    instId: string,
    field: "beginning" | "ending",
    value: string
  ) => {
    const newRawInputs = {
      ...rawInputs,
      [instId]: {
        ...rawInputs[instId],
        [field]: value,
      },
    };
    setRawInputs(newRawInputs);
    validateAllInstallations(installations, newRawInputs);
  };

  // Update installation target using virtualId
  const updateInstallationTarget = (instId: string, virtualId: string) => {
    if (!virtualId) {
      // Clear target
      const newInstallations = installations.map((i) =>
        i.id === instId
          ? { ...i, targetId: "", scInstallationContextId: undefined }
          : i
      );
      setInstallations(newInstallations);
      validateAllInstallations(newInstallations, rawInputs);
      return;
    }

    const targetOption = getTargetByVirtualId(virtualId);
    if (!targetOption) return;

    const newInstallations = installations.map((i) =>
      i.id === instId
        ? {
            ...i,
            targetId: targetOption.id,
            scInstallationContextId: targetOption.scInstallationId,
          }
        : i
    );
    setInstallations(newInstallations);

    // Reset times to target bounds
    const newRawInputs = {
      ...rawInputs,
      [instId]: {
        beginning: String(targetOption.bounds.beginning),
        ending: "",
      },
    };
    setRawInputs(newRawInputs);
    validateAllInstallations(newInstallations, newRawInputs);
  };

  // Check if there are any validation errors
  const hasErrors = () => {
    return Object.values(errors).some(
      (e) => e.beginning || e.ending || e.overlap || e.target
    );
  };

  // Check if all installations have targets
  const allHaveTargets = () => {
    return installations.every((i) => i.targetId);
  };

  // Save changes
  const handleSave = () => {
    if (!individual || hasErrors() || !allHaveTargets()) return;

    const finalErrors = validateAllInstallations(installations, rawInputs);
    const hasFinalErrors = Object.values(finalErrors).some(
      (e) => e.beginning || e.ending || e.overlap || e.target
    );
    if (hasFinalErrors) return;

    const finalInstallations = installations.map((inst) => {
      const raw = rawInputs[inst.id];
      return {
        ...inst,
        beginning:
          raw?.beginning === "" ? 0 : parseFloat(raw?.beginning ?? "0"),
        ending: raw?.ending === "" ? undefined : parseFloat(raw?.ending ?? ""),
      };
    });

    const updated: Individual = {
      ...individual,
      installations: finalInstallations,
    };

    updateDataset((d: Model) => {
      d.individuals.set(individual.id, updated);
    });

    setShow(false);
  };

  const onHide = () => setShow(false);

  if (!individual) return null;

  // Group targets by type for the dropdown
  const systemTargets = availableTargets.filter(
    (t) => t.entityType === EntityType.System
  );
  const scTargets = availableTargets.filter(
    (t) => t.entityType === EntityType.SystemComponent
  );

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Edit Installations for {individual.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted mb-3">
          Configure where this System Component is installed. You can install it
          into Systems or other System Components (nested slots).
        </p>

        <Table striped bordered hover size="sm">
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Target</th>
              <th style={{ width: "20%" }}>Beginning</th>
              <th style={{ width: "20%" }}>Ending</th>
              <th style={{ width: "20%" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {installations.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted py-3">
                  <em>
                    No installations yet. Click "+ Add Installation" below to
                    add one.
                  </em>
                </td>
              </tr>
            ) : (
              installations.map((inst) => {
                const raw = rawInputs[inst.id] || {
                  beginning: "0",
                  ending: "",
                };
                const err = errors[inst.id] || {};
                const targetOption = getTargetForInstallation(inst);

                return (
                  <tr key={inst.id}>
                    <td>
                      <Form.Select
                        size="sm"
                        value={targetOption?.virtualId || ""}
                        onChange={(e) =>
                          updateInstallationTarget(inst.id, e.target.value)
                        }
                        className={
                          !inst.targetId
                            ? "border-warning"
                            : err.target
                            ? "border-danger"
                            : ""
                        }
                      >
                        <option value="">-- Select target --</option>
                        <optgroup label="Systems">
                          {systemTargets.map((target) => {
                            const boundsStr =
                              target.bounds.ending < Model.END_OF_TIME
                                ? ` (${target.bounds.beginning}-${target.bounds.ending})`
                                : target.bounds.beginning > 0
                                ? ` (${target.bounds.beginning}-∞)`
                                : "";
                            return (
                              <option
                                key={target.virtualId}
                                value={target.virtualId}
                              >
                                {target.displayName}
                                {boundsStr}
                              </option>
                            );
                          })}
                        </optgroup>
                        {scTargets.length > 0 && (
                          <optgroup label="System Components (Nested)">
                            {scTargets.map((target) => {
                              const boundsStr =
                                target.bounds.ending < Model.END_OF_TIME
                                  ? ` (${target.bounds.beginning}-${target.bounds.ending})`
                                  : target.bounds.beginning > 0
                                  ? ` (${target.bounds.beginning}-∞)`
                                  : "";
                              return (
                                <option
                                  key={target.virtualId}
                                  value={target.virtualId}
                                >
                                  {target.displayName}
                                  {boundsStr}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                      </Form.Select>
                      {targetOption && (
                        <Form.Text className="text-muted">
                          <small>
                            {targetOption.entityType ===
                            EntityType.SystemComponent
                              ? " "
                              : " "}
                            Available: {targetOption.bounds.beginning}-
                            {targetOption.bounds.ending >= Model.END_OF_TIME
                              ? "∞"
                              : targetOption.bounds.ending}
                          </small>
                        </Form.Text>
                      )}
                      {err.target && (
                        <Form.Text className="text-danger d-block">
                          <small>{err.target}</small>
                        </Form.Text>
                      )}
                      {err.overlap && (
                        <Form.Text className="text-danger d-block">
                          <small>{err.overlap}</small>
                        </Form.Text>
                      )}
                    </td>
                    <td>
                      <Form.Control
                        size="sm"
                        type="text"
                        value={raw.beginning}
                        onChange={(e) =>
                          updateRawInput(inst.id, "beginning", e.target.value)
                        }
                        isInvalid={!!err.beginning}
                        disabled={!inst.targetId}
                      />
                      {err.beginning && (
                        <Form.Text className="text-danger">
                          <small>{err.beginning}</small>
                        </Form.Text>
                      )}
                    </td>
                    <td>
                      <Form.Control
                        size="sm"
                        type="text"
                        value={raw.ending}
                        onChange={(e) =>
                          updateRawInput(inst.id, "ending", e.target.value)
                        }
                        isInvalid={!!err.ending}
                        placeholder="∞"
                        disabled={!inst.targetId}
                      />
                      {err.ending && (
                        <Form.Text className="text-danger">
                          <small>{err.ending}</small>
                        </Form.Text>
                      )}
                    </td>
                    <td>
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

        <Button variant="outline-primary" size="sm" onClick={addInstallation}>
          + Add Installation
        </Button>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={hasErrors() || !allHaveTargets()}
        >
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
