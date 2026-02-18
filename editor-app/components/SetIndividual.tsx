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
import Form from "react-bootstrap/Form";
import { Individual } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import { v4 as uuidv4 } from "uuid";
import { Alert } from "react-bootstrap";
import {
  ENTITY_CATEGORY,
  ENTITY_TYPE_IDS,
  ENTITY_TYPE_OPTIONS,
  getEntityCategoryFromTypeId,
  getEntityTypeId,
  getEntityTypeIdFromIndividual,
} from "@/lib/entityTypes";

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

  const defaultIndividual: Individual = {
    id: "",
    name: "",
    type: dataset.defaultIndividualType,
    description: "",
    beginning: -1,
    ending: Model.END_OF_TIME,
    beginsWithParticipant: false,
    endsWithParticipant: false,
    installedIn: undefined,
    entityType: ENTITY_CATEGORY.INDIVIDUAL,
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

  const [typeOpen, setTypeOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState("");
  const typeDropdownRef = useRef<HTMLDivElement | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const isEditMode = !!selectedIndividual;

  const selectedEntityTypeId = getEntityTypeIdFromIndividual(inputs);

  const systems = useMemo(
    () =>
      Array.from(dataset.individuals.values()).filter(
        (individual) =>
          individual.id !== inputs.id &&
          getEntityTypeIdFromIndividual(individual) === ENTITY_TYPE_IDS.SYSTEM
      ),
    [dataset.individuals, inputs.id]
  );

  const systemComponents = useMemo(
    () =>
      Array.from(dataset.individuals.values()).filter(
        (individual) =>
          individual.id !== inputs.id &&
          getEntityTypeIdFromIndividual(individual) ===
            ENTITY_TYPE_IDS.SYSTEM_COMPONENT
      ),
    [dataset.individuals, inputs.id]
  );

  useEffect(() => {
    if (selectedIndividual) {
      setIndividualHasParticipants(dataset.hasParticipants(selectedIndividual.id));
    }

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
  }, [selectedIndividual, dataset]);

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

  useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      const el = itemRefs.current[highlightedIndex];
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

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

  const handleModalHide = () => {
    if (editingTypeId) {
      return;
    }
    handleClose();
  };

  const handleShow = () => {
    if (selectedIndividual) {
      const selectedCategory =
        selectedIndividual.entityType ??
        getEntityCategoryFromTypeId(getEntityTypeIdFromIndividual(selectedIndividual));
      setInputs({ ...selectedIndividual, entityType: selectedCategory });
    } else {
      setInputs({ ...defaultIndividual, id: uuidv4() });
    }
  };

  const updateInputs = (key: keyof Individual, value: any) => {
    setInputs({ ...inputs, [key]: value });
    setDirty(true);
  };

  const handleChange = (e: any) => {
    updateInputs(e.target.name, e.target.value);
  };

  const handleChangeNumeric = (e: any) => {
    updateInputs(e.target.name, e.target.valueAsNumber);
  };

  const handleSelectEntityType = (typeId: string) => {
    if (isEditMode) return;

    setInputs((prev) => {
      const entityType = getEntityCategoryFromTypeId(typeId);
      const next: Individual = {
        ...prev,
        entityType,
      };

      if (entityType !== ENTITY_CATEGORY.SYSTEM_COMPONENT) {
        next.installedIn = undefined;
      }

      return next;
    });
    setDirty(true);
  };

  const handleBeginsWithParticipant = (e: any) => {
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
    const checked = e.target.checked;
    const lastEnding = selectedIndividual
      ? dataset.lastParticipantEnding(selectedIndividual.id)
      : Number.MAX_VALUE;
    setEndsWithParticipant(checked);
    updateInputs("ending", checked ? lastEnding : Number.MAX_VALUE);
  };

  const filteredTypes = dataset.individualTypes.filter((type) =>
    type.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  useEffect(() => {
    if (!typeOpen || filteredTypes.length === 0) {
      setHighlightedIndex(-1);
      return;
    }
    const selectedIndex = filteredTypes.findIndex(
      (type) => type.id === inputs?.type?.id
    );
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [typeOpen, typeSearch, inputs?.type?.id, filteredTypes.length]);

  const showCreateTypeOption =
    typeSearch.trim().length > 0 &&
    !dataset.individualTypes.some(
      (type) => type.name.toLowerCase() === typeSearch.trim().toLowerCase()
    );

  const handleSelectType = (typeId: string) => {
    const selectedType = dataset.individualTypes.find((type) => type.id === typeId);
    if (selectedType) {
      updateInputs("type", selectedType);
    }
    setTypeOpen(false);
    setTypeSearch("");
    setEditingTypeId(null);
    setEditingTypeValue("");
  };

  const moveHighlight = (delta: number) => {
    if (filteredTypes.length === 0) return;
    setHighlightedIndex((prev) => {
      let next = prev + delta;
      if (next < 0) next = filteredTypes.length - 1;
      if (next >= filteredTypes.length) next = 0;
      return next;
    });
  };

  const selectHighlighted = () => {
    if (highlightedIndex >= 0 && highlightedIndex < filteredTypes.length) {
      handleSelectType(filteredTypes[highlightedIndex].id);
    }
  };

  const handleCreateTypeFromSearch = () => {
    const name = typeSearch.trim();
    if (!name) return;
    const newId = uuidv4();

    updateDataset((d) => {
      d.addIndividualType(newId, name);
      return d;
    });

    updateInputs("type", { id: newId, name, isCoreHqdm: false });

    setTypeOpen(false);
    setTypeSearch("");
  };

  const startEditType = (typeId: string, currentName: string, e: any) => {
    e.stopPropagation();
    const found = dataset.individualTypes.find((type) => type.id === typeId);
    if (found && found.isCoreHqdm) return;
    setEditingTypeId(typeId);
    setEditingTypeValue(currentName);
  };

  const saveEditType = () => {
    if (!editingTypeId) return;
    const newName = editingTypeValue.trim();
    if (!newName) return;

    updateDataset((d) => {
      const kind = d.individualTypes.find((type) => type.id === editingTypeId);
      if (kind) kind.name = newName;

      d.individuals.forEach((individual) => {
        if (individual.type && individual.type.id === editingTypeId) {
          const canonical = d.individualTypes.find(
            (type) => type.id === editingTypeId
          );
          if (canonical) individual.type = canonical;
        }
      });

      if (
        d.defaultIndividualType &&
        d.defaultIndividualType.id === editingTypeId
      ) {
        const canonical = d.individualTypes.find(
          (type) => type.id === editingTypeId
        );
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

  const validateInputs = () => {
    const runningErrors: string[] = [];

    if (!inputs.name) {
      runningErrors.push("Name field is required");
    }

    if (!inputs.type) {
      runningErrors.push("Type field is required");
    }

    if (
      selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
      !inputs.installedIn
    ) {
      runningErrors.push("System Component must be installed to a System");
    }

    if (
      selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL &&
      inputs.installedIn
    ) {
      const installedInEntity = dataset.individuals.get(inputs.installedIn);
      const installedInType = installedInEntity
        ? getEntityTypeIdFromIndividual(installedInEntity)
        : undefined;

      if (installedInType !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        runningErrors.push(
          "Individual can only be installed into a System Component"
        );
      }

      if (!Number.isFinite(inputs.beginning) || inputs.beginning < 0) {
        runningErrors.push("Beginning must be 0 or greater");
      }

      if (!Number.isFinite(inputs.ending) || inputs.ending <= inputs.beginning) {
        runningErrors.push("Ending must be after Beginning");
      }

      if (inputs.ending >= Model.END_OF_TIME) {
        runningErrors.push(`Ending must be less than ${Model.END_OF_TIME}`);
      }
    }

    if (runningErrors.length === 0) {
      return true;
    }

    setErrors(runningErrors);
    return false;
  };

  const handleAdd = (event: any) => {
    event.preventDefault();
    if (!dirty) return handleClose();

    const isValid = validateInputs();
    if (isValid) {
      setIndividual(inputs);
      handleClose();
    }
  };

  const handleDelete = () => {
    deleteIndividual(inputs.id);
    handleClose();
  };

  return (
    <>
      <Button variant="primary" onClick={() => setShow(true)} className="mx-1">
        Add Entity
      </Button>

      <Modal show={show} onHide={handleModalHide} onShow={handleShow}>
        <Modal.Header closeButton>
          <Modal.Title>{selectedIndividual ? "Edit Entity" : "Add Entity"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAdd}>
            <Form.Group className="mb-3" controlId="formEntityType">
              <Form.Label>Entity Type</Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {ENTITY_TYPE_OPTIONS.map((option) => {
                  const selected = selectedEntityTypeId === option.id;
                  const disabled = isEditMode && !selected;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={selected ? "primary" : "outline-secondary"}
                      disabled={disabled}
                      onClick={() => handleSelectEntityType(option.id)}
                    >
                      {option.glyph} {option.label}
                    </Button>
                  );
                })}
              </div>
            </Form.Group>

            <Form.Group className="mb-3" controlId="formEntityName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={inputs?.name}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formEntityTypeName">
              <Form.Label>Type</Form.Label>
              <div
                ref={typeDropdownRef}
                className="position-relative"
                style={{ zIndex: 1050 }}
              >
                <button
                  type="button"
                  className="w-100 btn btn-outline-secondary d-flex justify-content-between align-items-center"
                  onClick={() => setTypeOpen((current) => !current)}
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
                            return;
                          }

                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            moveHighlight(1);
                            return;
                          }

                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            moveHighlight(-1);
                            return;
                          }

                          if (e.key === "Escape") {
                            setTypeOpen(false);
                            return;
                          }

                          if (
                            e.key === "Enter" &&
                            filteredTypes.length > 0 &&
                            !showCreateTypeOption
                          ) {
                            e.preventDefault();
                            selectHighlighted();
                            return;
                          }
                        }}
                        autoFocus
                      />
                    </div>

                    <div style={{ maxHeight: 180, overflow: "auto" }}>
                      {filteredTypes.map((type, idx) => (
                        <div
                          key={type.id}
                          ref={(el) => {
                            itemRefs.current[idx] = el;
                          }}
                          tabIndex={-1}
                          className={`d-flex align-items-center justify-content-between px-3 py-2 ${
                            highlightedIndex === idx ? "bg-primary text-white" : ""
                          }`}
                          style={{ cursor: "pointer" }}
                          onClick={() => handleSelectType(type.id)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") selectHighlighted();
                            if (e.key === "Escape") setTypeOpen(false);
                          }}
                        >
                          {editingTypeId === type.id ? (
                            <div className="d-flex align-items-center w-100">
                              <input
                                className="form-control form-control-sm me-2"
                                value={editingTypeValue}
                                onChange={(e) =>
                                  setEditingTypeValue(e.target.value)
                                }
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
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
                              <div className="flex-grow-1">{type.name}</div>
                              <div className="d-flex align-items-center">
                                {inputs?.type?.id === type.id && (
                                  <span className="me-2">✓</span>
                                )}
                                {!type.isCoreHqdm && (
                                  <button
                                    type="button"
                                    className={`btn btn-sm btn-link p-0 ${
                                      highlightedIndex === idx ? "text-white" : ""
                                    }`}
                                    onClick={(e) =>
                                      startEditType(type.id, type.name, e)
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
                          Create &quot;{typeSearch}&quot;
                        </div>
                      )}

                      {filteredTypes.length === 0 && !showCreateTypeOption && (
                        <div className="p-3 text-muted small">No results found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Form.Group>

            {selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM_COMPONENT && (
              <Form.Group className="mb-3" controlId="formEntityInstalledIn">
                <Form.Label>Install To System</Form.Label>
                <Form.Select
                  name="installedIn"
                  value={inputs?.installedIn || ""}
                  onChange={(e) =>
                    updateInputs("installedIn", e.target.value || undefined)
                  }
                >
                  <option value="">Select system...</option>
                  {systems.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.name}
                    </option>
                  ))}
                </Form.Select>
                {systems.length === 0 && (
                  <Form.Text className="text-danger">
                    Create a System entity before adding a System Component.
                  </Form.Text>
                )}
              </Form.Group>
            )}

            {selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL && (
              <>
                <Form.Group
                  className="mb-3"
                  controlId="formEntityInstalledInSystemComponent"
                >
                  <Form.Label>Install Into System Component (Optional)</Form.Label>
                  <Form.Select
                    name="installedIn"
                    value={inputs?.installedIn || ""}
                    onChange={(e) => {
                      const selectedValue = e.target.value || undefined;

                      if (!selectedValue) {
                        setBeginsWithParticipant(false);
                        setEndsWithParticipant(false);
                        setInputs((prev) => ({
                          ...prev,
                          installedIn: undefined,
                          beginning: -1,
                          ending: Model.END_OF_TIME,
                        }));
                        setDirty(true);
                        return;
                      }

                      const nextBeginning =
                        inputs.beginning >= 0 && Number.isFinite(inputs.beginning)
                          ? inputs.beginning
                          : 0;
                      const nextEnding =
                        inputs.ending > nextBeginning &&
                        inputs.ending < Model.END_OF_TIME
                          ? inputs.ending
                          : nextBeginning + 1;

                      setInputs((prev) => ({
                        ...prev,
                        installedIn: selectedValue,
                        beginning: nextBeginning,
                        ending: nextEnding,
                      }));
                      setDirty(true);
                    }}
                  >
                    <option value="">None</option>
                    {systemComponents.map((component) => (
                      <option key={component.id} value={component.id}>
                        {component.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {!!inputs.installedIn && (
                  <>
                    <Form.Group className="mb-3" controlId="formEntityBeginning">
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

                    <Form.Group className="mb-3" controlId="formEntityEnding">
                      <Form.Label>Ending</Form.Label>
                      <Form.Control
                        type="number"
                        name="ending"
                        value={inputs.ending}
                        onChange={handleChangeNumeric}
                        step="1"
                        min="1"
                        max={Model.END_OF_TIME - 1}
                        className="form-control"
                      />
                    </Form.Group>
                  </>
                )}
              </>
            )}

            <Form.Group className="mb-3" controlId="formEntityDescription">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                name="description"
                value={inputs?.description}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>

            {!(
              selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL &&
              !!inputs.installedIn
            ) && (
              <>
                <Form.Group
                  className="mb-3"
                  controlId="formEntityBeginsWithParticipant"
                >
                  <Form.Check
                    type="switch"
                    name="beginsWithParticipant"
                    label="Begins With Participant"
                    disabled={!individualHasParticipants}
                    checked={beginsWithParticipant}
                    onChange={handleBeginsWithParticipant}
                  />
                </Form.Group>

                <Form.Group
                  className="mb-3"
                  controlId="formEntityEndsWithParticipant"
                >
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
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <div className="w-100 d-flex justify-content-between align-items-center">
            <div>
              <Button
                variant="danger"
                onClick={handleDelete}
                className={selectedIndividual ? "d-inline-block me-2" : "d-none"}
              >
                Delete
              </Button>
            </div>
            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAdd} disabled={!dirty}>
                {selectedIndividual ? "Save" : "Add"}
              </Button>
            </div>
          </div>

          <div className="w-100 mt-2">
            {errors.length > 0 && (
              <Alert variant="danger" className="p-2 m-0">
                {errors.map((error, idx) => (
                  <p key={idx} className="mb-1">
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
