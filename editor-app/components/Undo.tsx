import React, { useState, useEffect } from "react";
import Button from "react-bootstrap/Button";

const Undo = (props: any) => {
  const { hasUndo, undo, clearDiagram } = props;

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
