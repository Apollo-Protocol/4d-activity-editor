import React, { useState, useEffect } from "react";
import Button from "react-bootstrap/Button";

const Undo = (props: any) => {
  const { hasUndo, undo } = props;

  return (
    <>
      <Button
        variant="primary"
        onClick={undo}
        className={hasUndo ? "mx-1 d-block" : "mx-1 d-none"}
      >
        Undo
      </Button>
    </>
  );
};

export default Undo;
