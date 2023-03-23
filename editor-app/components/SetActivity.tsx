import React, { Dispatch, SetStateAction, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { v4 as uuidv4 } from "uuid";
import Select from "react-select";
import { Individual, Id, Activity, Maybe, Participation } from "@/lib/Schema";
import { InputGroup } from "react-bootstrap";
import { Model } from "@/lib/Model";

interface Props {
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedActivity: Activity | undefined;
  setSelectedActivity: Dispatch<SetStateAction<Activity | undefined>>;
  individuals: Individual[];
  dataset: Model;
  updateDataset: Dispatch<Dispatch<Model>>;
  activityContext: Maybe<Id>;
  setActivityContext: Dispatch<Maybe<Id>>;
}

const SetActivity = (props: Props) => {
  const {
    show,
    setShow,
    selectedActivity,
    setSelectedActivity,
    individuals,
    dataset,
    updateDataset,
    activityContext,
    setActivityContext,
  } = props;
  let defaultActivity: Activity = {
    id: "",
    name: "",
    type: dataset.defaultActivityType,
    description: "",
    beginning: 0,
    ending: 1,
    participations: new Map<string, Participation>(),
    partOf: activityContext,
  };

  const newType = useRef<any>(null);
  const [inputs, setInputs] = useState(defaultActivity);
  const [errors, setErrors] = useState([]);
  const [dirty, setDirty] = useState(false);

  function updateIndividuals(d: Model) {
    d.individuals.forEach((individual) => {
      const earliestBeginning = d.earliestParticipantBeginning(individual.id);
      const latestEnding = d.lastParticipantEnding(individual.id);
      if (individual.beginning >= 0) {
        individual.beginning = earliestBeginning ? earliestBeginning : -1;
      }
      if (individual.ending < Model.END_OF_TIME) {
        individual.ending = latestEnding;
      }
      d.addIndividual(individual);
    });
  }

  const handleClose = () => {
    setShow(false);
    setInputs(defaultActivity);
    setSelectedActivity(undefined);
    setErrors([]);
    setDirty(false);
  };
  const handleShow = () => {
    if (selectedActivity) {
      setInputs(selectedActivity);
    } else {
      defaultActivity.id = uuidv4();
      setInputs(defaultActivity);
    }
  };
  const handleAdd = (event: any) => {
    event.preventDefault();
    if (!dirty)
      return handleClose();
    const isValid = validateInputs();
    if (isValid) {
      updateDataset((d) => {
        d.addActivity(inputs);
        updateIndividuals(d);
      });
      handleClose();
    }
  };
  const handleCopy = (event: any) => {
    let copied = { ...inputs };
    copied.id = uuidv4();
    copied.name = copied.name + " (copied)";
    setInputs(copied);
  };
  const handleDelete = (event: any) => {
    updateDataset((d) => {
      d.removeActivity(inputs.id);
      updateIndividuals(d);
    });
    handleClose();
  };
  const handleContext = (event: any) => {
    handleAdd(event);
    setActivityContext(inputs.id);
  };

  /* React only calls change handlers if the value has really changed. */
  const updateInputs = (key: string, value: any) => {
    setInputs({ ...inputs, [key]: value });
    setDirty(true);
  };

  const handleChange = (e: any) => {
    updateInputs(e.target.name, e.target.value);
  };

  const handleTypeChange = (e: any) => {
    dataset.activityTypes.forEach((type) => {
      if (e.target.value == type.id) {
        updateInputs(e.target.name, type)
      }
    });
  };

  const handleChangeNumeric = (e: any) => {
    updateInputs(e.target.name, e.target.valueAsNumber);
  };

  const handleChangeMultiselect = (e: any) => {
    const participations = new Map<string, Participation>();
    e.forEach((i: Individual) => {
      let participation: Participation = {
        individualId: i.id,
        role: undefined,
      };
      participations.set(i.id, participation);
    });
    updateInputs("participations", participations);
  };

  const getSelectedIndividuals = () => {
    if (
      selectedActivity === undefined ||
      selectedActivity.participations === undefined
    ) {
      return [];
    }
    const individualIds = Array.from(
      selectedActivity.participations,
      ([key, value]) => key
    );
    const participatingIndividuals = individuals.filter((participant) => {
      return individualIds.includes(participant.id);
    });
    return participatingIndividuals;
  };

  const validateInputs = () => {
    let runningErrors = [];
    //Name
    if (!inputs.name) {
      runningErrors.push("Name field is required");
    }
    //Type
    if (!inputs.type) {
      runningErrors.push("Type field is required");
    }
    //Ending and beginning
    if (inputs.ending - inputs.beginning <= 0) {
      runningErrors.push("Ending must be after beginning");
    }
    if (inputs.ending >= Model.END_OF_TIME) {
      runningErrors.push("Ending cannot be greater than " + Model.END_OF_TIME);
    }
    //Participant count
    if (
      inputs.participations === undefined ||
      inputs.participations?.size < 1
    ) {
      runningErrors.push("Select at least one participant");
    }

    if (runningErrors.length == 0) {
      return true;
    } else {
      // @ts-ignore
      setErrors(runningErrors);
      return false;
    }
  };

  const addType = (e: any) => {
    if (newType.current && newType.current.value) {
      updateDataset((d) => d.addActivityType(uuidv4(), newType.current.value));
      newType.current.value = null;
    }
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setShow(true)}
        className={individuals.length > 0 ? "mx-1 d-block" : "mx-1 d-none"}
      >
        Add Activity
      </Button>

      <Modal show={show} onHide={handleClose} onShow={handleShow}>
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedActivity ? "Edit Activity" : "Add Activity"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAdd}>
            <Form.Group className="mb-3" controlId="formIndividualName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={inputs.name}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="formIndividualType">
              <Form.Label>Type</Form.Label>
              <Form.Select
                name="type"
                value={inputs?.type?.id}
                onChange={handleTypeChange}
                className="form-control"
              >
                {inputs.type == undefined && (
                  <option value={undefined}>Choose type</option>
                )}
                {dataset.activityTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <InputGroup className="mb-3" size="sm">
              <InputGroup.Text id="basic-addon1">Add option</InputGroup.Text>
              <Form.Control
                placeholder="New type"
                aria-label="New Type"
                ref={newType}
              />
              <Button
                variant="outline-secondary"
                id="button-addon2"
                onClick={addType}
              >
                Add Type
              </Button>
            </InputGroup>
            <Form.Group className="mb-3" controlId="formIndividualDescription">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                name="description"
                value={inputs.description}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="formIndividualBeginning">
              <Form.Label>Beginning</Form.Label>
              <Form.Control
                type="number"
                name="beginning"
                value={inputs.beginning}
                onChange={handleChangeNumeric}
                step="1"
                min="0"
                max={Model.END_OF_TIME - 2}
                className="form-control"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="formIndividualEnding">
              <Form.Label>Ending</Form.Label>
              <Form.Control
                type="number"
                name="ending"
                step="1"
                min="1"
                max={Model.END_OF_TIME - 1}
                value={inputs.ending}
                onChange={handleChangeNumeric}
                className="form-control"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="formParticipants">
              <Form.Label>Participants</Form.Label>
              <Select
                defaultValue={getSelectedIndividuals}
                isMulti
                // @ts-ignore
                options={individuals}
                getOptionLabel={(option) => option.name}
                // @ts-ignore
                getOptionValue={(option) => option.id}
                onChange={handleChangeMultiselect}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Container>
            <Row className="justify-content-between">
              <Col xs="auto">
                <Button
                  className={selectedActivity ? "mx-1" : "d-none mx-1"}
                  variant="danger"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
                <Button
                  className={selectedActivity ? "mx-1" : "d-none mx-1"}
                  variant="primary"
                  onClick={handleCopy}
                >
                  Copy
                </Button>
                <Button
                  className={selectedActivity ? "mx-1" : "d-none mx-1"}
                  variant="secondary"
                  onClick={handleContext}
                >
                  Sub-tasks
                </Button>
              </Col>
              <Col xs="auto">
                <Button
                  className="mx-1" variant="secondary"
                  onClick={handleClose}
                >
                  Close
                </Button>
                <Button 
                  className="mx-1" variant="primary" 
                  onClick={handleAdd} disabled={!dirty}
                >
                  Save
                </Button>
              </Col>
            </Row>
            <Row className="mt-2">
              <Col>
                {errors.length > 0 && (
                  <Alert variant={"danger"} className="p-2 m-0">
                    {errors.map((error, i) => (
                      <p key={i} className="mb-1">
                        {error}
                      </p>
                    ))}
                  </Alert>
                )}
              </Col>
            </Row>
          </Container>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SetActivity;
