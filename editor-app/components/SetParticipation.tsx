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
import { Activity, Participation, Individual, EntityType } from "@/lib/Schema";
import { InputGroup } from "react-bootstrap";
import { v4 as uuidv4 } from "uuid";
import { Model } from "@/lib/Model";

interface Props {
  setActivity: (activity: Activity) => void;
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedActivity: Activity | undefined;
  setSelectedActivity: Dispatch<SetStateAction<Activity | undefined>>;
  selectedParticipation: Participation | undefined;
  setSelectedParticipation: any;
  dataset: Model;
  updateDataset: Dispatch<Dispatch<Model>>;
}

const SetParticipation = (props: Props) => {
  const {
    setActivity,
    show,
    setShow,
    selectedActivity,
    setSelectedActivity,
    selectedParticipation,
    setSelectedParticipation,
    dataset,
    updateDataset,
  } = props;

  const [dirty, setDirty] = useState(false);

  // Custom role selector state (search / create / inline edit)
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState("");
  const roleDropdownRef = useRef<HTMLDivElement | null>(null);

  // Build available participants including ALL virtual installation rows
  const availableParticipants = useMemo(() => {
    const result: Individual[] = [];
    const addedIds = new Set<string>();

    // Helper to add individual if not already added
    const addIfNew = (ind: Individual) => {
      if (!addedIds.has(ind.id)) {
        addedIds.add(ind.id);
        result.push(ind);
      }
    };

    // Get all display individuals (includes virtual rows for installations)
    const displayIndividuals = dataset.getDisplayIndividuals();

    displayIndividuals.forEach((ind) => {
      const entityType = ind.entityType ?? EntityType.Individual;

      // For virtual rows, always include them (they represent specific installation instances)
      if (ind._isVirtualRow) {
        addIfNew(ind);
        return;
      }

      // Skip top-level InstalledComponents that have installations
      if (entityType === EntityType.InstalledComponent) {
        const hasInstallations =
          ind.installations && ind.installations.length > 0;
        if (hasInstallations) {
          return; // Skip - will be shown as virtual rows
        }
        addIfNew(ind);
        return;
      }

      // Skip top-level SystemComponents that have installations
      if (entityType === EntityType.SystemComponent) {
        const hasInstallations =
          ind.installations && ind.installations.length > 0;
        if (hasInstallations) {
          return; // Skip - will be shown as virtual rows
        }
        addIfNew(ind);
        return;
      }

      // Systems and regular Individuals - always include
      addIfNew(ind);
    });

    return result;
  }, [dataset]);

  // Filter participants that overlap with activity time
  const eligibleParticipants = useMemo(() => {
    if (!selectedActivity) return availableParticipants;

    const actStart = selectedActivity.beginning;
    const actEnd = selectedActivity.ending;

    return availableParticipants.filter((ind) => {
      // For virtual installation rows, use their specific time period
      const indStart = ind.beginning >= 0 ? ind.beginning : 0;
      const indEnd =
        ind.ending < Model.END_OF_TIME ? ind.ending : Model.END_OF_TIME;

      // Check overlap
      return actStart < indEnd && actEnd > indStart;
    });
  }, [availableParticipants, selectedActivity]);

  // Group participants by type for display
  const groupedParticipants = useMemo(() => {
    const groups = {
      systems: [] as Individual[],
      systemComponents: [] as Individual[],
      installedComponents: [] as Individual[],
      individuals: [] as Individual[],
    };

    eligibleParticipants.forEach((ind) => {
      const entityType = ind.entityType ?? EntityType.Individual;

      switch (entityType) {
        case EntityType.System:
          groups.systems.push(ind);
          break;
        case EntityType.SystemComponent:
          groups.systemComponents.push(ind);
          break;
        case EntityType.InstalledComponent:
          groups.installedComponents.push(ind);
          break;
        default:
          groups.individuals.push(ind);
          break;
      }
    });

    return groups;
  }, [eligibleParticipants]);

  // click outside to close role dropdown
  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(ev.target as Node)
      ) {
        setRoleOpen(false);
        setEditingRoleId(null);
        setEditingRoleValue("");
      }
    }
    if (roleOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [roleOpen]);

  const handleClose = () => {
    setShow(false);
    setSelectedParticipation(undefined);
    setSelectedActivity(undefined);
    setDirty(false);
  };
  const handleShow = () => {};
  const handleAdd = (event: any) => {
    event.preventDefault();
    if (
      dirty &&
      selectedActivity &&
      selectedActivity.participations &&
      selectedParticipation &&
      selectedParticipation.individualId
    ) {
      let localActivity: Activity = { ...selectedActivity };
      localActivity.participations.set(
        selectedParticipation.individualId,
        selectedParticipation
      );
      setActivity(localActivity);
    }
    handleClose();
  };

  const handleTypeChange = (e: any) => {
    // kept for backward compatibility if used; prefer custom selector
    dataset.roles.forEach((role) => {
      if (e.target.value == role.id) {
        setSelectedParticipation({
          ...selectedParticipation,
          [e.target.name]: role,
        });
        setDirty(true);
      }
    });
  };

  // ----- role selector helpers -----
  const filteredRoles = dataset.roles.filter((r) =>
    r.name.toLowerCase().includes(roleSearch.toLowerCase())
  );

  const showCreateRoleOption =
    roleSearch.trim().length > 0 &&
    !dataset.roles.some(
      (r) => r.name.toLowerCase() === roleSearch.trim().toLowerCase()
    );

  const handleSelectRole = (roleId: string) => {
    const r = dataset.roles.find((x) => x.id === roleId);
    if (r && selectedParticipation) {
      setSelectedParticipation({ ...selectedParticipation, role: r });
      setDirty(true);
    }
    setRoleOpen(false);
    setRoleSearch("");
    setEditingRoleId(null);
    setEditingRoleValue("");
  };

  const handleCreateRoleFromSearch = () => {
    const name = roleSearch.trim();
    if (!name) return;
    const newId = uuidv4();

    updateDataset((d) => {
      d.addRoleType(newId, name);
      return d;
    });

    // immediately select the created role for this participation
    const createdRole = { id: newId, name, isCoreHqdm: false };
    if (selectedParticipation) {
      setSelectedParticipation({ ...selectedParticipation, role: createdRole });
      setDirty(true);
    }

    setRoleOpen(false);
    setRoleSearch("");
  };

  const startEditRole = (roleId: string, currentName: string, e: any) => {
    e.stopPropagation();
    const found = dataset.roles.find((x) => x.id === roleId);
    if (found && found.isCoreHqdm) return; // prevent editing core defaults
    setEditingRoleId(roleId);
    setEditingRoleValue(currentName);
  };

  const saveEditRole = () => {
    if (!editingRoleId) return;
    const newName = editingRoleValue.trim();
    if (!newName) return;

    updateDataset((d) => {
      const kind = d.roles.find((x) => x.id === editingRoleId);
      if (kind) kind.name = newName;

      // Update all participations referencing this role across activities
      d.activities.forEach((a) => {
        a.participations.forEach((p) => {
          if (p.role && p.role.id === editingRoleId) {
            const canonical = d.roles.find((x) => x.id === editingRoleId);
            if (canonical) p.role = canonical;
          }
        });
      });

      // update defaultRole reference if needed
      if (d.defaultRole && d.defaultRole.id === editingRoleId) {
        const canonical = d.roles.find((x) => x.id === editingRoleId);
        if (canonical) d.defaultRole = canonical;
      }

      return d;
    });

    // Update current selectedParticipation role if it was the edited one
    if (
      selectedParticipation &&
      selectedParticipation.role?.id === editingRoleId
    ) {
      setSelectedParticipation({
        ...selectedParticipation,
        role: { id: editingRoleId, name: newName, isCoreHqdm: false },
      });
      setDirty(true);
    }

    setEditingRoleId(null);
    setEditingRoleValue("");
  };

  const cancelEditRole = () => {
    setEditingRoleId(null);
    setEditingRoleValue("");
  };
  // ----- end role helpers -----

  // Helper to get display name for an individual (including virtual rows)
  const getDisplayName = (ind: Individual): string => {
    // Check if this is an installation reference (virtual row)
    if (ind._isVirtualRow && ind.id.includes("__installed_in__")) {
      const originalId = ind.id.split("__installed_in__")[0];
      const originalComponent = dataset.individuals.get(originalId);

      if (originalComponent) {
        // Use the virtual row's already-computed bounds
        const endStr =
          ind.ending >= Model.END_OF_TIME ? "∞" : String(ind.ending);
        const startStr = String(ind.beginning);

        // Get parent info from _parentPath
        const parentPath = ind._parentPath || "";
        const pathParts = parentPath.split("__");
        const systemId = pathParts[0];
        const system = dataset.individuals.get(systemId);

        return `${originalComponent.name} in ${
          system?.name || "Unknown"
        } (${startStr}-${endStr})`;
      }
    }
    return ind.name;
  };

  // Get participant name from ID (handles virtual IDs)
  const getParticipantName = (participantId: string): string => {
    // First try to find in available participants (includes virtual rows)
    const found = availableParticipants.find((p) => p.id === participantId);
    if (found) {
      return getDisplayName(found);
    }

    // Fallback: try to parse virtual ID
    if (participantId.includes("__installed_in__")) {
      const originalId = participantId.split("__installed_in__")[0];
      const rest = participantId.split("__installed_in__")[1];
      const parts = rest.split("__");
      const targetId = parts[0];
      const installationId = parts[1];

      const originalComponent = dataset.individuals.get(originalId);
      const target = dataset.individuals.get(targetId);

      if (originalComponent && target) {
        const installation = originalComponent.installations?.find(
          (inst) => inst.id === installationId
        );
        if (installation) {
          const endStr =
            (installation.ending ?? Model.END_OF_TIME) >= Model.END_OF_TIME
              ? "∞"
              : installation.ending;
          return `${originalComponent.name} in ${target.name} (${installation.beginning}-${endStr})`;
        }
        return `${originalComponent.name} in ${target.name}`;
      }
    }

    // Final fallback: try dataset
    const ind = dataset.individuals.get(participantId);
    return ind?.name || participantId;
  };

  return (
    <>
      <Modal show={show} onHide={handleClose} onShow={handleShow}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Participation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAdd}>
            {/* Show current participant */}
            {selectedParticipation && (
              <Form.Group className="mb-3">
                <Form.Label>Participant</Form.Label>
                <Form.Control
                  type="text"
                  value={getParticipantName(selectedParticipation.individualId)}
                  disabled
                />
              </Form.Group>
            )}

            <Form.Group className="mb-3" controlId="formParticipationRole">
              <Form.Label>Role</Form.Label>
              <div
                ref={roleDropdownRef}
                className="position-relative"
                style={{ zIndex: 1050 }}
              >
                <button
                  type="button"
                  className="w-100 btn btn-outline-secondary d-flex justify-content-between align-items-center"
                  onClick={() => setRoleOpen((s) => !s)}
                >
                  <span className="text-truncate">
                    {selectedParticipation?.role?.name || "Select role..."}
                  </span>
                  <span style={{ marginLeft: 8 }}>▾</span>
                </button>

                {roleOpen && (
                  <div
                    className="card mt-1 position-absolute w-100"
                    style={{ maxHeight: 300, overflow: "hidden", zIndex: 1051 }}
                  >
                    <div className="card-body p-2 border-bottom">
                      <input
                        className="form-control form-control-sm"
                        placeholder="Search or create role..."
                        value={roleSearch}
                        onChange={(e) => setRoleSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && showCreateRoleOption) {
                            e.preventDefault();
                            handleCreateRoleFromSearch();
                          }
                        }}
                        autoFocus
                      />
                    </div>

                    <div style={{ maxHeight: 180, overflow: "auto" }}>
                      {filteredRoles.map((r) => (
                        <div
                          key={r.id}
                          className={`d-flex align-items-center justify-content-between px-3 py-2 ${
                            selectedParticipation?.role?.id === r.id
                              ? "bg-primary text-white"
                              : ""
                          }`}
                          style={{ cursor: "pointer" }}
                          onClick={() => handleSelectRole(r.id)}
                        >
                          {editingRoleId === r.id ? (
                            <div className="d-flex align-items-center w-100">
                              <input
                                className="form-control form-control-sm me-2"
                                value={editingRoleValue}
                                onChange={(e) =>
                                  setEditingRoleValue(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditRole();
                                  if (e.key === "Escape") cancelEditRole();
                                }}
                                autoFocus
                              />
                              <div className="d-flex align-items-center">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success me-1"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    saveEditRole();
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    cancelEditRole();
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-grow-1">{r.name}</div>
                              <div className="d-flex align-items-center">
                                {selectedParticipation?.role?.id === r.id && (
                                  <span className="me-2">✓</span>
                                )}
                                {!r.isCoreHqdm && (
                                  <button
                                    type="button"
                                    className={`btn btn-sm btn-link p-0 ${
                                      selectedParticipation?.role?.id === r.id
                                        ? "text-white"
                                        : ""
                                    }`}
                                    onClick={(e) =>
                                      startEditRole(r.id, r.name, e)
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

                      {showCreateRoleOption && (
                        <div
                          className="px-3 py-2 text-primary fw-medium border-top"
                          style={{ cursor: "pointer" }}
                          onClick={handleCreateRoleFromSearch}
                        >
                          Create "{roleSearch}"
                        </div>
                      )}

                      {filteredRoles.length === 0 && !showCreateRoleOption && (
                        <div className="p-3 text-muted small">
                          No results found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <div className="d-flex gap-2 w-100 justify-content-end">
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
            <Button variant="primary" onClick={handleAdd} disabled={!dirty}>
              Save
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SetParticipation;

function hasAnyOverlap(
  aStart: number,
  aEnd: number,
  iStart: number,
  iEnd: number
) {
  return aEnd > iStart && aStart < iEnd; // strict overlap
}
function fullyInside(
  aStart: number,
  aEnd: number,
  iStart: number,
  iEnd: number
) {
  return aStart >= iStart && aEnd <= iEnd;
}
