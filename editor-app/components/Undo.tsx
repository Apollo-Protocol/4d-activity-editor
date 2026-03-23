import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Table from "react-bootstrap/Table";
import DraggableModalDialog from "@/components/DraggableModalDialog";

export interface HistoryEntry<T> {
  model: T;
  category: string;
  description: string;
  undoLabel: string;
  redoLabel: string;
}

type Props<T> = {
  hasUndo: boolean;
  hasRedo: boolean;
  undo: () => void;
  redo: () => void;
  clearDiagram: () => void;
  undoHistory: HistoryEntry<T>[];
  redoHistory: HistoryEntry<T>[];
  undoTo: (index: number) => void;
  redoTo: (index: number) => void;
};

function getStepText(index: number, mode: "undo" | "redo") {
  if (mode === "undo") {
    return index === 0 ? "Most recent change" : `${index + 1} steps back`;
  }
  return index === 0 ? "Next change" : `${index + 1} steps forward`;
}

function renderHistoryTable<T>(
  entries: HistoryEntry<T>[],
  mode: "undo" | "redo",
  onSelect: (index: number) => void,
  emptyText: string
) {
  if (entries.length === 0) {
    return <p className="text-muted mb-0">{emptyText}</p>;
  }

  return (
    <div className="history-table-wrap">
      <Table bordered className="history-table mb-0 align-middle">
        <thead>
          <tr>
            <th>#</th>
            <th>{mode === "undo" ? "Will Undo" : "Will Redo"}</th>
            <th>Category</th>
            <th>Recorded Change</th>
            <th>Position</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={i}>
              <td className="history-table-index">{i + 1}</td>
              <td>
                <div className="history-entry-title">
                  {mode === "undo" ? entry.undoLabel : entry.redoLabel}
                </div>
              </td>
              <td>
                <div className="history-entry-category-text">{entry.category}</div>
              </td>
              <td>
                <div className="history-entry-description">{entry.description}</div>
              </td>
              <td>
                <div className="history-entry-step">{getStepText(i, mode)}</div>
              </td>
              <td className="history-table-action-cell">
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="history-table-action-btn"
                  onClick={() => onSelect(i)}
                >
                  {mode === "undo" ? "Undo to Here" : "Redo to Here"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}


function Undo<T>({
  hasUndo,
  hasRedo,
  undo,
  redo,
  clearDiagram,
  undoHistory,
  redoHistory,
  undoTo,
  redoTo,
}: Props<T>) {
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [showRedoModal, setShowRedoModal] = useState(false);

  const handleUndoContext = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (undoHistory.length > 0) setShowUndoModal(true);
    },
    [undoHistory]
  );

  const handleRedoContext = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (redoHistory.length > 0) setShowRedoModal(true);
    },
    [redoHistory]
  );

  return (
    <>
      <Button
        variant="primary"
        onClick={undo}
        onContextMenu={handleUndoContext}
        className={hasUndo ? "mx-1 d-block" : "mx-1 d-none"}
        title="Undo (right-click for history)"
      >
        Undo
      </Button>
      <Button
        variant="primary"
        onClick={redo}
        onContextMenu={handleRedoContext}
        className={hasRedo ? "mx-1 d-block" : "mx-1 d-none"}
        title="Redo (right-click for history)"
      >
        Redo
      </Button>
      <Button
        variant="danger"
        onClick={clearDiagram}
        className="mx-1 d-block"
      >
        Clear diagram
      </Button>

      {/* Undo history modal */}
      <Modal
        dialogAs={DraggableModalDialog}
        show={showUndoModal}
        onHide={() => setShowUndoModal(false)}
        size="lg"
        dialogClassName="history-modal-dialog"
      >
        <Modal.Header closeButton>
          <Modal.Title>Undo History</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {renderHistoryTable(
            undoHistory,
            "undo",
            (index) => {
              undoTo(index);
              setShowUndoModal(false);
            },
            "No undo history."
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowUndoModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Redo history modal */}
      <Modal
        dialogAs={DraggableModalDialog}
        show={showRedoModal}
        onHide={() => setShowRedoModal(false)}
        size="lg"
        dialogClassName="history-modal-dialog"
      >
        <Modal.Header closeButton>
          <Modal.Title>Redo History</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {renderHistoryTable(
            redoHistory,
            "redo",
            (index) => {
              redoTo(index);
              setShowRedoModal(false);
            },
            "No redo history."
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRedoModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default Undo;
