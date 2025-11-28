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

// Get the target ID (System for SystemComponent, SystemComponent for InstalledComponent) from an installation reference
function getTargetId(ind: Individual): string | undefined {
  if (isInstallationRef(ind)) {
    const rest = ind.id.split("__installed_in__")[1];
    if (rest) {
      // Format: targetId__installationId or just targetId (old format)
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

  // Helper to get effective time bounds for a target (System or SystemComponent)
  const getTargetEffectiveTimeBounds = (
    targetId: string
  ): { beginning: number; ending: number } => {
    const target = dataset.individuals.get(targetId);
    if (!target) {
      return { beginning: 0, ending: Model.END_OF_TIME };
    }

    let beginning = target.beginning;
    let ending = target.ending;

    const targetType = target.entityType ?? EntityType.Individual;

    // If target is a SystemComponent, get bounds from its installation into a System
    if (targetType === EntityType.SystemComponent) {
      if (target.installations && target.installations.length > 0) {
        // Use the union of all installation periods
        const instBeginnings = target.installations.map((inst) =>
          Math.max(0, inst.beginning ?? 0)
        );
        const instEndings = target.installations.map(
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
    }

    // If target is a System, use its defined bounds
    if (targetType === EntityType.System) {
      if (beginning < 0) beginning = 0;
    }

    if (beginning < 0) beginning = 0;

    return { beginning, ending };
  };

  // Build the individuals list with proper labels for the Select component
  const individualsWithLabels = useMemo<IndividualOption[]>(() => {
    const result: IndividualOption[] = [];
    const addedIds = new Set<string>();

    // Helper to create an option
    const addOption = (
      ind: Individual,
      overrideId?: string,
      overrideName?: string,
      installation?: { beginning: number; ending: number; id: string }
    ) => {
      const id = overrideId || ind.id;
      if (addedIds.has(id)) return;
      addedIds.add(id);

      let displayLabel = overrideName || ind.name;

      // Add timing info if it's an installation
      if (installation) {
        const endStr =
          installation.ending >= Model.END_OF_TIME ? "∞" : installation.ending;
        // If the name doesn't already contain timing info, add it
        if (!displayLabel.includes(`(${installation.beginning}-`)) {
          displayLabel += ` (${installation.beginning}-${endStr})`;
        }
      }

      result.push({
        ...ind,
        id: id,
        name: overrideName || ind.name, // Keep name clean for display in chip
        displayLabel: displayLabel, // Full label for dropdown
        beginning: installation ? installation.beginning : ind.beginning,
        ending: installation ? installation.ending : ind.ending,
        _installationId: installation ? installation.id : undefined,
      });
    };

    // Collect all entities by type
    const systems: Individual[] = [];
    const systemComponents: Individual[] = [];
    const installedComponents: Individual[] = [];
    const regularIndividuals: Individual[] = [];

    dataset.individuals.forEach((ind) => {
      const entityType = ind.entityType ?? EntityType.Individual;
      switch (entityType) {
        case EntityType.System:
          systems.push(ind);
          break;
        case EntityType.SystemComponent:
          systemComponents.push(ind);
          break;
        case EntityType.InstalledComponent:
          installedComponents.push(ind);
          break;
        default:
          regularIndividuals.push(ind);
          break;
      }
    });

    // Sort each group
    const sortByName = (a: Individual, b: Individual) =>
      a.name.localeCompare(b.name);
    systems.sort(sortByName);
    systemComponents.sort(sortByName);
    installedComponents.sort(sortByName);
    regularIndividuals.sort(sortByName);

    // 1. Systems and their nested hierarchy (matching Model.getDisplayIndividuals)
    systems.forEach((system) => {
      // Add System
      addOption(system, undefined, `${system.name} (System)`);

      // Find SystemComponents installed in this System
      systemComponents.forEach((sc) => {
        const installations = sc.installations || [];
        const installationsInSystem = installations.filter(
          (inst) => inst.targetId === system.id
        );

        installationsInSystem.sort(
          (a, b) => (a.beginning ?? 0) - (b.beginning ?? 0)
        );

        installationsInSystem.forEach((inst) => {
          const virtualId = `${sc.id}__installed_in__${system.id}__${inst.id}`;
          const label = `${system.name} → ${sc.name}`;

          addOption(sc, virtualId, label, {
            beginning: inst.beginning ?? 0,
            ending: inst.ending ?? Model.END_OF_TIME,
            id: inst.id,
          });

          // Under this SystemComponent virtual row, add InstalledComponents
          installedComponents.forEach((ic) => {
            const icInstallations = ic.installations || [];
            const installationsInSlot = icInstallations.filter(
              (icInst) => icInst.targetId === sc.id
            );

            installationsInSlot.sort(
              (a, b) => (a.beginning ?? 0) - (b.beginning ?? 0)
            );

            installationsInSlot.forEach((icInst) => {
              // Check overlap with the SystemComponent's installation in the System
              const scStart = inst.beginning ?? 0;
              const scEnd = inst.ending ?? Model.END_OF_TIME;
              const icStart = icInst.beginning ?? 0;
              const icEnd = icInst.ending ?? Model.END_OF_TIME;

              if (icStart < scEnd && icEnd > scStart) {
                // Use context suffix to allow same IC installation to appear under multiple SC occurrences
                const contextSuffix = `__ctx_${inst.id}`;
                const icVirtualId = `${ic.id}__installed_in__${sc.id}__${icInst.id}${contextSuffix}`;
                const icLabel = `${system.name} → ${sc.name} → ${ic.name}`;

                addOption(ic, icVirtualId, icLabel, {
                  beginning: icInst.beginning ?? 0,
                  ending: icInst.ending ?? Model.END_OF_TIME,
                  id: icInst.id,
                });
              }
            });
          });
        });
      });
    });

    // 2. SystemComponents (top level)
    systemComponents.forEach((sc) => {
      addOption(sc, undefined, `${sc.name} (System Component - Top Level)`);
    });

    // 3. InstalledComponents (top level)
    installedComponents.forEach((ic) => {
      addOption(ic, undefined, `${ic.name} (Installed Component - Top Level)`);
    });

    // 4. Regular Individuals
    regularIndividuals.forEach((ind) => {
      addOption(ind);
    });

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
      const entityType = individual.entityType ?? EntityType.Individual;

      // Only update timing for regular Individuals that have participant-based timing enabled
      // Do NOT update Systems, SystemComponents, or InstalledComponents - they manage their own timelines
      if (
        entityType === EntityType.System ||
        entityType === EntityType.SystemComponent ||
        entityType === EntityType.InstalledComponent
      ) {
        return; // Skip - these types have their own fixed timelines
      }

      // For regular Individuals, only update if they have the "begins/ends with participant" flags
      const earliestBeginning = d.earliestParticipantBeginning(individual.id);
      const latestEnding = d.lastParticipantEnding(individual.id);

      // Only update beginning if the individual has beginsWithParticipant enabled
      if (individual.beginsWithParticipant && individual.beginning >= 0) {
        individual.beginning = earliestBeginning ? earliestBeginning : -1;
      }

      // Only update ending if the individual has endsWithParticipant enabled
      if (
        individual.endsWithParticipant &&
        individual.ending < Model.END_OF_TIME
      ) {
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
          const rest = participantId.split("__installed_in__")[1];
          const parts = rest.split("__");
          const targetId = parts[0];
          const installationId = parts[1];

          const component = dataset.individuals.get(originalId);
          if (component?.installations) {
            // Find the specific installation
            const installation = installationId
              ? component.installations.find(
                  (inst) => inst.id === installationId
                )
              : component.installations.find(
                  (inst) => inst.targetId === targetId
                );

            if (installation) {
              const installStart = installation.beginning ?? 0;
              const installEnd = installation.ending ?? Model.END_OF_TIME;

              // Get target bounds to further constrain
              const targetBounds = getTargetEffectiveTimeBounds(targetId);
              const effectiveStart = Math.max(
                installStart,
                targetBounds.beginning
              );
              const effectiveEnd = Math.min(
                installEnd,
                targetBounds.ending < Model.END_OF_TIME
                  ? targetBounds.ending
                  : installEnd
              );

              // Only error if there's NO overlap at all
              if (
                !hasOverlap(
                  inputs.beginning,
                  inputs.ending,
                  effectiveStart,
                  effectiveEnd
                )
              ) {
                const target = dataset.individuals.get(targetId);
                const targetName = target?.name ?? targetId;
                runningErrors.push(
                  `Activity timing (${inputs.beginning}-${inputs.ending}) has no overlap with installation period ` +
                    `of "${
                      component.name
                    }" in "${targetName}" (${effectiveStart}-${
                      effectiveEnd === Model.END_OF_TIME ? "∞" : effectiveEnd
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

  // Update eligibleParticipants to check target bounds via installations
  const eligibleParticipants = useMemo<IndividualOption[]>(() => {
    const actStart = inputs.beginning;
    const actEnd = inputs.ending;

    const hasTimeOverlap = (ind: IndividualOption): boolean => {
      let indStart = ind.beginning >= 0 ? ind.beginning : 0;
      let indEnd = ind.ending < Model.END_OF_TIME ? ind.ending : Infinity;

      // For installation references, also constrain to target bounds
      if (isInstallationRef(ind)) {
        const targetId = getTargetId(ind);
        if (targetId) {
          const targetBounds = getTargetEffectiveTimeBounds(targetId);
          indStart = Math.max(indStart, targetBounds.beginning);
          if (targetBounds.ending < Model.END_OF_TIME) {
            indEnd = Math.min(indEnd, targetBounds.ending);
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
