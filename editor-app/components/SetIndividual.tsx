import React, { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Table from "react-bootstrap/Table";
import Alert from "react-bootstrap/Alert";
import Card from "react-bootstrap/Card";
import { v4 as uuidv4 } from "uuid";
import { Individual, InstallationPeriod } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import {
  ENTITY_CATEGORY,
  ENTITY_TYPE_IDS,
  ENTITY_TYPE_OPTIONS,
  getEntityCategoryFromTypeId,
  getEntityTypeIdFromIndividual,
} from "@/lib/entityTypes";
import {
  getInstallationPeriods,
  normalizeEnd,
  normalizeStart,
  syncLegacyInstallationFields,
} from "@/utils/installations";

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

type InstallationRow = {
  id: string;
  systemComponentId: string;
  beginningText: string;
  endingText: string;
};

type NormalizedInstallationRow = {
  id: string;
  systemComponentId: string;
  beginning: number;
  ending: number;
  systemId?: string;
};

const EMPTY_BEGINNING = "";
const EMPTY_ENDING = "";

const SetIndividual = (props: Props) => {
  const {
    deleteIndividual,
    setIndividual,
    show,
    setShow,
    selectedIndividual,
    setSelectedIndividual,
    dataset,
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
    installedBeginning: undefined,
    installedEnding: undefined,
    installations: [],
    entityType: ENTITY_CATEGORY.INDIVIDUAL,
  };

  const [inputs, setInputs] = useState<Individual>(defaultIndividual);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [beginningText, setBeginningText] = useState(EMPTY_BEGINNING);
  const [endingText, setEndingText] = useState(EMPTY_ENDING);

  const [showInstallationsModal, setShowInstallationsModal] = useState(false);
  const [installationRows, setInstallationRows] = useState<InstallationRow[]>([]);
  const [installationErrors, setInstallationErrors] = useState<string[]>([]);
  const [showBoundsWarningModal, setShowBoundsWarningModal] = useState(false);
  const [pendingSaveIndividual, setPendingSaveIndividual] =
    useState<Individual | null>(null);
  const [pendingDeletionCount, setPendingDeletionCount] = useState(0);

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

  const selectedParentSystem = useMemo(
    () =>
      inputs.installedIn ? dataset.individuals.get(inputs.installedIn) : undefined,
    [dataset.individuals, inputs.installedIn]
  );

  const systemComponentSlotHints = useMemo(() => {
    if (!selectedParentSystem) return null;

    const systemStart = normalizeStart(selectedParentSystem.beginning);
    const systemEnd = normalizeEnd(selectedParentSystem.ending);

    return {
      bounds: `${systemStart}-${
        systemEnd >= Model.END_OF_TIME ? "∞" : String(systemEnd)
      }`,
    };
  }, [selectedParentSystem]);

  const asInputText = (value: number, isBeginning: boolean) => {
    if (isBeginning && value === -1) return "";
    if (!isBeginning && value >= Model.END_OF_TIME) return "";
    return String(value);
  };

  const parseBoundary = (text: string, isBeginning: boolean) => {
    if (text.trim() === "") {
      return isBeginning ? -1 : Model.END_OF_TIME;
    }
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) {
      return isBeginning ? -1 : Model.END_OF_TIME;
    }
    return Math.trunc(numeric);
  };

  const updateInputs = (key: keyof Individual, value: any) => {
    setInputs((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  };

  const handleClose = () => {
    setShow(false);
    setSelectedIndividual(undefined);
    setInputs(defaultIndividual);
    setDirty(false);
    setErrors([]);
    setBeginningText(EMPTY_BEGINNING);
    setEndingText(EMPTY_ENDING);
    setInstallationRows([]);
    setInstallationErrors([]);
    setShowInstallationsModal(false);
    setShowBoundsWarningModal(false);
    setPendingSaveIndividual(null);
    setPendingDeletionCount(0);
  };

  const commitIndividualSave = (next: Individual) => {
    setIndividual(next);
    handleClose();
  };

  const handleShow = () => {
    const base = selectedIndividual
      ? { ...selectedIndividual }
      : { ...defaultIndividual, id: uuidv4() };

    const category =
      base.entityType ??
      getEntityCategoryFromTypeId(getEntityTypeIdFromIndividual(base));

    const normalized = syncLegacyInstallationFields({
      ...base,
      entityType: category,
      installations: getInstallationPeriods(base),
    });

    setInputs(normalized);
    setBeginningText(asInputText(normalized.beginning, true));
    setEndingText(asInputText(normalized.ending, false));
    setDirty(false);
    setErrors([]);
  };

  useEffect(() => {
    if (!show) return;
    handleShow();
  }, [show]);

  const handleChangeText = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateInputs(e.target.name as keyof Individual, e.target.value);
  };

  const handleBeginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextText = e.target.value;
    setBeginningText(nextText);
    updateInputs("beginning", parseBoundary(nextText, true));
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextText = e.target.value;
    setEndingText(nextText);
    updateInputs("ending", parseBoundary(nextText, false));
  };

  const handleEntityType = (typeId: string) => {
    if (isEditMode) return;

    const category = getEntityCategoryFromTypeId(typeId);
    setInputs((previous) => {
      const next: Individual = {
        ...previous,
        entityType: category,
      };
      if (typeId !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        next.installedIn = undefined;
      }
      if (typeId !== ENTITY_TYPE_IDS.INDIVIDUAL) {
        next.installations = [];
        next.installedIn = undefined;
        next.installedBeginning = undefined;
        next.installedEnding = undefined;
      }
      return next;
    });
    setDirty(true);
  };

  const validateMainInputs = () => {
    const runningErrors: string[] = [];

    if (!inputs.name?.trim()) {
      runningErrors.push("Name field is required");
    }

    if (!inputs.type) {
      runningErrors.push("Type field is required");
    }

    if (
      Number.isFinite(inputs.beginning) &&
      Number.isFinite(inputs.ending) &&
      inputs.beginning >= 0 &&
      inputs.ending < Model.END_OF_TIME &&
      inputs.ending <= inputs.beginning
    ) {
      runningErrors.push("Ending must be after Beginning");
    }

    if (selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
      if (!inputs.installedIn) {
        runningErrors.push("System Component must be installed to a System");
      } else {
        const parentSystem = dataset.individuals.get(inputs.installedIn);
        if (
          !parentSystem ||
          getEntityTypeIdFromIndividual(parentSystem) !== ENTITY_TYPE_IDS.SYSTEM
        ) {
          runningErrors.push("System Component can only be installed into a System");
        } else {
          const parentStart = normalizeStart(parentSystem.beginning);
          const parentEnd = normalizeEnd(parentSystem.ending);
          const ownStart = normalizeStart(inputs.beginning);
          const ownEnd = normalizeEnd(inputs.ending);

          if (ownStart < parentStart) {
            runningErrors.push(
              `System Component beginning must be within ${parentSystem.name}`
            );
          }
          if (ownEnd > parentEnd) {
            runningErrors.push(
              `System Component ending must be within ${parentSystem.name}`
            );
          }
        }
      }
    }

    if (runningErrors.length > 0) {
      setErrors(runningErrors);
      return false;
    }

    setErrors([]);
    return true;
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty) {
      handleClose();
      return;
    }

    if (!validateMainInputs()) return;

    let next = { ...inputs };

    if (selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL) {
      let periods = getInstallationPeriods(next);
      const ownStart = normalizeStart(next.beginning);
      const ownEnd = normalizeEnd(next.ending);
      const outsideBounds = periods.filter(
        (period) => period.beginning < ownStart || period.ending > ownEnd
      );

      if (outsideBounds.length > 0) {
        periods = periods.filter(
          (period) => !outsideBounds.some((out) => out.id === period.id)
        );

        const pending = syncLegacyInstallationFields({
          ...next,
          installations: periods,
        });

        setPendingSaveIndividual(pending);
        setPendingDeletionCount(outsideBounds.length);
        setShowBoundsWarningModal(true);
        return;
      }

      next = syncLegacyInstallationFields({
        ...next,
        installations: periods,
      });
    } else {
      next = {
        ...next,
        installations: [],
        installedBeginning: undefined,
        installedEnding: undefined,
      };
      if (selectedEntityTypeId !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        next.installedIn = undefined;
      }
    }

    commitIndividualSave(next);
  };

  const confirmBoundsDeletion = () => {
    if (!pendingSaveIndividual) {
      setShowBoundsWarningModal(false);
      return;
    }
    commitIndividualSave(pendingSaveIndividual);
  };

  const handleDelete = () => {
    deleteIndividual(inputs.id);
    handleClose();
  };

  const openInstallationsModal = () => {
    const rows = getInstallationPeriods(inputs).map((period) => ({
      id: period.id,
      systemComponentId: period.systemComponentId,
      beginningText: String(period.beginning),
      endingText: period.ending >= Model.END_OF_TIME ? "" : String(period.ending),
    }));
    setInstallationRows(
      rows.length > 0
        ? rows
        : [
            {
              id: uuidv4(),
              systemComponentId: "",
              beginningText: "0",
              endingText: "",
            },
          ]
    );
    setInstallationErrors([]);
    setShowInstallationsModal(true);
  };

  const addInstallationRow = () => {
    setInstallationRows((previous) => [
      ...previous,
      {
        id: uuidv4(),
        systemComponentId: "",
        beginningText: "0",
        endingText: "",
      },
    ]);
  };

  const removeInstallationRow = (rowId: string) => {
    setInstallationRows((previous) => previous.filter((row) => row.id !== rowId));
  };

  const updateInstallationRow = (
    rowId: string,
    key: keyof InstallationRow,
    value: string
  ) => {
    setInstallationRows((previous) =>
      previous.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  };

  const componentSystemIdById = useMemo(() => {
    const map = new Map<string, string | undefined>();
    systemComponents.forEach((component) => {
      map.set(component.id, component.installedIn);
    });
    return map;
  }, [systemComponents]);

  const normalizeInstallationRows = (rows: InstallationRow[]) => {
    const rowErrors: string[] = [];
    const normalized: NormalizedInstallationRow[] = [];

    rows.forEach((row, index) => {
      const rowPrefix = `Row ${index + 1}`;

      if (!row.systemComponentId) {
        rowErrors.push(`${rowPrefix}: System Component is required`);
        return;
      }

      const component = dataset.individuals.get(row.systemComponentId);
      if (
        !component ||
        getEntityTypeIdFromIndividual(component) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT
      ) {
        rowErrors.push(`${rowPrefix}: Selected System Component is invalid`);
        return;
      }

      if (row.beginningText.trim() === "") {
        rowErrors.push(`${rowPrefix}: Beginning is required`);
        return;
      }

      const beginning = Math.trunc(Number(row.beginningText));
      const ending =
        row.endingText.trim() === ""
          ? Model.END_OF_TIME
          : Math.trunc(Number(row.endingText));

      if (!Number.isFinite(beginning) || beginning < 0) {
        rowErrors.push(`${rowPrefix}: Beginning must be 0 or greater`);
        return;
      }

      if (!Number.isFinite(ending) || ending <= beginning) {
        rowErrors.push(`${rowPrefix}: Ending must be after Beginning`);
        return;
      }

      const componentStart = normalizeStart(component.beginning);
      const componentEnd = normalizeEnd(component.ending);

      if (beginning < componentStart) {
        rowErrors.push(
          `${rowPrefix}: Beginning must be within ${component.name} bounds`
        );
      }
      if (ending > componentEnd) {
        rowErrors.push(`${rowPrefix}: Ending must be within ${component.name} bounds`);
      }

      const ownStart = normalizeStart(inputs.beginning);
      const ownEnd = normalizeEnd(inputs.ending);
      if (beginning < ownStart) {
        rowErrors.push(`${rowPrefix}: Beginning must be within entity bounds`);
      }
      if (ending > ownEnd) {
        rowErrors.push(`${rowPrefix}: Ending must be within entity bounds`);
      }

      normalized.push({
        id: row.id,
        systemComponentId: row.systemComponentId,
        beginning,
        ending,
        systemId: componentSystemIdById.get(row.systemComponentId),
      });
    });

    for (let first = 0; first < normalized.length; first += 1) {
      for (let second = first + 1; second < normalized.length; second += 1) {
        const a = normalized[first];
        const b = normalized[second];
        if (!a.systemId || !b.systemId || a.systemId !== b.systemId) continue;

        const overlap = a.beginning < b.ending && b.beginning < a.ending;
        if (!overlap) continue;

        rowErrors.push(
          `Rows ${first + 1} and ${second + 1} overlap within the same system`
        );
      }
    }

    normalized.forEach((candidate, index) => {
      const overlappingOther = Array.from(dataset.individuals.values())
        .filter((other) => other.id !== inputs.id)
        .some((other) =>
          getInstallationPeriods(other).some((period) => {
            if (period.systemComponentId !== candidate.systemComponentId) {
              return false;
            }
            return (
              candidate.beginning < period.ending &&
              period.beginning < candidate.ending
            );
          })
        );

      if (overlappingOther) {
        rowErrors.push(
          `Row ${index + 1} overlaps another individual in the same system component slot`
        );
      }
    });

    return { normalized, rowErrors };
  };

  useEffect(() => {
    if (!showInstallationsModal) return;
    const { rowErrors } = normalizeInstallationRows(installationRows);
    setInstallationErrors(rowErrors);
  }, [installationRows, showInstallationsModal]);

  const saveInstallations = () => {
    const { normalized, rowErrors } = normalizeInstallationRows(installationRows);
    if (rowErrors.length > 0) {
      setInstallationErrors(rowErrors);
      return;
    }

    const nextInstallations: InstallationPeriod[] = normalized
      .sort((first, second) => first.beginning - second.beginning)
      .map((row) => ({
        id: row.id,
        systemComponentId: row.systemComponentId,
        beginning: row.beginning,
        ending: row.ending,
      }));

    const synced = syncLegacyInstallationFields({
      ...inputs,
      installations: nextInstallations,
    });

    setInputs(synced);
    setDirty(true);
    setShowInstallationsModal(false);
    setInstallationErrors([]);
  };

  const getAvailabilityForRow = (row: InstallationRow) => {
    if (!row.systemComponentId) return null;

    const component = dataset.individuals.get(row.systemComponentId);
    if (!component) return null;

    const start = normalizeStart(component.beginning);
    const end = normalizeEnd(component.ending);

    const occupied = installationRows
      .filter((entry) => entry.id !== row.id)
      .map((entry) => {
        if (!entry.systemComponentId || entry.systemComponentId !== row.systemComponentId)
          return undefined;

        const from = Math.trunc(Number(entry.beginningText));
        const until =
          entry.endingText.trim() === ""
            ? Model.END_OF_TIME
            : Math.trunc(Number(entry.endingText));

        if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) {
          return undefined;
        }

        return { from, until };
      })
      .filter(
        (value): value is { from: number; until: number } =>
          !!value && value.until > start && value.from < end
      )
      .map((value) => ({
        from: Math.max(start, value.from),
        until: Math.min(end, value.until),
      }));

    const occupiedByDataset = Array.from(dataset.individuals.values())
      .filter((other) => other.id !== inputs.id)
      .flatMap((other) =>
        getInstallationPeriods(other)
          .map((period) => {
            if (period.systemComponentId !== row.systemComponentId) {
              return undefined;
            }
            return {
              from: Math.max(start, period.beginning),
              until: Math.min(end, period.ending),
            };
          })
          .filter(
            (value): value is { from: number; until: number } =>
              !!value && value.until > value.from
          )
      );

    const combinedOccupied = [...occupied, ...occupiedByDataset]
      .sort((first, second) => first.from - second.from);

    const merged: Array<{ from: number; until: number }> = [];
    combinedOccupied.forEach((slot) => {
      const previous = merged[merged.length - 1];
      if (!previous || slot.from > previous.until) {
        merged.push({ ...slot });
        return;
      }
      previous.until = Math.max(previous.until, slot.until);
    });

    const available: Array<{ from: number; until: number }> = [];
    let cursor = start;
    merged.forEach((slot) => {
      if (slot.from > cursor) {
        available.push({ from: cursor, until: slot.from });
      }
      cursor = Math.max(cursor, slot.until);
    });
    if (cursor < end) {
      available.push({ from: cursor, until: end });
    }

    const formatIntervals = (intervals: Array<{ from: number; until: number }>) =>
      intervals.length === 0
        ? "None"
        : intervals
            .map((interval) =>
              interval.until >= Model.END_OF_TIME
                ? `${interval.from}-∞`
                : `${interval.from}-${interval.until}`
            )
            .join(", ");

    return {
      occupied: formatIntervals(merged),
      available: formatIntervals(available),
    };
  };

  return (
    <>
      <Button variant="primary" onClick={() => setShow(true)} className="mx-1">
        Add Entity
      </Button>

      <Modal show={show} onHide={handleClose} className="tier-1" backdropClassName="tier-1-backdrop">
        <Modal.Header closeButton>
          <Modal.Title>{isEditMode ? "Edit Entity" : "Add Entity"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSave}>
            <Form.Group className="mb-3" controlId="formEntityCategory">
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
                      onClick={() => handleEntityType(option.id)}
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
                value={inputs.name}
                onChange={handleChangeText}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formEntityType">
              <Form.Label>Type</Form.Label>
              <Form.Select
                value={inputs.type?.id ?? ""}
                onChange={(event) => {
                  const selected = dataset.individualTypes.find(
                    (type) => type.id === event.target.value
                  );
                  if (selected) {
                    updateInputs("type", selected);
                  }
                }}
              >
                <option value="">Select type...</option>
                {dataset.individualTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            {selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM_COMPONENT && (
              <Form.Group className="mb-3" controlId="formSystemComponentParent">
                <Form.Label>Install To System</Form.Label>
                <Form.Select
                  value={inputs.installedIn ?? ""}
                  onChange={(event) => {
                    const systemId = event.target.value || undefined;
                    const selectedSystem = systemId
                      ? dataset.individuals.get(systemId)
                      : undefined;
                    if (!selectedSystem) {
                      updateInputs("installedIn", undefined);
                      return;
                    }

                    setBeginningText("");
                    setEndingText("");
                    setInputs((previous) => ({
                      ...previous,
                      installedIn: systemId,
                      beginning: -1,
                      ending: Model.END_OF_TIME,
                    }));
                    setDirty(true);
                  }}
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
                {systemComponentSlotHints && (
                  <Form.Text className="text-muted d-block mt-1">
                    System bounds: {systemComponentSlotHints.bounds} | Multiple system components can share the same slot range.
                  </Form.Text>
                )}
              </Form.Group>
            )}

            <Form.Group className="mb-3" controlId="formEntityBeginning">
              <Form.Label>Beginning</Form.Label>
              <Form.Control
                type="number"
                value={beginningText}
                onChange={handleBeginChange}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formEntityEnding">
              <Form.Label>Ending</Form.Label>
              <Form.Control
                type="number"
                value={endingText}
                onChange={handleEndChange}
              />
            </Form.Group>

            {isEditMode && selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL && (
              <Card className="mb-3">
                <Card.Body className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold">Installations</div>
                    <div className="text-muted">
                      {getInstallationPeriods(inputs).length === 0
                        ? "Not installed in any slot yet."
                        : `${getInstallationPeriods(inputs).length} total installation${
                            getInstallationPeriods(inputs).length > 1 ? "s" : ""
                          }`}
                    </div>
                  </div>
                  <Button variant="outline-primary" onClick={openInstallationsModal}>
                    {getInstallationPeriods(inputs).length > 0
                      ? "Add/Edit Installation(s)"
                      : "Add Installation"}
                  </Button>
                </Card.Body>
              </Card>
            )}

            <Form.Group className="mb-3" controlId="formEntityDescription">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                name="description"
                value={inputs.description ?? ""}
                onChange={handleChangeText}
              />
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <div className="w-100 d-flex justify-content-between align-items-center">
            <div>
              <Button
                variant="danger"
                onClick={handleDelete}
                className={isEditMode ? "d-inline-block" : "d-none"}
              >
                Delete
              </Button>
            </div>
            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={!dirty}>
                Save
              </Button>
            </div>
          </div>

          {errors.length > 0 && (
            <Alert variant="danger" className="w-100 p-2 m-0 mt-2">
              {errors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </Alert>
          )}
        </Modal.Footer>
      </Modal>

      <Modal
        show={showInstallationsModal}
        onHide={() => setShowInstallationsModal(false)}
        size="xl"
        className="tier-2"
        backdropClassName="tier-2-backdrop"
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Installation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table bordered responsive>
            <thead>
              <tr>
                <th>#</th>
                <th>System Component *</th>
                <th>From *</th>
                <th>Until</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {installationRows.map((row, index) => {
                const availability = getAvailabilityForRow(row);
                return (
                  <tr key={row.id} className="installation-row">
                    <td>{index + 1}</td>
                    <td>
                      <Form.Select
                        value={row.systemComponentId}
                        onChange={(event) =>
                          updateInstallationRow(
                            row.id,
                            "systemComponentId",
                            event.target.value
                          )
                        }
                      >
                        <option value="">-- Select slot --</option>
                        {systemComponents.map((component) => {
                          const system = component.installedIn
                            ? dataset.individuals.get(component.installedIn)
                            : undefined;
                          const begin = normalizeStart(component.beginning);
                          const end = normalizeEnd(component.ending);
                          return (
                            <option key={component.id} value={component.id}>
                              {`${component.name}${
                                system ? ` (in ${system.name})` : ""
                              } (${begin}-${
                                end >= Model.END_OF_TIME ? "∞" : String(end)
                              })`}
                            </option>
                          );
                        })}
                      </Form.Select>
                      {availability && (
                        <Form.Text className="text-muted d-block mt-1">
                          Occupied: {availability.occupied} | Available: {availability.available}
                        </Form.Text>
                      )}
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        value={row.beginningText}
                        onChange={(event) =>
                          updateInstallationRow(row.id, "beginningText", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        placeholder="∞"
                        value={row.endingText}
                        onChange={(event) =>
                          updateInstallationRow(row.id, "endingText", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <Button
                        variant="outline-danger"
                        onClick={() => removeInstallationRow(row.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <Button variant="outline-primary" onClick={addInstallationRow}>
            + Add Another Installation Period
          </Button>

          {installationErrors.length > 0 && (
            <Alert variant="danger" className="mt-3 mb-0">
              {installationErrors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="w-100 d-flex justify-content-between align-items-center">
            <div className="text-muted">
              {installationRows.length} total installation
              {installationRows.length === 1 ? "" : "s"}
            </div>
            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={() => setShowInstallationsModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveInstallations}>
                Save
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showBoundsWarningModal}
        onHide={() => setShowBoundsWarningModal(false)}
        centered
        className="tier-3"
        backdropClassName="tier-3-backdrop"
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm Installation Changes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pendingDeletionCount} installation period(s) are outside the updated
          entity bounds and will be deleted if you continue.
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowBoundsWarningModal(false)}
          >
            Keep Editing
          </Button>
          <Button variant="danger" onClick={confirmBoundsDeletion}>
            Delete Out-of-Bounds & Save
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SetIndividual;
