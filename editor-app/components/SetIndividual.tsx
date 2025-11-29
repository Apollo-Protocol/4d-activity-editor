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
  // NEW: Callbacks to open installation modals
  onOpenSystemComponentInstallation?: (individual: Individual) => void;
  onOpenInstalledComponentInstallation?: (individual: Individual) => void;
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
    onOpenSystemComponentInstallation,
    onOpenInstalledComponentInstallation,
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

  // Get the current entity type
  const currentEntityType = inputs.entityType ?? EntityType.Individual;

  // Check if this entity has installations
  const hasInstallations =
    inputs.installations && inputs.installations.length > 0;

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
    } else {
      // For System, SystemComponent, and InstalledComponent, span full timeline
      // Their actual temporal bounds come from installations
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

    if (runningErrors.length === 0) {
      return true;
    } else {
      setErrors(runningErrors);
      return false;
    }
  };

  // Handler for opening installations modal
  const handleManageInstallations = () => {
    // First save the current entity if dirty
    if (dirty) {
      handleAdd();
    } else {
      handleClose();
    }

    // Then open the appropriate installations modal
    if (currentEntityType === EntityType.SystemComponent) {
      onOpenSystemComponentInstallation?.(inputs);
    } else if (currentEntityType === EntityType.InstalledComponent) {
      onOpenInstalledComponentInstallation?.(inputs);
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

  // Get installation count for display
  const installationCount = inputs.installations?.length ?? 0;

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

            {/* Installations section for SystemComponents */}
            {currentEntityType === EntityType.SystemComponent && isEditing && (
              <div className="mb-3 p-3 border rounded bg-light">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>Installations</strong>
                    <p className="text-muted mb-0 small">
                      {installationCount === 0
                        ? "Not installed in any system yet."
                        : `Installed in ${installationCount} system${
                            installationCount !== 1 ? "s" : ""
                          }.`}
                    </p>
                  </div>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={handleManageInstallations}
                    disabled={!onOpenSystemComponentInstallation}
                  >
                    {installationCount === 0
                      ? "Add Installation"
                      : "Manage Installations"}
                  </Button>
                </div>
              </div>
            )}

            {/* Installations section for InstalledComponents */}
            {currentEntityType === EntityType.InstalledComponent &&
              isEditing && (
                <div className="mb-3 p-3 border rounded bg-light">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>Installations</strong>
                      <p className="text-muted mb-0 small">
                        {installationCount === 0
                          ? "Not installed in any slot yet."
                          : `Installed in ${installationCount} slot${
                              installationCount !== 1 ? "s" : ""
                            }.`}
                      </p>
                    </div>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={handleManageInstallations}
                      disabled={!onOpenInstalledComponentInstallation}
                    >
                      {installationCount === 0
                        ? "Add Installation"
                        : "Manage Installations"}
                    </Button>
                  </div>
                </div>
              )}

            {/* Note for new SystemComponents */}
            {currentEntityType === EntityType.SystemComponent && !isEditing && (
              <Alert variant="info" className="py-2">
                <small>
                  After saving, you can add installations to specify when this
                  component is installed in a system.
                </small>
              </Alert>
            )}

            {/* Note for new InstalledComponents */}
            {currentEntityType === EntityType.InstalledComponent &&
              !isEditing && (
                <Alert variant="info" className="py-2">
                  <small>
                    After saving, you can add installations to specify when this
                    component is installed in a slot. Note: System Components
                    must be installed in a System first before they can receive
                    Installed Components.
                  </small>
                </Alert>
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
