import React, { useRef, forwardRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import { ModalDialog, ModalDialogProps } from 'react-bootstrap';

const DraggableModalDialog = forwardRef<HTMLDivElement, ModalDialogProps>((props, ref) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (typeof ref === 'function') {
      ref(nodeRef.current);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = nodeRef.current;
    }
  }, [ref]);

  return (
    <Draggable handle=".modal-header" nodeRef={nodeRef}>
      <ModalDialog {...props} ref={nodeRef} />
    </Draggable>
  );
});

export default DraggableModalDialog;
