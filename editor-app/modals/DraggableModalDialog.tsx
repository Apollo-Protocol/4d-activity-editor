import React, { useRef, forwardRef, useEffect, useState } from 'react';
import Draggable from 'react-draggable';
import { ModalDialog, ModalDialogProps } from 'react-bootstrap';

let suppressModalHideUntil = 0;

export function shouldSuppressModalHide() {
  return Date.now() < suppressModalHideUntil;
}

const DraggableModalDialog = forwardRef<HTMLDivElement, ModalDialogProps>((props, ref) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [dragDisabled, setDragDisabled] = useState(false);
  
  useEffect(() => {
    if (typeof ref === 'function') {
      ref(nodeRef.current);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = nodeRef.current;
    }
  }, [ref]);

  // When a text selection starts inside an editable field and the mouse is
  // released outside the dialog, react-bootstrap may treat the sequence as a
  // backdrop click. Mark the next onHide as suppressible so modal handlers can
  // ignore that close request.
  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;

    let mouseDownInEditable = false;

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return !!target.closest(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]), textarea, [contenteditable="true"]'
      );
    };

    const onMouseDown = (event: MouseEvent) => {
      mouseDownInEditable = isEditableTarget(event.target);
    };

    const markSuppressedHideIfNeeded = (event: MouseEvent) => {
      if (!mouseDownInEditable) return;
      const target = event.target;
      if (!(target instanceof Node) || !el.contains(target)) {
        suppressModalHideUntil = Date.now() + 250;
      }
      mouseDownInEditable = false;
    };

    el.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', markSuppressedHideIfNeeded, true);
    document.addEventListener('click', markSuppressedHideIfNeeded, true);

    return () => {
      el.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mouseup', markSuppressedHideIfNeeded, true);
      document.removeEventListener('click', markSuppressedHideIfNeeded, true);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueries = [
      window.matchMedia('(max-width: 991.98px)'),
      window.matchMedia('(pointer: coarse)'),
      window.matchMedia('(hover: none)'),
    ];

    const updateDragDisabled = () => {
      setDragDisabled(mediaQueries.some((query) => query.matches));
    };

    updateDragDisabled();
    mediaQueries.forEach((query) => query.addEventListener('change', updateDragDisabled));

    return () => {
      mediaQueries.forEach((query) => query.removeEventListener('change', updateDragDisabled));
    };
  }, []);

  return (
    <Draggable disabled={dragDisabled} handle=".modal-header" cancel=".btn-close,.btn-close *" nodeRef={nodeRef}>
      <ModalDialog {...props} ref={nodeRef} />
    </Draggable>
  );
});

export default DraggableModalDialog;
