import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import { Model } from "../lib/Model";
import { EntityType, Individual, Installation } from "../lib/Schema";
import { v4 as uuidv4 } from "uuid";
import { Alert } from "react-bootstrap";

interface Props {
  deleteIndividual: (id: string) => void;
  setIndividual: (individual: Individual) => void;
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedIndividual: Individual | undefined;
  setSelectedIndividual: Dispatch<SetStateAction<Individual | undefined>>;
  dataset: Model;
  updateDataset: Dispatch<Dispatch<Model>>;
}

const SetIndividual = (props: Props) => {
  const {
    deleteIndividual,
    setIndividual,
    show,
    setShow,
    selectedIndividual,
    setSelectedIndividual,
    dataset,
    updateDataset,
  } = props;

  let defaultIndividual: Individual = {
    id: "",
    name: "",
    type: dataset.defaultIndividualType,
    description: "",
    beginning: -1,
    ending: Model.END_OF_TIME,
    beginsWithParticipant: false,
    endsWithParticipant: false,
    entityType: EntityType.Individual,
    parentSystemId: undefined,
    installations: [],
  };

  const [errors, setErrors] = useState<string[]>([]);
  const [inputs, setInputs] = useState<Individual>(
    selectedIndividual ? selectedIndividual : defaultIndividual
  );
  const [dirty, setDirty] = useState(false);
  const [beginsWithParticipant, setBeginsWithParticipant] = useState(false);
  const [endsWithParticipant, setEndsWithParticipant] = useState(false);
  const [individualHasParticipants, setIndividualHasParticipants] =
    useState(false);

  // State for custom type selector
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState("");
  const typeDropdownRef = useRef<HTMLDivElement | null>(null);

  // Check if we're editing (has selected individual) vs adding new
  const isEditing = !!selectedIndividual;

  useEffect(() => {
    if (selectedIndividual) {
      setIndividualHasParticipants(
        dataset.hasParticipants(selectedIndividual.id)
      );
    }

    // Only apply beginsWithParticipant/endsWithParticipant logic for regular Individuals
    const entityType = selectedIndividual?.entityType ?? EntityType.Individual;

    if (entityType === EntityType.Individual) {
      if (selectedIndividual && selectedIndividual.beginning > -1) {
        setBeginsWithParticipant(true);
      } else {
        setBeginsWithParticipant(false);
      }

      if (selectedIndividual && selectedIndividual.ending < Model.END_OF_TIME) {
        setEndsWithParticipant(true);
      } else {
        setEndsWithParticipant(false);
      }
    } else {
      // For non-Individual types, ALWAYS set these to false
      setBeginsWithParticipant(false);
      setEndsWithParticipant(false);
    }
  }, [selectedIndividual, dataset]);

  // Click outside to close type dropdown
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

  // Ensure defaults so new items behave
  useEffect(() => {
    if (!inputs.entityType) updateInputs("entityType", EntityType.Individual);
    if (inputs.beginning === undefined) updateInputs("beginning", -1);
    if (inputs.ending === undefined) updateInputs("ending", Model.END_OF_TIME);
    if (!inputs.installations) updateInputs("installations", []);
  }, [show]);

  // Only Systems can be parents for SystemComponents (not InstalledComponents)
  const availableParents = useMemo(
    () =>
      Array.from(dataset.individuals.values()).filter(
        (i) =>
          // Must be a System only
          (i.entityType ?? EntityType.Individual) === EntityType.System &&
          // Cannot be the same as the item being edited
          i.id !== inputs.id
      ),
    [dataset, inputs.id]
  );

  // Helper to get parent's time bounds for display
  const getParentBounds = (
    parentSystemId?: string
  ): { beginning: number; ending: number } | null => {
    if (!parentSystemId) return null;
    const parent = dataset.individuals.get(parentSystemId);
    if (!parent) return null;
    return {
      beginning: parent.beginning >= 0 ? parent.beginning : 0,
      ending:
        parent.ending < Model.END_OF_TIME ? parent.ending : Model.END_OF_TIME,
    };
  };

  // Helper to check if slot's time bounds fit within a parent's bounds
  const slotFitsInParent = (
    slotBeginning: number,
    slotEnding: number,
    parentSystemId?: string
  ): { fits: boolean; message?: string } => {
    if (!parentSystemId) return { fits: true };

    const parentBounds = getParentBounds(parentSystemId);
    if (!parentBounds) return { fits: true };

    const effectiveSlotBeginning = slotBeginning >= 0 ? slotBeginning : 0;
    const effectiveSlotEnding =
      slotEnding < Model.END_OF_TIME ? slotEnding : Model.END_OF_TIME;

    if (
      parentBounds.beginning > 0 &&
      effectiveSlotBeginning < parentBounds.beginning
    ) {
      return {
        fits: false,
        message: `Slot begins at ${effectiveSlotBeginning} but parent starts at ${parentBounds.beginning}`,
      };
    }

    if (
      parentBounds.ending < Model.END_OF_TIME &&
      effectiveSlotEnding > parentBounds.ending
    ) {
      return {
        fits: false,
        message: `Slot ends at ${effectiveSlotEnding} but parent ends at ${parentBounds.ending}`,
      };
    }

    return { fits: true };
  };

  // Check which parents are compatible with current slot bounds
  const getParentCompatibility = (
    parentId: string
  ): { compatible: boolean; reason?: string } => {
    if (!isEditing || inputs.entityType !== EntityType.SystemComponent) {
      return { compatible: true };
    }

    const slotBeginning = selectedIndividual!.beginning;
    const slotEnding = selectedIndividual!.ending;

    const fitCheck = slotFitsInParent(slotBeginning, slotEnding, parentId);

    return {
      compatible: fitCheck.fits,
      reason: fitCheck.message,
    };
  };

  const handleClose = () => {
    setShow(false);
    setInputs(defaultIndividual);
    setSelectedIndividual(undefined);
    setErrors([]);
    setDirty(false);
    setTypeOpen(false);
    setTypeSearch("");
    setEditingTypeId(null);
    setEditingTypeValue("");
  };

  const handleShow = () => {
    if (selectedIndividual) {
      setInputs({ ...selectedIndividual });
    } else {
      const newDefault = { ...defaultIndividual, id: uuidv4() };
      setInputs(newDefault);
    }
  };

  const handleAdd = () => {
    if (!validateInputs()) return;

    const id = inputs.id || uuidv4();
    const entityType = inputs.entityType ?? EntityType.Individual;

    // Determine beginning/ending
    let finalBeginning: number;
    let finalEnding: number;

    if (entityType === EntityType.Individual) {
      // For regular Individuals, use participant-based timing if enabled
      if (beginsWithParticipant && selectedIndividual) {
        const earliest = dataset.earliestParticipantBeginning(
          selectedIndividual.id
        );
        finalBeginning = earliest ?? 0;
      } else {
        finalBeginning = inputs.beginning ?? -1;
      }

      if (endsWithParticipant && selectedIndividual) {
        const latest = dataset.lastParticipantEnding(selectedIndividual.id);
        finalEnding = latest ?? Model.END_OF_TIME;
      } else {
        finalEnding = inputs.ending ?? Model.END_OF_TIME;
      }
    } else if (entityType === EntityType.SystemComponent) {
      // For SystemComponents:
      // - When ADDING: use the inputs
      // - When EDITING: preserve the original values (they're not editable)
      if (isEditing) {
        finalBeginning = selectedIndividual!.beginning;
        finalEnding = selectedIndividual!.ending;
      } else {
        finalBeginning = inputs.beginning ?? -1;
        finalEnding = inputs.ending ?? Model.END_OF_TIME;
      }
    } else {
      // For System and InstalledComponent, span full timeline
      finalBeginning = -1;
      finalEnding = Model.END_OF_TIME;
    }

    const newInd: Individual = {
      id: id,
      name: inputs.name || "Unnamed",
      description: inputs.description || "",
      type: inputs.type,
      beginning: finalBeginning,
      ending: finalEnding,
      beginsWithParticipant:
        entityType === EntityType.Individual ? beginsWithParticipant : false,
      endsWithParticipant:
        entityType === EntityType.Individual ? endsWithParticipant : false,
      entityType: entityType,
      parentSystemId: inputs.parentSystemId,
      installations: inputs.installations ?? [],
    };

    setIndividual(newInd);
    handleClose();
  };

  const handleDelete = () => {
    deleteIndividual(inputs.id);
    handleClose();
  };

  const updateInputs = (key: string, value: any) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleChange = (e: any) => {
    updateInputs(e.target.name, e.target.value);
  };

  const handleBeginsWithParticipant = (e: any) => {
    if (
      inputs.entityType !== EntityType.Individual &&
      inputs.entityType !== undefined
    ) {
      return;
    }

    const checked = e.target.checked;
    const earliestBeginning = selectedIndividual
      ? dataset.earliestParticipantBeginning(selectedIndividual.id)
      : 0;
    setBeginsWithParticipant(checked);
    if (checked) {
      updateInputs("beginning", earliestBeginning ? earliestBeginning : 0);
    } else {
      updateInputs("beginning", -1);
    }
  };

  const handleEndsWithParticipant = (e: any) => {
    if (
      inputs.entityType !== EntityType.Individual &&
      inputs.entityType !== undefined
    ) {
      return;
    }

    const checked = e.target.checked;
    const lastEnding = selectedIndividual
      ? dataset.lastParticipantEnding(selectedIndividual.id)
      : Number.MAX_VALUE;
    setEndsWithParticipant(checked);
    updateInputs("ending", checked ? lastEnding : Number.MAX_VALUE);
  };

  const validateInputs = () => {
    let runningErrors: string[] = [];
    if (!inputs.name) {
      runningErrors.push("Name field is required");
    }
    if (!inputs.type) {
      runningErrors.push("Type field is required");
    }

    // Validate SystemComponent
    if (inputs.entityType === EntityType.SystemComponent) {
      // When ADDING: validate slot bounds fit within parent
      if (!isEditing && inputs.parentSystemId) {
        const parentBounds = getParentBounds(inputs.parentSystemId);
        if (parentBounds) {
          const slotBeginning = inputs.beginning >= 0 ? inputs.beginning : 0;
          const slotEnding =
            inputs.ending < Model.END_OF_TIME
              ? inputs.ending
              : Model.END_OF_TIME;

          if (
            parentBounds.beginning > 0 &&
            slotBeginning < parentBounds.beginning
          ) {
            runningErrors.push(
              `Beginning (${slotBeginning}) cannot be before parent's beginning (${parentBounds.beginning})`
            );
          }
          if (
            parentBounds.ending < Model.END_OF_TIME &&
            slotEnding > parentBounds.ending
          ) {
            runningErrors.push(
              `Ending (${slotEnding}) cannot be after parent's ending (${parentBounds.ending})`
            );
          }
        }
      }

      // When EDITING: validate existing slot bounds fit within NEW parent
      if (isEditing && inputs.parentSystemId) {
        const slotBeginning = selectedIndividual!.beginning;
        const slotEnding = selectedIndividual!.ending;

        const fitCheck = slotFitsInParent(
          slotBeginning,
          slotEnding,
          inputs.parentSystemId
        );
        if (!fitCheck.fits && fitCheck.message) {
          runningErrors.push(fitCheck.message);
        }
      }
    }

    if (runningErrors.length === 0) {
      return true;
    } else {
      setErrors(runningErrors);
      return false;
    }
  };

  // Helper functions for custom type selector
  const filteredTypes = dataset.individualTypes.filter((t) =>
    t.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const showCreateTypeOption =
    typeSearch.trim().length > 0 &&
    !dataset.individualTypes.some(
      (t) => t.name.toLowerCase() === typeSearch.trim().toLowerCase()
    );

  const handleSelectType = (typeId: string) => {
    const t = dataset.individualTypes.find((x) => x.id === typeId);
    if (t) {
      updateInputs("type", t);
    }
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
      d.addIndividualType(newId, name);
      return d;
    });

    const createdType = { id: newId, name, isCoreHqdm: false };
    updateInputs("type", createdType);

    setTypeOpen(false);
    setTypeSearch("");
  };

  const startEditType = (typeId: string, currentName: string, e: any) => {
    e.stopPropagation();
    const found = dataset.individualTypes.find((x) => x.id === typeId);
    if (found && found.isCoreHqdm) return;
    setEditingTypeId(typeId);
    setEditingTypeValue(currentName);
  };

  const saveEditType = () => {
    if (!editingTypeId) return;
    const newName = editingTypeValue.trim();
    if (!newName) return;

    updateDataset((d) => {
      const kind = d.individualTypes.find((x) => x.id === editingTypeId);
      if (kind) kind.name = newName;

      d.individuals.forEach((ind) => {
        if (ind.type && ind.type.id === editingTypeId) {
          const canonical = d.individualTypes.find(
            (x) => x.id === editingTypeId
          );
          if (canonical) ind.type = canonical;
        }
      });

      if (
        d.defaultIndividualType &&
        d.defaultIndividualType.id === editingTypeId
      ) {
        const canonical = d.individualTypes.find((x) => x.id === editingTypeId);
        if (canonical) d.defaultIndividualType = canonical;
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

  // Format time for display
  const formatTime = (value: number): string => {
    if (value < 0) return "Start of timeline";
    if (value >= Model.END_OF_TIME) return "End of timeline";
    return String(value);
  };

  // Get current slot bounds for display when editing SystemComponent
  const currentSlotBounds =
    isEditing && inputs.entityType === EntityType.SystemComponent
      ? {
          beginning: selectedIndividual!.beginning,
          ending: selectedIndividual!.ending,
        }
      : null;

  return (
    <>
      <Button variant="primary" onClick={() => setShow(true)} className="mx-1">
        Add Entity
      </Button>

      <Modal show={show} onHide={handleClose} onShow={handleShow}>
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedIndividual ? "Edit Entity" : "Add Entity"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
          >
            {/* Name */}
            <Form.Group className="mb-3" controlId="formIndividualName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={inputs?.name}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>

            {/* Type dropdown with create/edit */}
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
                    className="card mt-1 position-absolute w-100"
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

            {/* Entity type selection */}
            <Form.Group className="mb-3" controlId="ind-entity-type">
              <Form.Label>Entity type</Form.Label>
              <Form.Select
                value={inputs.entityType ?? EntityType.Individual}
                onChange={(e) =>
                  updateInputs("entityType", e.target.value as EntityType)
                }
                disabled={isEditing} // Can't change entity type when editing
              >
                <option value={EntityType.Individual}>Individual</option>
                <option value={EntityType.System}>System</option>
                <option value={EntityType.SystemComponent}>
                  System Component (slot/position)
                </option>
                <option value={EntityType.InstalledComponent}>
                  Installed Component (physical object)
                </option>
              </Form.Select>
              {isEditing && (
                <Form.Text className="text-muted">
                  Entity type cannot be changed after creation.
                </Form.Text>
              )}
            </Form.Group>

            {/* Parent – for SystemComponents only - CAN be changed when editing */}
            {(inputs.entityType ?? EntityType.Individual) ===
              EntityType.SystemComponent && (
              <Form.Group className="mb-3" controlId="ind-parent-system">
                <Form.Label>Parent System</Form.Label>
                <Form.Select
                  value={inputs.parentSystemId ?? ""}
                  onChange={(e) =>
                    updateInputs("parentSystemId", e.target.value || undefined)
                  }
                >
                  <option value="">Select parent system</option>
                  {availableParents.map((p) => {
                    // Check compatibility when editing
                    const compat = getParentCompatibility(p.id);

                    // Show parent's time bounds if they have explicit bounds
                    const parentBounds = getParentBounds(p.id);
                    let boundsStr = "";
                    if (parentBounds) {
                      if (
                        parentBounds.beginning > 0 ||
                        parentBounds.ending < Model.END_OF_TIME
                      ) {
                        const endStr =
                          parentBounds.ending < Model.END_OF_TIME
                            ? parentBounds.ending
                            : "∞";
                        boundsStr = ` (${parentBounds.beginning}-${endStr})`;
                      }
                    }

                    return (
                      <option
                        key={p.id}
                        value={p.id}
                        disabled={!compat.compatible}
                      >
                        {p.name}
                        {boundsStr}
                        {!compat.compatible ? " ⚠️" : ""}
                      </option>
                    );
                  })}
                </Form.Select>
              </Form.Group>
            )}

            {/* Description */}
            <Form.Group className="mb-3" controlId="formIndividualDescription">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                name="description"
                value={inputs?.description}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>

            {/* Begins/Ends with participant - for Individual type only */}
            {(inputs.entityType === EntityType.Individual ||
              !inputs.entityType) && (
              <>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    name="beginsWithParticipant"
                    label="Begins With Participant"
                    disabled={!individualHasParticipants}
                    checked={beginsWithParticipant}
                    onChange={handleBeginsWithParticipant}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    name="endsWithParticipant"
                    label="Ends With Participant"
                    disabled={!individualHasParticipants}
                    checked={endsWithParticipant}
                    onChange={handleEndsWithParticipant}
                  />
                </Form.Group>
              </>
            )}

            {/* SystemComponent time bounds - only when ADDING */}
            {inputs.entityType === EntityType.SystemComponent && !isEditing && (
              <>
                <Alert variant="info" className="py-2">
                  <small>
                    Set the time period when this slot/position exists.
                    Installed components can only be installed within this
                    period.
                    <strong>
                      {" "}
                      These values cannot be changed after creation.
                    </strong>
                  </small>
                </Alert>

                {inputs.parentSystemId &&
                  getParentBounds(inputs.parentSystemId) && (
                    <Form.Text className="text-muted d-block mb-2">
                      Parent bounds:{" "}
                      {formatTime(
                        getParentBounds(inputs.parentSystemId)!.beginning
                      )}{" "}
                      -{" "}
                      {formatTime(
                        getParentBounds(inputs.parentSystemId)!.ending
                      )}
                    </Form.Text>
                  )}

                <Form.Group className="mb-3" controlId="formBeginning">
                  <Form.Label>Beginning</Form.Label>
                  <Form.Control
                    type="number"
                    name="beginning"
                    value={inputs.beginning >= 0 ? inputs.beginning : ""}
                    onChange={(e) => {
                      const val =
                        e.target.value === "" ? -1 : Number(e.target.value);
                      setInputs({ ...inputs, beginning: val });
                      setDirty(true);
                    }}
                    placeholder="Leave empty to inherit from parent"
                    min="0"
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="formEnding">
                  <Form.Label>Ending</Form.Label>
                  <Form.Control
                    type="number"
                    name="ending"
                    value={
                      inputs.ending < Model.END_OF_TIME ? inputs.ending : ""
                    }
                    onChange={(e) => {
                      const val =
                        e.target.value === ""
                          ? Model.END_OF_TIME
                          : Number(e.target.value);
                      setInputs({ ...inputs, ending: val });
                      setDirty(true);
                    }}
                    placeholder="Leave empty to inherit from parent"
                    min="1"
                  />
                </Form.Group>
              </>
            )}

            {/* Note for InstalledComponents */}
            {(inputs.entityType ?? EntityType.Individual) ===
              EntityType.InstalledComponent &&
              selectedIndividual && (
                <div className="alert alert-info">
                  To manage installation periods, save this and then click on
                  the component in the diagram to open the Installation Editor.
                </div>
              )}
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <div className="w-100 d-flex justify-content-between align-items-center">
            <div>
              <Button
                variant="danger"
                onClick={handleDelete}
                className={
                  selectedIndividual ? "d-inline-block me-2" : "d-none"
                }
              >
                Delete
              </Button>
            </div>
            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAdd}>
                {selectedIndividual ? "Save" : "Add"}
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
    </>
  );
};

export default SetIndividual;
