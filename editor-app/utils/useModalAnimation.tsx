import React, { useMemo } from "react";
import {
  getStoredModalAnimation,
  getModalAnimationClass,
} from "@/utils/appearance";

/**
 * Returns props to spread onto every `<Modal>` for the user's chosen animation.
 *
 * Usage:
 * ```tsx
 * const modalAnim = useModalAnimation();
 * <Modal className={modalAnim.className} ...>
 *   <Modal.Header>...</Modal.Header>
 *   <Modal.Body>...</Modal.Body>
 *   {modalAnim.sketchSvg}
 * </Modal>
 * ```
 *
 * For the "Sketch" animation the SVG overlay is injected inside `.modal-content`
 * via a React portal-free approach: just render `sketchSvg` anywhere inside the
 * Modal and CSS `position: absolute` handles placement.
 */
export function useModalAnimation() {
  const animKey = typeof window !== "undefined" ? getStoredModalAnimation() : "none";
  const className = getModalAnimationClass(animKey);

  const sketchSvg = useMemo(
    () =>
      animKey === "sketch" ? (
        <svg
          className="modal-sketch-svg"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          <rect x="0" y="0" fill="none" width="100%" height="100%" />
        </svg>
      ) : null,
    [animKey]
  );

  return { className, sketchSvg };
}
