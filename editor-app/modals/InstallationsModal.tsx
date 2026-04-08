import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import DraggableModalDialog from "@/modals/DraggableModalDialog";
import Form from "react-bootstrap/Form";
import Table from "react-bootstrap/Table";
import Alert from "react-bootstrap/Alert";
import { Individual } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import { normalizeStart, normalizeEnd } from "@/utils/installations";
import type { InstallationRow } from "@/types/setIndividualTypes";

interface InstallationsModalProps {
  show: boolean;
  onHide: () => void;
  modalAnim: { className: string; sketchSvg: React.ReactNode };
  inputs: Individual;
  installationRows: InstallationRow[];
  installationErrors: string[];
  systemComponents: Individual[];
  dataset: Model;
  onSave: () => void;
  onCancel: () => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onUpdateRow: (rowId: string, key: keyof InstallationRow, value: string) => void;
  getAvailabilityForRow: (row: InstallationRow) => { occupied: string; available: string } | null;
}

const InstallationsModal = ({
  show,
  onHide,
  modalAnim,
  inputs,
  installationRows,
  installationErrors,
  systemComponents,
  dataset,
  onSave,
  onCancel,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  getAvailabilityForRow,
}: InstallationsModalProps) => {
  return (
    <Modal dialogAs={DraggableModalDialog}
      className={modalAnim.className}
      show={show}
      onHide={onHide}
      size="xl"
    >
      {modalAnim.sketchSvg}
      <Modal.Header closeButton>
        <Modal.Title>
          Add Installation for {inputs.name || "Entity"} ({inputs.beginning === -1 ? "0" : inputs.beginning} - {inputs.ending >= Model.END_OF_TIME ? "∞" : inputs.ending})
        </Modal.Title>
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
                      className={`installation-select${
                        row.systemComponentId ? " has-selection" : ""
                      }`}
                      value={row.systemComponentId}
                      onChange={(event) =>
                        onUpdateRow(
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
                      min="0" step="any"
                      value={row.beginningText}
                      onChange={(event) =>
                        onUpdateRow(row.id, "beginningText", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      min="0" step="any"
                      placeholder="∞"
                      value={row.endingText}
                      onChange={(event) =>
                        onUpdateRow(row.id, "endingText", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <Button
                      variant="outline-danger"
                      onClick={() => onRemoveRow(row.id)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>

        <Button variant="primary" onClick={onAddRow}>
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
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onSave}>
              Save
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default InstallationsModal;
