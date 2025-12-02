import { useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import DropdownButton from "react-bootstrap/DropdownButton";

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
    fetch("examples/index.json")
      .then((res) => {
        if (!res.ok) {
          console.log(`Fetching examples index failed: ${res.status}`);
          return;
        }
        return res.json();
      })
      .then((json) => {
        setExamples(json);
      });
  }, []);

  function downloadTtl() {
    if (refDataOnly) {
      saveFile(
        saveRefDataAsTTL(dataset),
        dataset.filename.replace(/(\.[^.]*)?$/, "_ref_data$&"),
        "text/turtle"
      );
    } else {
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
          if (loadedModel instanceof Error) {
            throw loadedModel;
          }
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
    <div className="d-flex flex-wrap align-items-center justify-content-center gap-2">
      {/* Load Example dropdown */}
      <DropdownButton variant="primary" title="Load example">
        {examples.map((e) => (
          <Dropdown.Item key={e.path} onClick={() => loadExample(e.path)}>
            {e.name}
          </Dropdown.Item>
        ))}
      </DropdownButton>

      {/* TTL Load/Save buttons */}
      <Button variant="primary" onClick={uploadTtl}>
        Load TTL
      </Button>
      <Button variant="primary" onClick={downloadTtl}>
        Save TTL
      </Button>

      {/* Reference Types Only toggle */}
      <div
        className="d-flex align-items-center px-2 py-1 border rounded border-primary"
        style={{
          backgroundColor: refDataOnly ? "#e8f4fd" : "#f8f9fa",
          border: refDataOnly ? "1px solid #0d6efd" : "1px solid #dee2e6",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onClick={() => setRefDataOnly(!refDataOnly)}
      >
        <Form.Check
          type="checkbox"
          id="refDataOnlyCheck"
          checked={refDataOnly}
          onChange={() => setRefDataOnly(!refDataOnly)}
          style={{ marginRight: "6px" }}
        />
        <label
          htmlFor="refDataOnlyCheck"
          style={{
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: refDataOnly ? 500 : 400,
            color: refDataOnly ? "#0d6efd" : "#6c757d",
            marginBottom: 0,
            whiteSpace: "nowrap",
          }}
        >
          Reference Types only
        </label>
      </div>

      {/* Error message if any */}
      {uploadText && <span className="text-danger small">{uploadText}</span>}
    </div>
  );
};

export default DiagramPersistence;
