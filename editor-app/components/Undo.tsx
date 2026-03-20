import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import ListGroup from "react-bootstrap/ListGroup";
import DraggableModalDialog from "@/components/DraggableModalDialog";

export interface HistoryEntry<T> {
  model: T;
  description: string;
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
          <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
            Click an entry to undo back to that point. Most recent change is at the top.
          </p>
          {undoHistory.length === 0 ? (
            <p className="text-muted mb-0">No undo history.</p>
          ) : (
            <ListGroup variant="flush">
              {undoHistory.map((entry, i) => (
                <ListGroup.Item
                  key={i}
                  action
                  onClick={() => {
                    undoTo(i);
                    setShowUndoModal(false);
                  }}
                  className="d-flex align-items-center gap-3 py-2"
                >
                  <span
                    className="badge rounded-pill bg-secondary"
                    style={{ minWidth: "2rem", fontSize: "0.75rem" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-grow-1">
                    <div style={{ fontSize: "0.92rem" }}>{entry.description}</div>
                    <small className="text-muted">
                      {i === 0 ? "Most recent change" : `${i + 1} step${i > 0 ? "s" : ""} back`}
                    </small>
                  </div>
                  <span className="text-muted" style={{ fontSize: "0.8rem" }}>↩</span>
                </ListGroup.Item>
              ))}
            </ListGroup>
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
          <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
            Click an entry to redo forward to that point. Next change to reapply is at the top.
          </p>
          {redoHistory.length === 0 ? (
            <p className="text-muted mb-0">No redo history.</p>
          ) : (
            <ListGroup variant="flush">
              {redoHistory.map((entry, i) => (
                <ListGroup.Item
                  key={i}
                  action
                  onClick={() => {
                    redoTo(i);
                    setShowRedoModal(false);
                  }}
                  className="d-flex align-items-center gap-3 py-2"
                >
                  <span
                    className="badge rounded-pill bg-secondary"
                    style={{ minWidth: "2rem", fontSize: "0.75rem" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-grow-1">
                    <div style={{ fontSize: "0.92rem" }}>{entry.description}</div>
                    <small className="text-muted">
                      {i === 0 ? "Next change" : `${i + 1} step${i > 0 ? "s" : ""} forward`}
                    </small>
                  </div>
                  <span className="text-muted" style={{ fontSize: "0.8rem" }}>↪</span>
                </ListGroup.Item>
              ))}
            </ListGroup>
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
