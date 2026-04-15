import { useEffect, useRef, useState } from "react";
import { Button, Form } from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";

import {
  save,
  load,
  saveRefDataAsTTL,
  loadRefDataFromTTL,
} from "lib/ActivityLib";

import { saveFile, loadFile } from "@/helpers/saveLoad";

interface Example {
  name: string;
  path: string;
}

interface Props {
  dataset: any;
  setDataset: (dataset: any) => void;
  svgRef: any;
  setDirty: (dirty: boolean) => void;
  showSaveButton?: boolean;
  showReferenceToggle?: boolean;
  className?: string;
  buttonVariant?: string;
}

const DiagramPersistence = (props: Props) => {
  const {
    dataset,
    setDataset,
    svgRef,
    setDirty,
    showSaveButton = true,
    showReferenceToggle = true,
    className = "",
    buttonVariant = "primary",
  } = props;
  const [uploadText, setUploadText] = useState("");
  const [refDataOnly, setRefDataOnly] = useState(false);
  const [examples, setExamples] = useState<Example[]>([]);
  const [showMobileExampleMenu, setShowMobileExampleMenu] = useState(false);
  const mobileExampleMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("examples/index.json")
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

  useEffect(() => {
    function handleOutsidePointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!mobileExampleMenuRef.current || !target) {
        return;
      }
      if (!mobileExampleMenuRef.current.contains(target)) {
        setShowMobileExampleMenu(false);
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowMobileExampleMenu(false);
      }
    }

    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("touchstart", handleOutsidePointer);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("touchstart", handleOutsidePointer);
      document.removeEventListener("keydown", handleEsc);
    };
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
    setShowMobileExampleMenu(false);
  }

  return (
    <div className={`d-flex flex-wrap align-items-center justify-content-center gap-2 mobile-contents ${className}`.trim()}>
      {/* Load Example dropdown */}
      <Dropdown className="toolbar-dropdown load-example-dropdown load-example-desktop-dropdown d-none d-lg-flex" align="start">
        <Dropdown.Toggle
          id="load-example-toggle"
          variant={buttonVariant}
          className="toolbar-dropdown-toggle load-example-dropdown-toggle"
        >
          Load example
        </Dropdown.Toggle>
        <Dropdown.Menu renderOnMount>
          {examples.map((e) => (
            <Dropdown.Item key={e.path} onClick={() => loadExample(e.path)}>
              {e.name}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>

      <div
        ref={mobileExampleMenuRef}
        className="toolbar-dropdown load-example-dropdown load-example-mobile-dropdown d-flex d-lg-none"
      >
        <button
          id="load-example-toggle-mobile"
          type="button"
          className={`btn btn-${buttonVariant} load-example-mobile-toggle`}
          onClick={() => setShowMobileExampleMenu((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={showMobileExampleMenu}
        >
          <span className="load-example-mobile-label">Load example</span>
          <span className="load-example-mobile-caret" aria-hidden="true" />
        </button>
        <div
          className={`dropdown-menu load-example-mobile-menu ${showMobileExampleMenu ? "show" : ""}`.trim()}
          role="menu"
          aria-labelledby="load-example-toggle-mobile"
        >
          {examples.map((e) => (
            <button
              key={e.path}
              type="button"
              className="dropdown-item"
              onClick={() => {
                loadExample(e.path);
              }}
            >
              {e.name}
            </button>
          ))}
        </div>
      </div>

      {/* TTL Load/Save buttons */}
      <Button variant={buttonVariant} onClick={uploadTtl}>
        Load TTL
      </Button>
      {showSaveButton ? (
        <Button variant={buttonVariant} onClick={downloadTtl}>
          Save TTL
        </Button>
      ) : null}

      {/* Reference Types Only toggle */}
      {showReferenceToggle ? (
        <button
          type="button"
          className={`btn btn-${buttonVariant} d-inline-flex align-items-center reference-toggle`}
          style={{
            lineHeight: 1.5,
            padding: "0.375rem 0.75rem",
          }}
          onClick={() => setRefDataOnly(!refDataOnly)}
        >
          <Form.Check
            type="checkbox"
            id="refDataOnlyCheck"
            checked={refDataOnly}
            onChange={() => setRefDataOnly(!refDataOnly)}
            className="reference-toggle__check"
            style={{
              margin: 0,
              marginRight: "0.35rem",
            }}
          />
          <span
            className="reference-toggle__label"
            style={{
              fontWeight: 400,
            }}
          >
            Reference Types only
          </span>
        </button>
      ) : null}

      {/* Error message if any */}
      {uploadText && <span className="text-danger small">{uploadText}</span>}
    </div>
  );
};

export default DiagramPersistence;
