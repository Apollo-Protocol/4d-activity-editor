import { useEffect, useState } from "react";
import { Button, Container, Form } from "react-bootstrap";
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

import {
  save,
  load,
  saveRefDataAsTTL,
  loadRefDataFromTTL,
} from "lib/ActivityLib";

import { saveFile, loadFile } from "./save_load";

interface Example {
  name: string;
  path: string;
}

const DiagramPersistence = (props: any) => {
  const { dataset, setDataset, svgRef, setDirty } = props;
  const [uploadText, setUploadText] = useState("");
  const [refDataOnly, setRefDataOnly] = useState(false);
  const [examples, setExamples] = useState<Example[]>([]);

  useEffect(() => {
    fetch("/examples/index.json")
      .then(res => {
        if (!res.ok) {
          console.log(`Fetching examples index failed: ${res.status}`);
          return;
        }
        return res.json();
      })
      .then(json => {
        setExamples(json);
      });
  }, []);

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

  async function loadExample(path: string) {
    const res = await fetch(path);
    if (!res.ok) return;
    const ttl = await res.text();
    const model = load(ttl);
    setDataset(model);
  }

  return (
    <Container>
      <Row>
        <Col
          md={12}
          lg={6}
          className="mt-2 d-flex align-items-start justify-content-center justify-content-lg-start"
        >
          <DropdownButton title="Load example">
            {examples.map(e => 
              <Dropdown.Item key={e.path} onClick={() => loadExample(e.path)}>
                {e.name}
              </Dropdown.Item>)}
          </DropdownButton>
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
