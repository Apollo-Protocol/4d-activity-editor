import React, {
  Dispatch,
  SetStateAction,
  useRef,
  useState,
  useEffect,
  useMemo,
} from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import ListGroup from "react-bootstrap/ListGroup";
import Alert from "react-bootstrap/Alert";
import { v4 as uuidv4 } from "uuid";
import Select, { MultiValue } from "react-select";
import {
  Individual,
  Id,
  Activity,
  Maybe,
  Participation,
  EntityType,
} from "@/lib/Schema";
import { Model } from "@/lib/Model";

interface Props {
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedActivity: Activity | undefined;
  setSelectedActivity: Dispatch<SetStateAction<Activity | undefined>>;
  individuals: Individual[];
  dataset: Model;
  updateDataset: Dispatch<Dispatch<Model>>;
  activityContext: Maybe<Id>;
  setActivityContext: Dispatch<Maybe<Id>>;
}

// Helper to check if this is an "installation reference" (virtual row)
function isInstallationRef(ind: Individual): boolean {
  return ind.id.includes("__installed_in__");
}

// Get the original component ID from an installation reference
function getOriginalId(ind: Individual): string {
  if (isInstallationRef(ind)) {
    return ind.id.split("__installed_in__")[0];
  }
  return ind.id;
}

// Get the slot ID from an installation reference
function getSlotId(ind: Individual): string | undefined {
  if (isInstallationRef(ind)) {
    const rest = ind.id.split("__installed_in__")[1];
    if (rest) {
      // Format: slotId__installationId or just slotId (old format)
      const parts = rest.split("__");
      return parts[0];
    }
  }
  return undefined;
}

// Get the installation ID from an installation reference
function getInstallationId(ind: Individual): string | undefined {
  if (isInstallationRef(ind)) {
    const rest = ind.id.split("__installed_in__")[1];
    if (rest) {
      const parts = rest.split("__");
      return parts[1]; // installationId is the second part
    }
  }
  return undefined;
}

// Define the option type for the Select component
type IndividualOption = Individual & { displayLabel: string };

const SetActivity = (props: Props) => {
  const {
    show,
    setShow,
    selectedActivity,
    setSelectedActivity,
    individuals,
    dataset,
    updateDataset,
    activityContext,
    setActivityContext,
  } = props;

  let defaultActivity: Activity = {
    id: "",
    name: "",
    type: dataset.defaultActivityType,
    description: "",
    beginning: 0,
    ending: 1,
    participations: new Map<string, Participation>(),
    partOf: activityContext,
  };

  const [inputs, setInputs] = useState(defaultActivity);
  const [errors, setErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  // Custom activity-type selector state (search / create / inline edit)
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState("");
  const typeDropdownRef = useRef<HTMLDivElement | null>(null);
  const [showParentModal, setShowParentModal] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // Build the individuals list with proper labels for the Select component
  const individualsWithLabels = useMemo<IndividualOption[]>(() => {
    const individualsArray = Array.from(dataset.individuals.values());

    // Helper to get the hierarchy label for an individual
    const getHierarchyLabel = (
      ind: Individual,
      installation?: { beginning: number; ending: number }
    ): string => {
      const entityType = ind.entityType ?? EntityType.Individual;

      // For installation references, build full path: System - Slot - Component (time range)
      if (isInstallationRef(ind)) {
        const originalId = getOriginalId(ind);
        const slotId = getSlotId(ind);
        const installationId = getInstallationId(ind);

        if (slotId) {
          const slot = dataset.individuals.get(slotId);
          const originalComponent = dataset.individuals.get(originalId);

          if (slot && originalComponent) {
            // Get time range from the installation
            let timeRange = "";
            if (installation) {
              const endStr =
                installation.ending >= Model.END_OF_TIME
                  ? "∞"
                  : installation.ending;
              timeRange = ` (${installation.beginning}-${endStr})`;
            } else if (originalComponent.installations) {
              const inst = originalComponent.installations.find(
                (i) => i.id === installationId
              );
              if (inst) {
                const endStr =
                  (inst.ending ?? Model.END_OF_TIME) >= Model.END_OF_TIME
                    ? "∞"
                    : inst.ending;
                timeRange = ` (${inst.beginning ?? 0}-${endStr})`;
              }
            }

            // Find the parent system of the slot
            if (slot.parentSystemId) {
              const system = dataset.individuals.get(slot.parentSystemId);
              if (system) {
                return `${system.name} → ${slot.name} → ${originalComponent.name}${timeRange}`;
              }
            }
            return `${slot.name} → ${originalComponent.name}${timeRange}`;
          }
        }
        return `${ind.name} (installed component)`;
      }

      // For SystemComponents, show: System → Component (slot)
      if (entityType === EntityType.SystemComponent) {
        if (ind.parentSystemId) {
          const parent = dataset.individuals.get(ind.parentSystemId);
          if (parent) {
            return `${parent.name} → ${ind.name} (slot)`;
          }
        }
        return `${ind.name} (slot)`;
      }

      // For Systems
      if (entityType === EntityType.System) {
        return `${ind.name} (system)`;
      }

      // For InstalledComponents at top level (for management, not participation)
      if (entityType === EntityType.InstalledComponent) {
        return `${ind.name} (component - click to manage installations)`;
      }

      // For regular individuals
      return ind.name;
    };

    const result: IndividualOption[] = [];
    const visited = new Set<string>();
    const addedVirtualIds = new Set<string>();

    const addWithDescendants = (ind: Individual) => {
      if (visited.has(ind.id)) return;
      visited.add(ind.id);

      const entityType = ind.entityType ?? EntityType.Individual;

      // Skip top-level InstalledComponents - they can't participate directly
      // Only their installation period rows can participate
      if (entityType === EntityType.InstalledComponent) {
        // Don't add - will be added as installation refs under slots
        return;
      }

      result.push({
        ...ind,
        displayLabel: getHierarchyLabel(ind),
      });

      // Find SystemComponent children
      const children: Individual[] = [];
      individualsArray.forEach((child) => {
        const childEntityType = child.entityType ?? EntityType.Individual;
        if (
          childEntityType === EntityType.SystemComponent &&
          child.parentSystemId === ind.id
        ) {
          children.push(child);
        }
      });

      children
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((child) => addWithDescendants(child));

      // Add installation references for SystemComponents
      const indEntityType = ind.entityType ?? EntityType.Individual;
      if (indEntityType === EntityType.SystemComponent) {
        const installedHere = individualsArray.filter((ic) => {
          const icType = ic.entityType ?? EntityType.Individual;
          if (icType !== EntityType.InstalledComponent) return false;
          if (!ic.installations || ic.installations.length === 0) return false;
          return ic.installations.some((inst) => inst.targetId === ind.id);
        });

        installedHere
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((ic) => {
            // Get ALL installations for this component in this slot
            const installationsInSlot = (ic.installations || []).filter(
              (inst) => inst.targetId === ind.id
            );

            // Create a SEPARATE virtual row for EACH installation period
            installationsInSlot.forEach((inst) => {
              // Format: componentId__installed_in__slotId__installationId
              const virtualId = `${ic.id}__installed_in__${ind.id}__${inst.id}`;

              // Skip if already added
              if (addedVirtualIds.has(virtualId)) return;
              addedVirtualIds.add(virtualId);

              const installRef: IndividualOption = {
                ...ic,
                id: virtualId,
                beginning: inst.beginning ?? 0,
                ending: inst.ending ?? Model.END_OF_TIME,
                _installationId: inst.id,
                displayLabel: "", // Will be set below
              };
              installRef.displayLabel = getHierarchyLabel(installRef, {
                beginning: inst.beginning ?? 0,
                ending: inst.ending ?? Model.END_OF_TIME,
              });
              result.push(installRef);
            });
          });
      }
    };

    // Start with top-level items
    const topLevel = individualsArray.filter((ind) => {
      const entityType = ind.entityType ?? EntityType.Individual;
      if (entityType === EntityType.System) return true;
      if (entityType === EntityType.Individual) return true;
      if (entityType === EntityType.InstalledComponent) return false; // Skip - only shown as virtual rows
      if (entityType === EntityType.SystemComponent) {
        if (!ind.parentSystemId) return true;
        const parentExists = individualsArray.some(
          (i) => i.id === ind.parentSystemId
        );
        return !parentExists;
      }
      return false;
    });

    topLevel
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((ind) => addWithDescendants(ind));

    return result;
  }, [dataset]);

  // Safe local ancestor check (walks partOf chain). Avoids depending on Model.isAncestor.
  const isAncestorLocal = (
    ancestorId: string,
    descendantId: string
  ): boolean => {
    let cur = dataset.activities.get(descendantId);
    while (cur && cur.partOf) {
      if (cur.partOf === ancestorId) return true;
      cur = dataset.activities.get(cur.partOf as string);
    }
    return false;
  };

  function updateIndividuals(d: Model) {
    d.individuals.forEach((individual) => {
      const earliestBeginning = d.earliestParticipantBeginning(individual.id);
      const latestEnding = d.lastParticipantEnding(individual.id);
      if (individual.beginning >= 0) {
        individual.beginning = earliestBeginning ? earliestBeginning : -1;
      }
      if (individual.ending < Model.END_OF_TIME) {
        individual.ending = latestEnding;
      }
      d.addIndividual(individual);
    });
  }

  // click outside to close type dropdown
  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(ev.target as Node)
      ) {
        setTypeOpen(false);
        setEditingTypeId(null);
        setEditingTypeValue("");
      }
    }
    if (typeOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [typeOpen]);

  const handleClose = () => {
    setShow(false);
    setInputs(defaultActivity);
    setSelectedActivity(undefined);
    setErrors([]);
    setDirty(false);
  };
  const handleShow = () => {
    if (selectedActivity) {
      setInputs(selectedActivity);
    } else {
      defaultActivity.id = uuidv4();
      setInputs(defaultActivity);
    }
  };
  const handleAdd = (event: any) => {
    event.preventDefault();
    if (!dirty) return handleClose();
    const isValid = validateInputs();
    if (isValid) {
      updateDataset((d) => {
        d.addActivity(inputs);
        updateIndividuals(d);
      });
      handleClose();
    }
  };
  const handleCopy = (event: any) => {
    let copied = { ...inputs };
    copied.id = uuidv4();
    copied.name = copied.name + " (copied)";
    setInputs(copied);
  };
  const handleDelete = (event: any) => {
    updateDataset((d) => {
      d.removeActivity(inputs.id);
      updateIndividuals(d);
    });
    handleClose();
  };
  const handleContext = (event: any) => {
    handleAdd(event);
    setActivityContext(inputs.id);
  };

  /* React only calls change handlers if the value has really changed. */
  const updateInputs = (key: string, value: any) => {
    setInputs({ ...inputs, [key]: value });
    setDirty(true);
  };

  const handleChange = (e: any) => {
    updateInputs(e.target.name, e.target.value);
  };

  const handleChangeNumeric = (e: any) => {
    updateInputs(e.target.name, e.target.valueAsNumber);
  };

  const handleChangeMultiselect = (newValue: MultiValue<IndividualOption>) => {
    const participations = new Map<string, Participation>();
    newValue.forEach((i) => {
      const old = inputs.participations.get(i.id)?.role;
      let participation: Participation = {
        individualId: i.id,
        role: old ?? dataset.defaultRole,
      };
      participations.set(i.id, participation);
    });
    updateInputs("participations", participations);
  };

  const getSelectedIndividuals = (): IndividualOption[] => {
    if (
      selectedActivity === undefined ||
      selectedActivity.participations === undefined
    ) {
      return [];
    }
    const individualIds = Array.from(
      selectedActivity.participations,
      ([key]) => key
    );
    // Find matching individuals from our labeled list
    const participatingIndividuals = individualsWithLabels.filter(
      (participant) => {
        return individualIds.includes(participant.id);
      }
    );
    return participatingIndividuals;
  };

  const validateInputs = () => {
    let runningErrors: string[] = [];
    //Name
    if (!inputs.name) {
      runningErrors.push("Name field is required");
    }
    //Type
    if (!inputs.type) {
      runningErrors.push("Type field is required");
    }
    //Ending and beginning
    if (inputs.ending - inputs.beginning <= 0) {
      runningErrors.push("Ending must be after beginning");
    }
    if (inputs.ending >= Model.END_OF_TIME) {
      runningErrors.push("Ending cannot be greater than " + Model.END_OF_TIME);
    }
    //Participant count
    if (
      inputs.participations === undefined ||
      inputs.participations?.size < 1
    ) {
      runningErrors.push("Select at least one participant");
    }

    // Helper function to check if there's ANY overlap between two time ranges
    const hasOverlap = (
      aStart: number,
      aEnd: number,
      iStart: number,
      iEnd: number
    ): boolean => {
      return aStart < iEnd && aEnd > iStart;
    };

    // Validate activity timing against installed component installation periods
    if (inputs.participations) {
      inputs.participations.forEach((participation, participantId) => {
        if (isInstallationRef({ id: participantId } as Individual)) {
          const originalId = participantId.split("__installed_in__")[0];
          const slotId = participantId.split("__installed_in__")[1];

          const installedComponent = dataset.individuals.get(originalId);
          if (installedComponent?.installations) {
            const installation = installedComponent.installations.find(
              (inst) => inst.targetId === slotId
            );

            if (installation) {
              const installStart = installation.beginning ?? 0;
              const installEnd = installation.ending ?? Model.END_OF_TIME;

              // Only error if there's NO overlap at all
              // Partial overlap is allowed - the participation will be cropped visually
              if (
                !hasOverlap(
                  inputs.beginning,
                  inputs.ending,
                  installStart,
                  installEnd
                )
              ) {
                const slot = dataset.individuals.get(slotId);
                const slotName = slot?.name ?? slotId;
                runningErrors.push(
                  `Activity timing (${inputs.beginning}-${inputs.ending}) has no overlap with installation period ` +
                    `of "${
                      installedComponent.name
                    }" in "${slotName}" (${installStart}-${
                      installEnd === Model.END_OF_TIME ? "∞" : installEnd
                    })`
                );
              }
            }
          }
        }
      });
    }

    if (runningErrors.length == 0) {
      return true;
    } else {
      setErrors(runningErrors);
      return false;
    }
  };

  // ----- New helper functions for custom activity-type selector -----
  const filteredTypes = dataset.activityTypes.filter((t) =>
    t.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const showCreateTypeOption =
    typeSearch.trim().length > 0 &&
    !dataset.activityTypes.some(
      (t) => t.name.toLowerCase() === typeSearch.trim().toLowerCase()
    );

  const handleSelectType = (typeId: string) => {
    const t = dataset.activityTypes.find((x) => x.id === typeId);
    if (t) updateInputs("type", t);
    setTypeOpen(false);
    setTypeSearch("");
    setEditingTypeId(null);
    setEditingTypeValue("");
  };

  const handleCreateTypeFromSearch = () => {
    const name = typeSearch.trim();
    if (!name) return;
    const newId = uuidv4();

    updateDataset((d) => {
      d.addActivityType(newId, name);
      return d;
    });

    // Immediately select the newly created type for this form
    updateInputs("type", { id: newId, name, isCoreHqdm: false });
    setTypeOpen(false);
    setTypeSearch("");
  };

  const startEditType = (typeId: string, currentName: string, e: any) => {
    e.stopPropagation();
    const found = dataset.activityTypes.find((x) => x.id === typeId);
    if (found && found.isCoreHqdm) return;
    setEditingTypeId(typeId);
    setEditingTypeValue(currentName);
  };

  const saveEditType = () => {
    if (!editingTypeId) return;
    const newName = editingTypeValue.trim();
    if (!newName) return;

    updateDataset((d) => {
      const kind = d.activityTypes.find((x) => x.id === editingTypeId);
      if (kind) kind.name = newName;

      // update activities that reference this type to use canonical Kind
      d.activities.forEach((a) => {
        if (a.type && a.type.id === editingTypeId) {
          const canonical = d.activityTypes.find((x) => x.id === editingTypeId);
          if (canonical) a.type = canonical;
        }
      });

      if (d.defaultActivityType && d.defaultActivityType.id === editingTypeId) {
        const canonical = d.activityTypes.find((x) => x.id === editingTypeId);
        if (canonical) d.defaultActivityType = canonical;
      }

      return d;
    });

    updateInputs("type", {
      id: editingTypeId,
      name: newName,
      isCoreHqdm: false,
    });
    setEditingTypeId(null);
    setEditingTypeValue("");
  };

  const cancelEditType = () => {
    setEditingTypeId(null);
    setEditingTypeValue("");
  };
  // ----- end helpers -----

  const handlePromote = () => {
    if (!inputs || !inputs.partOf) return;
    // find current parent and then its parent (grandparent) - that's the new parent
    const currentParent = dataset.getParent(inputs.partOf as Id);
    const grandParent = currentParent
      ? dataset.getParent(currentParent.id)
      : undefined;
    const newParentId = grandParent ? grandParent.id : null;

    // confirm if child outside of new parent's timeframe
    if (newParentId) {
      const parentAct = dataset.activities.get(newParentId);
      if (
        parentAct &&
        (inputs.beginning < parentAct.beginning ||
          inputs.ending > parentAct.ending)
      ) {
        if (
          !window.confirm(
            `Promoting will require expanding "${parentAct.name}" timeframe to include this activity. Proceed?`
          )
        ) {
          return;
        }
      }
    }

    updateDataset((d) => {
      d.setActivityParent(inputs.id, newParentId, true);
      return d;
    });
    updateInputs("partOf", newParentId ?? undefined);
  };

  const openChangeParent = () => {
    // prepare list in modal by setting default selection to current parent
    setSelectedParentId(inputs.partOf ? (inputs.partOf as string) : null);
    setShowParentModal(true);
  };

  const handleApplyParent = () => {
    updateDataset((d) => {
      d.setActivityParent(inputs.id, selectedParentId ?? null);
      return d;
    });
    updateInputs("partOf", selectedParentId ?? undefined);
    setShowParentModal(false);
  };

  // Add helper function to get slot effective bounds
  const getSlotEffectiveTimeBounds = (
    slotId: string
  ): { beginning: number; ending: number } => {
    const slot = dataset.individuals.get(slotId);
    if (!slot) {
      return { beginning: 0, ending: Model.END_OF_TIME };
    }

    let beginning = slot.beginning;
    let ending = slot.ending;

    if (beginning < 0 && slot.parentSystemId) {
      const parentSystem = dataset.individuals.get(slot.parentSystemId);
      if (parentSystem) {
        beginning = parentSystem.beginning >= 0 ? parentSystem.beginning : 0;
      } else {
        beginning = 0;
      }
    } else if (beginning < 0) {
      beginning = 0;
    }

    if (ending >= Model.END_OF_TIME && slot.parentSystemId) {
      const parentSystem = dataset.individuals.get(slot.parentSystemId);
      if (parentSystem && parentSystem.ending < Model.END_OF_TIME) {
        ending = parentSystem.ending;
      }
    }

    return { beginning, ending };
  };

  // Update eligibleParticipants to also check slot bounds
  const eligibleParticipants = useMemo<IndividualOption[]>(() => {
    const actStart = inputs.beginning;
    const actEnd = inputs.ending;

    const hasTimeOverlap = (ind: IndividualOption): boolean => {
      let indStart = ind.beginning >= 0 ? ind.beginning : 0;
      let indEnd = ind.ending < Model.END_OF_TIME ? ind.ending : Infinity;

      // For installation references, also constrain to slot bounds
      if (isInstallationRef(ind)) {
        const slotId = getSlotId(ind);
        if (slotId) {
          const slotBounds = getSlotEffectiveTimeBounds(slotId);
          indStart = Math.max(indStart, slotBounds.beginning);
          if (slotBounds.ending < Model.END_OF_TIME) {
            indEnd = Math.min(indEnd, slotBounds.ending);
          }
        }
      }

      // Check overlap
      return actStart < indEnd && actEnd > indStart;
    };

    return individualsWithLabels.filter((ind) => {
      if (!isInstallationRef(ind)) {
        const entityType = ind.entityType ?? EntityType.Individual;
        if (ind.beginning >= 0 && ind.ending < Model.END_OF_TIME) {
          return hasTimeOverlap(ind);
        }
        return true;
      }
      return hasTimeOverlap(ind);
    });
  }, [individualsWithLabels, inputs.beginning, inputs.ending, dataset]);

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setShow(true)}
        className={individuals.length > 0 ? "mx-1 d-block" : "mx-1 d-none"}
      >
        Add Activity
      </Button>

      <Modal show={show} onHide={handleClose} onShow={handleShow}>
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedActivity ? "Edit Activity" : "Add Activity"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAdd}>
            <Form.Group className="mb-3" controlId="formIndividualName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={inputs.name}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="formIndividualType">
              <Form.Label>Type</Form.Label>
              <div
                ref={typeDropdownRef}
                className="position-relative"
                style={{ zIndex: 1050 }}
              >
                <button
                  type="button"
                  className="w-100 btn btn-outline-secondary d-flex justify-content-between align-items-center"
                  onClick={() => setTypeOpen((s) => !s)}
                >
                  <span className="text-truncate">
                    {inputs?.type?.name || "Select type..."}
                  </span>
                  <span style={{ marginLeft: 8 }}>▾</span>
                </button>

                {typeOpen && (
                  <div
                    className="card mt-1"
                    style={{ maxHeight: 300, overflow: "hidden" }}
                  >
                    <div className="card-body p-2 border-bottom">
                      <input
                        className="form-control form-control-sm"
                        placeholder="Search or create type..."
                        value={typeSearch}
                        onChange={(e) => setTypeSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && showCreateTypeOption) {
                            e.preventDefault();
                            handleCreateTypeFromSearch();
                          }
                        }}
                        autoFocus
                      />
                    </div>

                    <div style={{ maxHeight: 180, overflow: "auto" }}>
                      {filteredTypes.map((t) => (
                        <div
                          key={t.id}
                          className={`d-flex align-items-center justify-content-between px-3 py-2 ${
                            inputs?.type?.id === t.id
                              ? "bg-primary text-white"
                              : ""
                          }`}
                          style={{ cursor: "pointer" }}
                          onClick={() => handleSelectType(t.id)}
                        >
                          {editingTypeId === t.id ? (
                            <div className="d-flex align-items-center w-100">
                              <input
                                className="form-control form-control-sm me-2"
                                value={editingTypeValue}
                                onChange={(e) =>
                                  setEditingTypeValue(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditType();
                                  if (e.key === "Escape") cancelEditType();
                                }}
                                autoFocus
                              />
                              <div className="d-flex align-items-center">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success me-1"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    saveEditType();
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    cancelEditType();
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-grow-1">{t.name}</div>
                              <div className="d-flex align-items-center">
                                {inputs?.type?.id === t.id && (
                                  <span className="me-2">✓</span>
                                )}
                                {!t.isCoreHqdm && (
                                  <button
                                    type="button"
                                    className={`btn btn-sm btn-link p-0 ${
                                      inputs?.type?.id === t.id
                                        ? "text-white"
                                        : ""
                                    }`}
                                    onClick={(e) =>
                                      startEditType(t.id, t.name, e)
                                    }
                                  >
                                    edit
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {showCreateTypeOption && (
                        <div
                          className="px-3 py-2 text-primary fw-medium border-top"
                          style={{ cursor: "pointer" }}
                          onClick={handleCreateTypeFromSearch}
                        >
                          Create "{typeSearch}"
                        </div>
                      )}

                      {filteredTypes.length === 0 && !showCreateTypeOption && (
                        <div className="p-3 text-muted small">
                          No results found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Form.Group>
            <Form.Group className="mb-3" controlId="formIndividualDescription">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                name="description"
                value={inputs.description}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="formIndividualBeginning">
              <Form.Label>Beginning</Form.Label>
              <Form.Control
                type="number"
                name="beginning"
                value={inputs.beginning}
                onChange={handleChangeNumeric}
                step="1"
                min="0"
                max={Model.END_OF_TIME - 2}
                className="form-control"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="formIndividualEnding">
              <Form.Label>Ending</Form.Label>
              <Form.Control
                type="number"
                name="ending"
                step="1"
                min="1"
                max={Model.END_OF_TIME - 1}
                value={inputs.ending}
                onChange={handleChangeNumeric}
                className="form-control"
              />
            </Form.Group>

            {/* UPDATED: Use eligibleParticipants instead of individualsWithLabels */}
            <Form.Group className="mb-3" controlId="formParticipants">
              <Form.Label>
                Participants
                {eligibleParticipants.length < individualsWithLabels.length && (
                  <small className="text-muted ms-2">
                    (filtered by activity time {inputs.beginning}-
                    {inputs.ending})
                  </small>
                )}
              </Form.Label>
              <Select<IndividualOption, true>
                defaultValue={getSelectedIndividuals()}
                isMulti
                options={eligibleParticipants}
                getOptionLabel={(option) => option.displayLabel}
                getOptionValue={(option) => option.id}
                onChange={handleChangeMultiselect}
                noOptionsMessage={() =>
                  "No participants available for this time range"
                }
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <div className="w-100 d-flex justify-content-between align-items-center">
            <div>
              <Button
                className={selectedActivity ? "d-inline-block me-2" : "d-none"}
                variant="danger"
                onClick={handleDelete}
              >
                Delete
              </Button>
              <Button
                className={selectedActivity ? "d-inline-block me-2" : "d-none"}
                variant="primary"
                onClick={handleCopy}
              >
                Copy
              </Button>
              <Button
                className={selectedActivity ? "d-inline-block me-2" : "d-none"}
                variant="secondary"
                onClick={handleContext}
              >
                Sub-tasks
              </Button>
            </div>
            <div className="d-flex">
              <Button
                className={selectedActivity ? "d-inline-block me-2" : "d-none"}
                variant="secondary"
                onClick={handlePromote}
                title="Promote (move up one level)"
              >
                Promote
              </Button>
              <Button
                className={selectedActivity ? "d-inline-block me-1" : "d-none"}
                variant="danger"
                onClick={openChangeParent}
                title="Swap parent (assign as sub-task of another activity)"
              >
                Swap Parent
              </Button>
            </div>
          </div>
          <div>
            <div className="d-flex">
              <Button
                className="mx-1"
                variant="secondary"
                onClick={handleClose}
              >
                Close
              </Button>
              <Button
                className="mx-1"
                variant="primary"
                onClick={handleAdd}
                disabled={!dirty}
              >
                Save
              </Button>
            </div>
          </div>
          <div className="w-100 mt-2">
            {errors.length > 0 && (
              <Alert variant={"danger"} className="p-2 m-0">
                {errors.map((error, i) => (
                  <p key={i} className="mb-1">
                    {error}
                  </p>
                ))}
              </Alert>
            )}
          </div>
        </Modal.Footer>
      </Modal>

      {/* Parent chooser modal */}
      <Modal show={showParentModal} onHide={() => setShowParentModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Choose parent activity (or None)</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ListGroup>
            <ListGroup.Item
              action
              active={selectedParentId === null}
              onClick={() => setSelectedParentId(null)}
            >
              None (make top-level)
            </ListGroup.Item>
            {Array.from(dataset.activities.values())
              .filter((a) => {
                // exclude self and descendants
                if (!inputs || !inputs.id) return false;
                if (a.id === inputs.id) return false;
                if (isAncestorLocal(inputs.id, a.id)) return false; // avoid cycles
                return true;
              })
              .map((a) => {
                const parentName =
                  a.partOf && dataset.activities.get(a.partOf as string)
                    ? dataset.activities.get(a.partOf as string)!.name
                    : a.partOf ?? "";
                return (
                  <ListGroup.Item
                    key={a.id}
                    action
                    active={selectedParentId === a.id}
                    onClick={() => setSelectedParentId(a.id)}
                  >
                    {a.name} {parentName ? `(Part of ${parentName})` : ""}
                  </ListGroup.Item>
                );
              })}
          </ListGroup>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowParentModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApplyParent}>
            Apply
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SetActivity;
