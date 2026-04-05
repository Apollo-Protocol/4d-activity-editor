import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";
import DraggableModalDialog, { shouldSuppressModalHide } from "@/components/DraggableModalDialog";
import { useModalAnimation } from "@/utils/useModalAnimation";

import { config, ConfigData } from "@/diagram/config";

import { saveFile, loadFile } from "./save_load";

const _ = require("lodash");

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const COLOR_FIELD_GROUPS = [
  {
    label: "Individuals",
    options: [
      {
        label: "Individual Border",
        path: "presentation.individual.stroke",
        kind: "single",
      },
      {
        label: "Individual Fill",
        path: "presentation.individual.fill",
        kind: "single",
      },
      {
        label: "Individual Fill Hover",
        path: "presentation.individual.fillHover",
        kind: "single",
      },
      {
        label: "Individual Label Color",
        path: "labels.individual.color",
        kind: "single",
      },
    ],
  },
  {
    label: "Activities",
    options: [
      {
        label: "Activity Borders",
        path: "presentation.activity.stroke",
        kind: "array",
      },
      {
        label: "Activity Fills",
        path: "presentation.activity.fill",
        kind: "array",
      },
      {
        label: "Activity Label Color",
        path: "labels.activity.color",
        kind: "single",
      },
    ],
  },
  {
    label: "Participations",
    options: [
      {
        label: "Participation Border",
        path: "presentation.participation.stroke",
        kind: "single",
      },
      {
        label: "Participation Fill",
        path: "presentation.participation.fill",
        kind: "single",
      },
    ],
  },
  {
    label: "Axis",
    options: [
      {
        label: "Axis Color",
        path: "presentation.axis.colour",
        kind: "single",
      },
    ],
  },
] as const;

type ColorFieldOption = (typeof COLOR_FIELD_GROUPS)[number]["options"][number];
type ColorFieldPath = ColorFieldOption["path"];
const COLOR_FIELD_OPTIONS: ColorFieldOption[] = [];

for (const group of COLOR_FIELD_GROUPS) {
  for (const option of group.options) {
    COLOR_FIELD_OPTIONS.push(option as ColorFieldOption);
  }
}

const CSS_VAR_PATTERN = /^var\(\s*(--[^,\s)]+)\s*,\s*(.+)\s*\)$/;

function resolveCssValue(value: string): string {
  const match = value.match(CSS_VAR_PATTERN);
  if (!match) return value;

  const [, variableName, fallback] = match;
  if (typeof window === "undefined") {
    return fallback.trim();
  }

  const computed = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();

  return computed || fallback.trim();
}

function resolveConfigDataForForm(source: ConfigData): ConfigData {
  return {
    ...source,
    presentation: {
      ...source.presentation,
      individual: {
        ...source.presentation.individual,
        stroke: resolveCssValue(source.presentation.individual.stroke),
        fill: resolveCssValue(source.presentation.individual.fill),
        fillHover: resolveCssValue(source.presentation.individual.fillHover),
      },
      activity: {
        ...source.presentation.activity,
        stroke: source.presentation.activity.stroke.map((value) => resolveCssValue(value)),
        fill: source.presentation.activity.fill.map((value) => resolveCssValue(value)),
        opacity: resolveCssValue(source.presentation.activity.opacity),
        opacityHover: resolveCssValue(source.presentation.activity.opacityHover),
      },
      participation: {
        ...source.presentation.participation,
        stroke: resolveCssValue(source.presentation.participation.stroke),
        fill: resolveCssValue(source.presentation.participation.fill),
        opacity: resolveCssValue(source.presentation.participation.opacity),
        opacityHover: resolveCssValue(source.presentation.participation.opacityHover),
      },
      axis: {
        ...source.presentation.axis,
        colour: resolveCssValue(source.presentation.axis.colour),
      },
    },
    labels: {
      ...source.labels,
      individual: {
        ...source.labels.individual,
        color: resolveCssValue(source.labels.individual.color),
      },
      activity: {
        ...source.labels.activity,
        color: resolveCssValue(source.labels.activity.color),
      },
    },
  };
}

function normalizePickerHex(color: string): string {
  if (HEX_COLOR_PATTERN.test(color)) {
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
    }
    return color.toLowerCase();
  }

  if (typeof window === "undefined") {
    return "#000000";
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return "#000000";
  }

  context.fillStyle = "#000000";
  context.fillStyle = color;
  const normalizedColor = context.fillStyle;

  if (HEX_COLOR_PATTERN.test(normalizedColor)) {
    if (normalizedColor.length === 4) {
      return `#${normalizedColor[1]}${normalizedColor[1]}${normalizedColor[2]}${normalizedColor[2]}${normalizedColor[3]}${normalizedColor[3]}`.toLowerCase();
    }
    return normalizedColor.toLowerCase();
  }

  const rgbMatch = normalizedColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgbMatch) {
    const toHex = (channel: string) => Number(channel).toString(16).padStart(2, "0");
    return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
  }

  return "#000000";
}

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
  const modalAnim = useModalAnimation();
  const [selectedColorPath, setSelectedColorPath] = useState<ColorFieldPath>(
    COLOR_FIELD_OPTIONS[0].path
  );
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [hexInputValue, setHexInputValue] = useState("#000000");

  const selectedColorTarget: ColorFieldOption =
    COLOR_FIELD_OPTIONS.find((option) => option.path === selectedColorPath) ||
    COLOR_FIELD_OPTIONS[0];

  const selectedColorArray =
    selectedColorTarget.kind === "array"
      ? ((_.get(inputs, selectedColorTarget.path, []) as string[]) || [])
      : [];

  const activeColorIndex =
    selectedColorTarget.kind === "array"
      ? Math.max(0, Math.min(selectedColorIndex, Math.max(selectedColorArray.length - 1, 0)))
      : 0;

  const selectedColorRaw =
    selectedColorTarget.kind === "array"
      ? selectedColorArray[activeColorIndex] || "#000000"
      : (_.get(inputs, selectedColorTarget.path, "#000000") as string);

  const selectedColorValue = normalizePickerHex(selectedColorRaw);

  useEffect(() => {
    setHexInputValue(selectedColorValue);
  }, [selectedColorValue]);

  function downloadConfig() {
    saveFile(JSON.stringify(inputs),
      "activity_diagram_settings.json", "application/json");
  }

  function uploadConfig() {
    loadFile("application/json,.json")
      .then((f: File) => f.text())
      .then((json: string) => {
        const loadedConfig = resolveConfigDataForForm(
          normalizeConfigData(JSON.parse(json))
        );
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
  const handleModalHide = () => {
    if (shouldSuppressModalHide()) return;
    handleClose();
  };
  const handleShow = () => {
    setInputs(resolveConfigDataForForm(normalizeConfigData(configData)));
    setSelectedColorPath(COLOR_FIELD_OPTIONS[0].path);
    setSelectedColorIndex(0);
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
    setInputs(resolveConfigDataForForm(defaultConfig));
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

  const handleColorPickerChange = (e: any) => {
    const selectedColor = e.target.value;
    let localInputs = { ...inputs };

    if (selectedColorTarget.kind === "array") {
      const localArray = [...selectedColorArray];
      if (localArray.length === 0) {
        localArray.push(selectedColor);
        setSelectedColorIndex(0);
      } else {
        localArray[activeColorIndex] = selectedColor;
      }
      _.set(localInputs, selectedColorTarget.path, localArray);
    } else {
      _.set(localInputs, selectedColorTarget.path, selectedColor);
    }

    setInputs(localInputs);
    setHexInputValue(selectedColor);
  };

  const handleHexInputChange = (e: any) => {
    const nextHex = e.target.value;
    setHexInputValue(nextHex);

    if (!HEX_COLOR_PATTERN.test(nextHex)) {
      return;
    }

    const normalizedHex = normalizePickerHex(nextHex);
    let localInputs = { ...inputs };

    if (selectedColorTarget.kind === "array") {
      const localArray = [...selectedColorArray];
      if (localArray.length === 0) {
        localArray.push(normalizedHex);
        setSelectedColorIndex(0);
      } else {
        localArray[activeColorIndex] = normalizedHex;
      }
      _.set(localInputs, selectedColorTarget.path, localArray);
    } else {
      _.set(localInputs, selectedColorTarget.path, normalizedHex);
    }

    setInputs(localInputs);
  };

  const handleAddColorToArray = () => {
    if (selectedColorTarget.kind !== "array") return;
    let localInputs = { ...inputs };
    const localArray = [...selectedColorArray, selectedColorValue];
    _.set(localInputs, selectedColorTarget.path, localArray);
    setInputs(localInputs);
    setSelectedColorIndex(localArray.length - 1);
  };

  const handleRemoveColorFromArray = () => {
    if (selectedColorTarget.kind !== "array" || selectedColorArray.length === 0) {
      return;
    }

    let localInputs = { ...inputs };
    const localArray = selectedColorArray.filter((_, index) => index !== activeColorIndex);
    const nextArray = localArray.length ? localArray : ["#000000"];

    _.set(localInputs, selectedColorTarget.path, nextArray);
    setInputs(localInputs);
    setSelectedColorIndex(Math.max(0, Math.min(activeColorIndex, nextArray.length - 1)));
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
        dialogAs={DraggableModalDialog}
        className={modalAnim.className}
        show={showConfigModal}
        onHide={handleModalHide}
        onShow={handleShow}
        size="xl"
      >
        {modalAnim.sketchSvg}
        <Modal.Header closeButton>
          <Modal.Title>Diagram Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAdd}>
            <Tabs defaultActiveKey="presentation" id="settings-tabs" className="mb-4" justify>
              <Tab eventKey="presentation" title="Presentation Styles">
                <Row className="mt-3 mb-3">
                  <Col xs={12}>
                    <h5 className="mb-3">Color Editor</h5>
                    <Row className="align-items-end">
                      <Col xs={12} lg={4}>
                        <Form.Group className="mb-2" controlId="formColorTarget">
                          <Form.Label>Field</Form.Label>
                          <Form.Select
                            value={selectedColorPath}
                            onChange={(e) => {
                              setSelectedColorPath(e.target.value as ColorFieldPath);
                              setSelectedColorIndex(0);
                            }}
                            className="form-control"
                          >
                            {COLOR_FIELD_GROUPS.map((group) => (
                              <optgroup key={group.label} label={group.label}>
                                {group.options.map((option) => (
                                  <option key={option.path} value={option.path}>
                                    {option.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      {selectedColorTarget.kind === "array" && (
                        <Col xs={12} lg={4}>
                          <Form.Group className="mb-2" controlId="formColorTargetIndex">
                            <Form.Label>Color Slot</Form.Label>
                            <div className="d-flex gap-2 align-items-center">
                              <Form.Select
                                value={activeColorIndex}
                                onChange={(e) => setSelectedColorIndex(Number(e.target.value))}
                                className="form-control"
                              >
                                {selectedColorArray.map((_, index) => (
                                  <option key={`${selectedColorTarget.path}-${index}`} value={index}>
                                    {`Color ${index + 1}`}
                                  </option>
                                ))}
                              </Form.Select>
                              <Button
                                variant="primary"
                                onClick={handleAddColorToArray}
                                aria-label="Add color slot"
                                title="Add color slot"
                                className="config-color-slot-action-btn d-flex align-items-center justify-content-center"
                              >
                                Add
                              </Button>
                              <Button
                                variant="danger"
                                onClick={handleRemoveColorFromArray}
                                aria-label="Remove color slot"
                                title="Remove color slot"
                                className="config-color-slot-action-btn d-flex align-items-center justify-content-center"
                              >
                                Remove
                              </Button>
                            </div>
                          </Form.Group>
                        </Col>
                      )}
                      <Col xs={12} lg={selectedColorTarget.kind === "array" ? 4 : 4}>
                        <Form.Group className="mb-2" controlId="formSharedColorPicker">
                          <Form.Label>Edit custom color</Form.Label>
                          <div className="config-color-custom-row">
                            <label className="config-color-picker-btn config-color-picker-btn-swatch mb-0" aria-label="Pick a custom colour">
                              <span className="config-color-picker-rect" style={{ background: selectedColorValue }}>
                                <Form.Control
                                  type="color"
                                  value={selectedColorValue}
                                  onChange={handleColorPickerChange}
                                  className="color-scheme-native-picker"
                                  title="Pick a custom colour"
                                />
                              </span>
                            </label>
                            <Form.Control
                              type="text"
                              value={hexInputValue}
                              onChange={handleHexInputChange}
                              onBlur={() => setHexInputValue(selectedColorValue)}
                              placeholder="#000000"
                              className="config-color-hex-input"
                            />
                          </div>
                        </Form.Group>
                      </Col>
                    </Row>
                  </Col>
                </Row>
                <Row className="mt-3">
                  <Col xs={12} lg={4}>
                    <h5 className="mb-3">Activities</h5>
                    <Row>
                      
                      
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
                    </Row>
                  </Col>
                  <Col xs={12} lg={4}>
                    <h5 className="mb-3">Participations</h5>
                    <Row>
                      
                      
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
