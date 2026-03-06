import React from "react";
import Button from "react-bootstrap/Button";

type Props = {
  hasUndo: boolean;
  hasRedo: boolean;
  undo: () => void;
  redo: () => void;
  clearDiagram: () => void;
};

const Undo = ({ hasUndo, hasRedo, undo, redo, clearDiagram }: Props) => {

  return (
    <>
      <Button
        variant="primary"
        onClick={undo}
        className={hasUndo ? "mx-1 d-block" : "mx-1 d-none"}
      >
        Undo
      </Button>
      <Button
        variant="primary"
        onClick={redo}
        className={hasRedo ? "mx-1 d-block" : "mx-1 d-none"}
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
    </>
  );
};

export default Undo;
