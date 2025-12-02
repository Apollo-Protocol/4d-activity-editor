import React from "react";
import Button from "react-bootstrap/Button";
import { saveJSONLD } from "lib/ActivityLib";

const ExportJson = (props: any) => {
  const { dataset } = props;

  function downloadjson() {
    const pom = document.createElement("a");
    saveJSONLD(dataset, (obj) => {
      pom.setAttribute(
        "href",
        "data:text/plain;charset=utf-8," +
          encodeURIComponent(JSON.stringify(obj, null, 2))
      );
      pom.setAttribute("download", "activity_diagram.json");
      if (document.createEvent) {
        const event = document.createEvent("MouseEvents");
        event.initEvent("click", true, true);
        pom.dispatchEvent(event);
      } else {
        pom.click();
      }
    });
  }

  return (
    <>
      <Button
        variant="primary"
        onClick={downloadjson}
        className={
          dataset.individuals.size > 0 ? "mx-1 d-block" : "mx-1 d-none"
        }
      >
        Export JSON
      </Button>
    </>
  );
};

export default ExportJson;
