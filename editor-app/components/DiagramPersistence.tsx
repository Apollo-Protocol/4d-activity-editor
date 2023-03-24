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

import { saveFile, loadFile } from "./save_load";

const DiagramPersistence = (props: any) => {
  const { dataset, setDataset, svgRef, setDirty } = props;
  const [uploadText, setUploadText] = useState("");
  const [refDataOnly, setRefDataOnly] = useState(false);

  function downloadTtl() {
    if (refDataOnly) {
      saveFile(saveRefDataAsTTL(dataset), 
        dataset.filename.replace(/(\.[^.]*)?$/, "_ref_data$&"),
        "text/turtle");
    }
    else {
      saveFile(save(dataset), dataset.filename, "text/turtle");
      setDirty(false);
    }
  }

  function uploadTtl() {
    loadFile("text/turtle,.ttl")
      .then((f: File) => Promise.all([f.name, f.text()]))
      .then(([name, ttl]: [string, string]) => {
        if (refDataOnly) {
          const loadedModel = loadRefDataFromTTL(ttl);
          setDataset(loadedModel);
        } else {
          const loadedModel = load(ttl);
          loadedModel.filename = name;
          setDataset(loadedModel);
        }
        setDirty(false);
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
