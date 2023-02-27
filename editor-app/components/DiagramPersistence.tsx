import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import { save, load } from "amrc-activity-lib";

const DiagramPersistence = (props: any) => {
  const { dataset, setDataset, svgRef } = props;
  const [uploadText, setUploadText] = useState("Select a file to upload");

  function downloadttl() {
    let pom = document.createElement("a");
    pom.setAttribute(
      "href",
      "data:text/pldownloadain;charset=utf-8," +
        encodeURIComponent(save(dataset))
    );
    pom.setAttribute("download", "activity_diagram.ttl");

    if (document.createEvent) {
      let event = document.createEvent("MouseEvents");
      event.initEvent("click", true, true);
      pom.dispatchEvent(event);
    } else {
      pom.click();
    }
  }

  function onload(event: any) {
    if (event.target.files.length > 0) {
      event.target.files
        .item(0)
        .text()
        .then((r: any) => {
          const loadedModel = load(r);
          setDataset(loadedModel);
          setUploadText("Select a file to upload");
        })
        .catch((e: any) => {
          setUploadText("Failed to upload. Choose another file to try again.");
          console.error(e);
        });
    }
  }

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
      <Form.Group controlId="formFile">
        <Form.Control type="file" onChange={onload} />
        <Form.Text className="text-muted">{uploadText}</Form.Text>
      </Form.Group>
      <div>
        <Button variant="primary" onClick={downloadttl} className={"mx-1"}>
          Save TTL
        </Button>
        <Button variant="primary" onClick={downloadsvg} className={"mx-1"}>
          Save SVG
        </Button>
      </div>
    </>
  );
};

export default DiagramPersistence;
