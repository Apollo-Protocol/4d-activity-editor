import React from "react";
import Button from "react-bootstrap/Button";

const ExportSvg = (props: any) => {
  const { dataset, svgRef } = props;

  function serializeNode(node: SVGSVGElement | null): string {
    if (!node) return "";
    const serializer = new XMLSerializer();
    return serializer.serializeToString(node);
  }

  // Safe base64 for UTF‑8 SVG
  function toBase64Utf8(str: string): string {
    return window.btoa(unescape(encodeURIComponent(str)));
  }

  function downloadsvg() {
    if (!svgRef?.current) return;

    const raw = serializeNode(svgRef.current);

    const base64 = toBase64Utf8(raw);

    const pom = document.createElement("a");
    pom.setAttribute("href", "data:image/svg+xml;base64," + base64);
    pom.setAttribute("download", "activity_diagram.svg");

    if (document.createEvent) {
      const event = document.createEvent("MouseEvents");
      event.initEvent("click", true, true);
      pom.dispatchEvent(event);
    } else {
      pom.click();
    }
  }

  return (
    <>
      <Button
        variant="primary"
        onClick={downloadsvg}
        className={
          dataset.individuals.size > 0 ? "mx-1 d-block" : "mx-1 d-none"
        }
      >
        Export SVG
      </Button>
    </>
  );
};

export default ExportSvg;
