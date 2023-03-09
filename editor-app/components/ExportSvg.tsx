import React, { useState, useEffect } from "react";
import Button from "react-bootstrap/Button";
import { saveJSONLD } from "lib/ActivityLib";

const ExportJson = (props: any) => {
  const { dataset, svgRef } = props;

  function serializeNode(node: any) {
    var svgxml = new XMLSerializer().serializeToString(node);
    return svgxml;
  }

  function downloadsvg(event: any) {
    let pom = document.createElement("a");
    pom.setAttribute(
      "href",
      "data:image/svg+xml;base64," + btoa(serializeNode(svgRef.current))
    );
    pom.setAttribute("download", "activity_diagram.svg");

    if (document.createEvent) {
      let event = document.createEvent("MouseEvents");
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
        Export&nbsp;SVG
      </Button>
    </>
  );
};

export default ExportJson;
