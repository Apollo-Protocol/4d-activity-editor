import React, { Dispatch, SetStateAction, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

import { ConfigData } from "@/diagram/config";

import { saveFile, loadFile } from "./save_load";

const _ = require("lodash");

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
        const loadedConfig = JSON.parse(json);
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
    setInputs(configData);
  };
  const handleAdd = (event: any) => {
    event.preventDefault();
    setConfigData(inputs);
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
            <Row>
              <Col xs={6} lg={3}>
                <h4>Activities</h4>
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
                <Form.Group className="mb-2" controlId="formActivityOpacity">
                  <Form.Label>Opacity</Form.Label>
                  <Form.Control
                    type="text"
                    name="presentation.activity.opacity"
                    value={inputs?.presentation?.activity?.opacity}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formActivityOpacityHover"
                >
                  <Form.Label>Opacity on Hover</Form.Label>
                  <Form.Control
                    type="text"
                    name="presentation.activity.opacityHover"
                    value={inputs?.presentation?.activity?.opacityHover}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
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
                <Form.Group
                  className="mb-2"
                  controlId="formActivityStrokeWidth"
                >
                  <Form.Label>Border Width</Form.Label>
                  <Form.Control
                    type="text"
                    name="presentation.activity.strokeWidth"
                    value={inputs?.presentation?.activity?.strokeWidth}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formActivityStrokeDasharray"
                >
                  <Form.Label>Border DashArray</Form.Label>
                  <Form.Control
                    type="text"
                    name="presentation.activity.strokeDasharray"
                    value={inputs?.presentation?.activity?.strokeDasharray}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formLabelsActivityFontsize"
                >
                  <Form.Label>Font Size</Form.Label>
                  <Form.Control
                    type="text"
                    name="labels.activity.fontSize"
                    value={inputs?.labels?.activity?.fontSize}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formLabelsActivityMaxChars"
                >
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
              <Col xs={6} lg={3}>
                <h4>Participations</h4>
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
                <Form.Group
                  className="mb-2"
                  controlId="formParticipationsOpacity"
                >
                  <Form.Label>Opacity</Form.Label>
                  <Form.Control
                    type="text"
                    name="presentation.participation.opacity"
                    value={inputs?.presentation?.participation?.opacity}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formParticipationsOpacityHover"
                >
                  <Form.Label>Opacity on Hover</Form.Label>
                  <Form.Control
                    type="text"
                    name="presentation.participation.opacityHover"
                    value={inputs?.presentation?.participation?.opacityHover}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formParticipationsStroke"
                >
                  <Form.Label>Border Colour</Form.Label>
                  <Form.Control
                    type="text"
                    name="presentation.participation.stroke"
                    value={inputs?.presentation?.participation?.stroke}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formParticipationsStrokeWidth"
                >
                  <Form.Label>Border Width</Form.Label>
                  <Form.Control
                    type="text"
                    name="presentation.participation.strokeWidth"
                    value={inputs?.presentation?.participation?.strokeWidth}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formParticipationsStrokeDasharray"
                >
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
              <Col xs={6} lg={3}>
                <h4>Individuals</h4>
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
                <Form.Group className="mb-2" controlId="formIndividualFill">
                  <Form.Label>Fill Hover Colour</Form.Label>
                  <Form.Control
                    type="text"
                    name="presentation.individual.fillHover"
                    value={inputs?.presentation?.individual?.fillHover}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
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
                <Form.Group
                  className="mb-2"
                  controlId="formIndividualStrokeWidth"
                >
                  <Form.Label>Border Width</Form.Label>
                  <Form.Control
                    type="text"
                    name="presentation.individual.strokeWidth"
                    value={inputs?.presentation?.individual?.strokeWidth}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formLabelsIndividualFontsize"
                >
                  <Form.Label>Font Size</Form.Label>
                  <Form.Control
                    type="text"
                    name="labels.individual.fontSize"
                    value={inputs?.labels?.individual?.fontSize}
                    onChange={handleChangeString}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formLabelsIndividualMaxChars"
                >
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
              <Col xs={6} lg={3}>
                <h4>Labels</h4>
                <Form.Group
                  className="mb-2"
                  controlId="formIndividualLabelsSwitch"
                >
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
                <hr />
                <h4>Zoom</h4>
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
                <hr />
                <h4>Individual Layout</h4>
                <Form.Group
                  className="mb-2"
                  controlId="formLayoutIndividualHeight"
                >
                  <Form.Label>Height</Form.Label>
                  <Form.Control
                    type="number"
                    name="layout.individual.height"
                    value={inputs?.layout?.individual?.height}
                    onChange={handleChangeNumber}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formLayoutIndividualHeight"
                >
                  <Form.Label>Gap</Form.Label>
                  <Form.Control
                    type="number"
                    name="layout.individual.gap"
                    value={inputs?.layout?.individual?.gap}
                    onChange={handleChangeNumber}
                    className="form-control"
                  />
                </Form.Group>
                <Form.Group
                  className="mb-2"
                  controlId="formLayoutIndividualHeight"
                >
                  <Form.Label>Text Area</Form.Label>
                  <Form.Control
                    type="number"
                    name="layout.individual.textLength"
                    value={inputs?.layout?.individual?.textLength}
                    onChange={handleChangeNumber}
                    className="form-control"
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          {uploadError}
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
