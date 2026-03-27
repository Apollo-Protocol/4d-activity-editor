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

function renderHistoryTextWithColorSwatches(text: string) {
  const tokenRegex = /(#[0-9a-fA-F]{3,8}|\bdefault\b)/g;
  const matches = Array.from(text.matchAll(tokenRegex));

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  const processText = (str: string) => {
    // Bold text inside parentheses: (0-10) -> (<b>0-10</b>)
    // AND bold text inside quotes: "Activity 1" -> "<b>Activity 1</b>"
    const segments = str.split(/(\([^)]+\)|"[^"]+")/g);
    return segments.map((seg, i) => {
      if ((seg.startsWith("(") && seg.endsWith(")")) || (seg.startsWith("\"") && seg.endsWith("\""))) {
        return <strong key={i}>{seg}</strong>;
      }
      return seg;
    });
  };

  if (matches.length === 0) {
    return processText(text);
  }

  matches.forEach((match, index) => {
    const token = match[0];
    const start = match.index ?? 0;
    const end = start + token.length;

    if (start > cursor) {
      nodes.push(...processText(text.slice(cursor, start)));
    }

    const isDefault = token.toLowerCase() === "default";
    const swatchColor = isDefault ? "transparent" : token;

    nodes.push(
      <span
        key={`${token}-${index}-${start}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          whiteSpace: "nowrap",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "0.9rem",
            height: "0.9rem",
            borderRadius: "0.2rem",
            border: "1px solid #6c757d",
            backgroundColor: swatchColor,
            backgroundImage: isDefault
              ? "linear-gradient(45deg, #dee2e6 25%, transparent 25%, transparent 50%, #dee2e6 50%, #dee2e6 75%, transparent 75%, transparent)"
              : "none",
            backgroundSize: isDefault ? "0.5rem 0.5rem" : undefined,
          }}
        />
        <span>{token}</span>
      </span>
    );

    cursor = end;
  });

  if (cursor < text.length) {
    nodes.push(...processText(text.slice(cursor)));
  }

  return nodes;
}

function renderHistoryDescription(text: string) {
  const lines = text.split("\n");
  const causalHeaderIndex = lines.findIndex((line) => line.trim().endsWith(" which:"));
  if (causalHeaderIndex >= 0) {
    const prefixLines = lines
      .slice(0, causalHeaderIndex)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const header = lines[causalHeaderIndex].trim().replace(/ which:$/, "");
    const items = lines
      .slice(causalHeaderIndex + 1)
      .map((item) => item.trim())
      .filter((item) => item.startsWith("- "))
      .map((item) => item.slice(2).trim())
      .filter((item) => item.length > 0);

    if (items.length > 0) {
      return (
        <>
          {prefixLines.map((line, index) => (
            <div className="mb-1" key={`${line}-${index}`}>
              {renderHistoryTextWithColorSwatches(line)}
            </div>
          ))}
          <div className="mb-1">{renderHistoryTextWithColorSwatches(header)} which:</div>
          <ul className="history-entry-description-list mb-0">
            {items.map((item, index) => (
              <li key={`${item}-${index}`}>{renderHistoryTextWithColorSwatches(item)}</li>
            ))}
          </ul>
        </>
      );
    }
  }

  const items = text
    .split(/;\s+(?=[A-Z])/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (items.length <= 1) {
    return renderHistoryTextWithColorSwatches(text);
  }

  return (
    <ul className="history-entry-description-list mb-0">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{renderHistoryTextWithColorSwatches(item)}</li>
      ))}
    </ul>
  );
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
                <div
                  className="history-entry-title"
                  style={{ fontWeight: "normal" }}
                >
                  {renderHistoryTextWithColorSwatches(
                    mode === "undo" ? entry.undoLabel : entry.redoLabel
                  )}
                </div>
              </td>
              <td>
                <div
                  className="history-entry-category-text"
                  style={{ fontWeight: "normal" }}
                >
                  {entry.category}
                </div>
              </td>
              <td className="history-table-change-cell">
                <div className="history-entry-description">
                  {renderHistoryDescription(entry.description)}
                </div>
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
