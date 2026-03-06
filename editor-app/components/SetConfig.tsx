import React, { Dispatch, SetStateAction, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";

import { config, ConfigData } from "@/diagram/config";

import { saveFile, loadFile } from "./save_load";

const _ = require("lodash");

const normalizeConfigData = (storedConfig: Partial<ConfigData>): ConfigData => ({
  ...config,
  ...storedConfig,
  viewPort: {
    ...config.viewPort,
    ...storedConfig.viewPort,
  },
  layout: {
    ...config.layout,
    ...storedConfig.layout,
    individual: {
      ...config.layout.individual,
      ...storedConfig.layout?.individual,
    },
    system: {
      ...config.layout.system,
      ...storedConfig.layout?.system,
    },
  },
  presentation: {
    ...config.presentation,
    ...storedConfig.presentation,
    individual: {
      ...config.presentation.individual,
      ...storedConfig.presentation?.individual,
    },
    activity: {
      ...config.presentation.activity,
      ...storedConfig.presentation?.activity,
    },
    participation: {
      ...config.presentation.participation,
      ...storedConfig.presentation?.participation,
    },
    axis: {
      ...config.presentation.axis,
      ...storedConfig.presentation?.axis,
    },
  },
  labels: {
    ...config.labels,
    ...storedConfig.labels,
    individual: {
      ...config.labels.individual,
      ...storedConfig.labels?.individual,
    },
    activity: {
      ...config.labels.activity,
      ...storedConfig.labels?.activity,
    },
  },
});

interface Props {
  configData: ConfigData;
  setConfigData: Dispatch<SetStateAction<ConfigData>>;
  showConfigModal: boolean;
  setShowConfigModal: Dispatch<SetStateAction<boolean>>;
}

const SetConfig = (props: Props) => {
  const { configData, setConfigData, showConfigModal, setShowConfigModal } =
    props;

  const [inputs, setInputs] = useState(configData);
  const [uploadError, setUploadError] = useState("");

  function downloadConfig() {
    saveFile(JSON.stringify(inputs),
      "activity_diagram_settings.json", "application/json");
  }

  function uploadConfig() {
    loadFile("application/json,.json")
      .then((f: File) => f.text())
      .then((json: string) => {
        const loadedConfig = normalizeConfigData(JSON.parse(json));
        setInputs(loadedConfig);
        setUploadError("");
      })
      .catch((e: any) => {
        setUploadError(
          "Failed to upload. Choose another file to try again."
        );
        console.error(e);
      });
  }

  const handleClose = () => {
    setShowConfigModal(false);
  };
  const handleShow = () => {
    setInputs(normalizeConfigData(configData));
  };
  const handleAdd = (event: any) => {
    event.preventDefault();
    setConfigData(inputs);
    handleClose();
  };
  const handleReset = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("activity-editor-config");
    }
    // Deep copy to ensure fresh object references for React state
    const defaultConfig = JSON.parse(JSON.stringify(config));
    setConfigData(defaultConfig);
    setInputs(defaultConfig);
    handleClose();
  };

  const handleChangeString = (e: any) => {
    let localInputs = { ...inputs };
    _.set(localInputs, e.target.name, e.target.value);
    setInputs(localInputs);
  };

  const handleChangeArray = (e: any) => {
    let localInputs = { ...inputs };
    _.set(localInputs, e.target.name, _.split(e.target.value, ","));
    console.log(localInputs);
    setInputs(localInputs);
  };

  const handleChangeNumber = (e: any) => {
    let localInputs = { ...inputs };
    _.set(localInputs, e.target.name, Number(e.target.value));
    setInputs(localInputs);
  };

  const handleChangeBoolean = (e: any) => {
    let localInputs = { ...inputs };
    _.set(localInputs, e.target.name, e.target.checked);
    setInputs(localInputs);
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setShowConfigModal(true)}
        className="mx-1"
      >
        Settings
      </Button>

      <Modal
        show={showConfigModal}
        onHide={handleClose}
        onShow={handleShow}
        size="xl"
      >
        <Modal.Header closeButton>
          <Modal.Title>Diagram Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAdd}>
            <Tabs defaultActiveKey="presentation" id="settings-tabs" className="mb-4" justify>
              <Tab eventKey="presentation" title="Presentation Styles">
                <Row className="mt-3">
                  <Col xs={12} lg={4}>
                    <h5 className="mb-3">Activities</h5>
                    <Row>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formActivityFill">
                          <Form.Label>Fill Colour List</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.activity.fill"
                            value={inputs?.presentation?.activity?.fill}
                            onChange={handleChangeArray}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formActivityStroke">
                          <Form.Label>Border Colour List</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.activity.stroke"
                            value={inputs?.presentation?.activity?.stroke}
                            onChange={handleChangeArray}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formActivityOpacity">
                          <Form.Label>Opacity</Form.Label>
                          <Form.Control
                            type="number"
                            name="presentation.activity.opacity"
                            value={inputs?.presentation?.activity?.opacity}
                            onChange={handleChangeNumber}
                            className="form-control"
                            min="0" max="1" step="0.1"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formActivityOpacityHover">
                          <Form.Label>Opacity on Hover</Form.Label>
                          <Form.Control
                            type="number"
                            name="presentation.activity.opacityHover"
                            value={inputs?.presentation?.activity?.opacityHover}
                            onChange={handleChangeNumber}
                            className="form-control"
                            min="0" max="1" step="0.1"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formActivityStrokeWidth">
                          <Form.Label>Border Width</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.activity.strokeWidth"
                            value={inputs?.presentation?.activity?.strokeWidth}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formActivityStrokeDasharray">
                          <Form.Label>Border DashArray</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.activity.strokeDasharray"
                            value={inputs?.presentation?.activity?.strokeDasharray}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formLabelsActivityFontsize">
                          <Form.Label>Font Size</Form.Label>
                          <Form.Control
                            type="text"
                            name="labels.activity.fontSize"
                            value={inputs?.labels?.activity?.fontSize}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formLabelsActivityMaxChars">
                          <Form.Label>Max Label Characters</Form.Label>
                          <Form.Control
                            type="text"
                            name="labels.activity.maxChars"
                            value={inputs?.labels?.activity?.maxChars}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </Col>
                  <Col xs={12} lg={4}>
                    <h5 className="mb-3">Participations</h5>
                    <Row>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formParticipationsFill">
                          <Form.Label>Fill Colour</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.participation.fill"
                            value={inputs?.presentation?.participation?.fill}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formParticipationsStroke">
                          <Form.Label>Border Colour</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.participation.stroke"
                            value={inputs?.presentation?.participation?.stroke}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formParticipationsOpacity">
                          <Form.Label>Opacity</Form.Label>
                          <Form.Control
                            type="number"
                            name="presentation.participation.opacity"
                            value={inputs?.presentation?.participation?.opacity}
                            onChange={handleChangeNumber}
                            className="form-control"
                            min="0" max="1" step="0.1"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formParticipationsOpacityHover">
                          <Form.Label>Opacity on Hover</Form.Label>
                          <Form.Control
                            type="number"
                            name="presentation.participation.opacityHover"
                            value={inputs?.presentation?.participation?.opacityHover}
                            onChange={handleChangeNumber}
                            className="form-control"
                            min="0" max="1" step="0.1"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formParticipationsStrokeWidth">
                          <Form.Label>Border Width</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.participation.strokeWidth"
                            value={inputs?.presentation?.participation?.strokeWidth}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formParticipationsStrokeDasharray">
                          <Form.Label>Border DashArray</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.participation.strokeDasharray"
                            value={inputs?.presentation?.participation?.strokeDasharray}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </Col>
                  <Col xs={12} lg={4}>
                    <h5 className="mb-3">Individuals</h5>
                    <Row>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formIndividualFill">
                          <Form.Label>Fill Colour</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.individual.fill"
                            value={inputs?.presentation?.individual?.fill}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formIndividualFillHover">
                          <Form.Label>Fill Hover Colour</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.individual.fillHover"
                            value={inputs?.presentation?.individual?.fillHover}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formIndividualStroke">
                          <Form.Label>Border Colour</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.individual.stroke"
                            value={inputs?.presentation?.individual?.stroke}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formIndividualStrokeWidth">
                          <Form.Label>Border Width</Form.Label>
                          <Form.Control
                            type="text"
                            name="presentation.individual.strokeWidth"
                            value={inputs?.presentation?.individual?.strokeWidth}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formLabelsIndividualFontsize">
                          <Form.Label>Font Size</Form.Label>
                          <Form.Control
                            type="text"
                            name="labels.individual.fontSize"
                            value={inputs?.labels?.individual?.fontSize}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formLabelsIndividualMaxChars">
                          <Form.Label>Max Label Characters</Form.Label>
                          <Form.Control
                            type="text"
                            name="labels.individual.maxChars"
                            value={inputs?.labels?.individual?.maxChars}
                            onChange={handleChangeString}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </Tab>
              
              <Tab eventKey="layout" title="Layout & Configuration">
                <Row className="mt-3">
                  <Col xs={12} lg={3}>
                    <h5 className="mb-3">Zoom &amp; Timeline</h5>
                    <Form.Group className="mb-2" controlId="formViewPortZoom">
                      <Form.Label>Time Axis</Form.Label>
                      <Form.Control
                        type="number"
                        name="viewPort.zoom"
                        step="0.1"
                        min="1"
                        max="5"
                        value={inputs?.viewPort?.zoom}
                        onChange={handleChangeNumber}
                        className="form-control"
                      />
                    </Form.Group>
                    <Form.Group className="mb-2" controlId="formViewPortMinSpan">
                      <Form.Label>Minimum Timeline Span</Form.Label>
                      <Form.Control
                        type="number"
                        name="viewPort.minTimelineSpan"
                        step="1"
                        min="11"
                        max="100"
                        value={inputs?.viewPort?.minTimelineSpan}
                        onChange={handleChangeNumber}
                        className="form-control"
                      />
                    </Form.Group>
                    <Form.Group className="mb-2" controlId="formViewPortTimelineBuffer">
                      <Form.Label>Timeline Buffer (%)</Form.Label>
                      <Form.Control
                        type="number"
                        name="viewPort.timelineBuffer"
                        step="0.5"
                        min="0"
                        max="50"
                        value={inputs?.viewPort?.timelineBuffer}
                        onChange={handleChangeNumber}
                        className="form-control"
                      />
                    </Form.Group>
                    <h5 className="mb-3 mt-4">Labels</h5>
                    <Form.Group className="mb-4" controlId="formIndividualLabelsSwitch">
                      <Form.Label>Enable for</Form.Label>
                      <Form.Check
                        type="switch"
                        name="labels.individual.enabled"
                        label="Individuals"
                        checked={
                          inputs && inputs.labels
                            ? inputs.labels.individual.enabled
                            : false
                        }
                        onChange={handleChangeBoolean}
                      />
                      <Form.Check
                        type="switch"
                        name="labels.activity.enabled"
                        label="Activity"
                        checked={
                          inputs && inputs.labels
                            ? inputs.labels.activity.enabled
                            : false
                        }
                        onChange={handleChangeBoolean}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12} lg={3}>
                    <h5 className="mb-3">Individual Layout</h5>
                    <Form.Group className="mb-2" controlId="formLayoutIndividualHeight">
                      <Form.Label>Height</Form.Label>
                      <Form.Control
                        type="number"
                        name="layout.individual.height"
                        value={inputs?.layout?.individual?.height}
                        onChange={handleChangeNumber}
                        className="form-control"
                      />
                    </Form.Group>
                    <Form.Group className="mb-2" controlId="formLayoutIndividualGap">
                      <Form.Label>Gap</Form.Label>
                      <Form.Control
                        type="number"
                        name="layout.individual.gap"
                        value={inputs?.layout?.individual?.gap}
                        onChange={handleChangeNumber}
                        className="form-control"
                      />
                    </Form.Group>
                    <Form.Group className="mb-2" controlId="formLayoutIndividualTextLength">
                      <Form.Label>Text Area</Form.Label>
                      <Form.Control
                        type="number"
                        name="layout.individual.textLength"
                        value={inputs?.layout?.individual?.textLength}
                        onChange={handleChangeNumber}
                        className="form-control"
                      />
                    </Form.Group>
                    <Form.Group className="mb-2" controlId="formLayoutIndividualOpenEndPadding">
                      <Form.Label>System Highlight Open-End Padding</Form.Label>
                      <Form.Control
                        type="number"
                        name="layout.individual.openEndAlignmentPadding"
                        min="0"
                        max="50"
                        value={inputs?.layout?.individual?.openEndAlignmentPadding}
                        onChange={handleChangeNumber}
                        className="form-control"
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12} lg={6}>
                    <h5 className="mb-3">System Layout</h5>
                    <Row>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formLayoutSystemInset">
                          <Form.Label>Container Inset</Form.Label>
                          <Form.Control
                            type="number"
                            name="layout.system.containerInset"
                            value={inputs?.layout?.system?.containerInset}
                            onChange={handleChangeNumber}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formLayoutSystemHInset">
                          <Form.Label>Horizontal Inset</Form.Label>
                          <Form.Control
                            type="number"
                            name="layout.system.horizontalInset"
                            value={inputs?.layout?.system?.horizontalInset}
                            onChange={handleChangeNumber}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formLayoutSystemGap">
                          <Form.Label>Component Gap</Form.Label>
                          <Form.Control
                            type="number"
                            name="layout.system.componentGap"
                            value={inputs?.layout?.system?.componentGap}
                            onChange={handleChangeNumber}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formLayoutSystemCompFactor">
                          <Form.Label>Component Height Factor</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.1"
                            name="layout.system.componentHeightFactor"
                            value={inputs?.layout?.system?.componentHeightFactor}
                            onChange={handleChangeNumber}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formLayoutSystemHostFactor">
                          <Form.Label>Min Host Height Factor</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.1"
                            name="layout.system.minHostHeightFactor"
                            value={inputs?.layout?.system?.minHostHeightFactor}
                            onChange={handleChangeNumber}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                      <Col xs={6}>
                        <Form.Group className="mb-2" controlId="formLayoutSystemHostGrowth">
                          <Form.Label>Host Height Growth Per Component</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.1"
                            name="layout.system.hostHeightGrowthPerComponent"
                            value={inputs?.layout?.system?.hostHeightGrowthPerComponent}
                            onChange={handleChangeNumber}
                            className="form-control"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </Tab>
            </Tabs>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          {uploadError}
          <Button variant="danger" onClick={handleReset} className="me-auto">
            Reset Defaults
          </Button>
          <Button variant="primary" onClick={uploadConfig}>
            Load Settings
          </Button>
          <Button variant="primary" onClick={downloadConfig}>
            Save Settings
          </Button>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handleAdd}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SetConfig;
