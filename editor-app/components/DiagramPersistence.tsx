import { useState } from "react";
import { Button, Container, Form } from "react-bootstrap";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

import {
  save,
  load,
  saveRefDataAsTTL,
  loadRefDataFromTTL,
} from "lib/ActivityLib";

import { saveFile, loadFile } from "./save_load.ts";

const DiagramPersistence = (props: any) => {
  const { dataset, setDataset, svgRef } = props;
  const [uploadText, setUploadText] = useState("");
  const [refDataOnly, setRefDataOnly] = useState(false);

  function downloadTtl() {
    if (refDataOnly) {
      saveFile(saveRefDataAsTTL(dataset), 
        "activity_diagram_ref_data.ttl", "text/turtle");
    }
    else {
      saveFile(save(dataset), "activity_diagram.ttl", "text/turtle");
    }
  }

  function uploadTtl() {
    loadFile("text/turtle,.ttl")
      .then((f: File) => f.text())
      .then((ttl: string) => {
        if (refDataOnly) {
          const loadedModel = loadRefDataFromTTL(ttl);
          setDataset(loadedModel);
        } else {
          const loadedModel = load(ttl);
          setDataset(loadedModel);
        }
        setUploadText("");
      })
      .catch((e: any) => {
        setUploadText("Failed to upload. Choose another file to try again.");
        console.error(e);
      });
  }

  return (
    <Container>
      <Row>
        <Col
          md={12}
          lg={6}
          className="mt-2 d-flex align-items-start justify-content-center justify-content-lg-start"
        >
        </Col>
        <Col
          md={12}
          lg={6}
          className="mt-2 d-flex align-items-start justify-content-center justify-content-lg-end"
        >
          <Form.Group controlId="formFile">
            <Button variant="primary" onClick={uploadTtl}>Load TTL</Button>
            <Form.Text className="text-muted">{uploadText}</Form.Text>
            <Form.Check
              type="switch"
              label="Reference Types only"
              checked={refDataOnly}
              onChange={() => setRefDataOnly(!refDataOnly)}
            />
          </Form.Group>
          <Button variant="primary" onClick={downloadTtl} className={"mx-1"}>
            Save&nbsp;TTL
          </Button>
        </Col>
      </Row>
      <Row className="mt-2"></Row>
    </Container>
  );
};

export default DiagramPersistence;
