import { useState } from "react";
import { Button, Container, Form } from "react-bootstrap";
import {
  save,
  load,
  saveRefDataAsTTL,
  loadRefDataFromTTL,
} from "amrc-activity-lib";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const DiagramPersistence = (props: any) => {
  const { dataset, setDataset, svgRef, configData, setConfigData } = props;
  const [uploadText, setUploadText] = useState("Select a file to upload");
  const [uploadSettingText, setUploadSettingText] = useState(
    "Select a settings file to upload"
  );
  const [refDataOnly, setRefDataOnly] = useState(false);

  function downloadttl() {
    let pom = document.createElement("a");
    if (refDataOnly) {
      pom.setAttribute(
        "href",
        "data:text/pldownloadain;charset=utf-8," +
          encodeURIComponent(saveRefDataAsTTL(dataset))
      );
      pom.setAttribute("download", "activity_diagram_ref_data.ttl");
    } else {
      pom.setAttribute(
        "href",
        "data:text/pldownloadain;charset=utf-8," +
          encodeURIComponent(save(dataset))
      );
      pom.setAttribute("download", "activity_diagram.ttl");
    }

    if (document.createEvent) {
      let event = document.createEvent("MouseEvents");
      event.initEvent("click", true, true);
      pom.dispatchEvent(event);
    } else {
      pom.click();
    }
  }

  function downloadConfig() {
    let pom = document.createElement("a");

    pom.setAttribute(
      "href",
      "data:text/pldownloadain;charset=utf-8," +
        encodeURIComponent(JSON.stringify(configData))
    );
    pom.setAttribute("download", "activity_diagram_settings.json");

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
          if (refDataOnly) {
            const loadedModel = loadRefDataFromTTL(r);
            setDataset(loadedModel);
          } else {
            const loadedModel = load(r);
            setDataset(loadedModel);
          }
          setUploadText("Select a file to upload");
        })
        .catch((e: any) => {
          setUploadText("Failed to upload. Choose another file to try again.");
          console.error(e);
        });
    }
  }

  function onloadSettings(event: any) {
    if (event.target.files.length > 0) {
      event.target.files
        .item(0)
        .text()
        .then((r: any) => {
          const loadedConfig = JSON.parse(r);
          setConfigData(loadedConfig);
          setUploadSettingText("Select a settings file to upload");
        })
        .catch((e: any) => {
          setUploadSettingText(
            "Failed to upload. Choose another file to try again."
          );
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
    <Container>
      <Row className="mt-2">
        <Col
          md={12}
          lg={6}
          className="d-flex justify-content-center align-items-start"
        >
          <Form.Group controlId="formFile">
            <Form.Control type="file" onChange={onload} />
            <Form.Text className="text-muted">{uploadText}</Form.Text>
            <Form.Check
              type="switch"
              label="Reference Types only"
              checked={refDataOnly}
              onChange={() => setRefDataOnly(!refDataOnly)}
            />
          </Form.Group>

          <Button variant="primary" onClick={downloadttl} className={"mx-1"}>
            Save TTL
          </Button>
          <Button variant="primary" onClick={downloadsvg} className={"mx-1"}>
            Export SVG
          </Button>
        </Col>
        <Col
          md={12}
          lg={6}
          className="d-flex justify-content-center align-items-start"
        >
          <Form.Group controlId="formFile">
            <Form.Control type="file" onChange={onloadSettings} />
            <Form.Text className="text-muted">{uploadSettingText}</Form.Text>
          </Form.Group>
          <Button variant="primary" onClick={downloadConfig} className={"mx-1"}>
            Save Settings
          </Button>
        </Col>
      </Row>
      <Row className="mt-2"></Row>
    </Container>
  );
};

export default DiagramPersistence;
