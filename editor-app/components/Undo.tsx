import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import ListGroup from "react-bootstrap/ListGroup";
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

function renderHistoryList<T>(
  entries: HistoryEntry<T>[],
  mode: "undo" | "redo",
  onSelect: (index: number) => void,
  emptyText: string
) {
  if (entries.length === 0) {
    return <p className="text-muted mb-0">{emptyText}</p>;
  }

  return (
    <ListGroup variant="flush" className="history-list-group">
      {entries.map((entry, i) => (
        <ListGroup.Item
          key={i}
          action
          onClick={() => onSelect(i)}
          className="history-list-item"
        >
          <span className="history-index-badge">{i + 1}</span>
          <div className="history-entry-copy">
            <div className="history-entry-meta-row">
              <span className="history-entry-mode">{mode === "undo" ? "Undo" : "Redo"}</span>
              <span className="history-entry-category">{entry.category}</span>
            </div>
            <div className="history-entry-title">
              {mode === "undo" ? entry.undoLabel : entry.redoLabel}
            </div>
            <small className="history-entry-description">{entry.description}</small>
            <small className="history-entry-step">{getStepText(i, mode)}</small>
          </div>
          <span className="history-entry-arrow" aria-hidden>
            {mode === "undo" ? "↩" : "↪"}
          </span>
        </ListGroup.Item>
      ))}
    </ListGroup>
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
      >
        <Modal.Header closeButton>
          <Modal.Title>Undo History</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <div className="history-modal-note">
            Choose a row to undo directly to that point. Each entry shows both the original change and the exact action that will happen when you click it.
          </div>
          {renderHistoryList(
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
      >
        <Modal.Header closeButton>
          <Modal.Title>Redo History</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <div className="history-modal-note">
            Choose a row to redo directly to that point. The first line states exactly what will be reapplied.
          </div>
          {renderHistoryList(
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
