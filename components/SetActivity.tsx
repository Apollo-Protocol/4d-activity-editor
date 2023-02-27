import React, { Dispatch, SetStateAction, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { v4 as uuidv4 } from "uuid";
import Select from "react-select";
import { Individual, Activity, Participation } from "amrc-activity-lib";

interface Props {
  deleteActivity: any;
  setDataset: (activity: Activity) => void;
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedActivity: Activity | undefined;
  setSelectedActivity: any;
  individuals: Individual[];
}

const SetActivity = (props: Props) => {
  const {
    deleteActivity,
    setDataset,
    show,
    setShow,
    selectedActivity,
    setSelectedActivity,
    individuals,
  } = props;
  let defaultActivity: Activity = {
    id: "",
    name: "",
    type: "",
    description: "",
    beginning: 0,
    ending: 0,
    participations: new Map<string, Participation>(),
  };

  const [inputs, setInputs] = useState(defaultActivity);
  const [errors, setErrors] = useState([]);

  const handleClose = () => {
    setShow(false);
    setInputs(defaultActivity);
    setSelectedActivity(undefined);
    setErrors([]);
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
    const isValid = validateInputs();
    if (isValid) {
      setDataset(inputs);
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
    deleteActivity(inputs.id);
    handleClose();
  };

  const handleChange = (e: any) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const handleChangeNumeric = (e: any) => {
    setInputs({ ...inputs, [e.target.name]: e.target.valueAsNumber });
  };

  const handleChangeMultiselect = (e: any) => {
    const participations = new Map<string, Participation>();
    e.forEach((i: Individual) => {
      let participation: Participation = {
        individualId: i.id,
        type: "",
        role: "",
      };
      participations.set(i.id, participation);
    });
    setInputs({ ...inputs, participations: participations });
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
    //Ending and beginning
    if (inputs.ending - inputs.beginning <= 0) {
      runningErrors.push("Ending must be after beginning");
    }
    if (inputs.beginning % 1 != 0) {
      runningErrors.push("Beginning must be a whole number");
    }
    if (inputs.ending % 1 != 0) {
      runningErrors.push("Ending must be a whole number");
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
              <Form.Control
                type="text"
                name="type"
                value={inputs.type}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>
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
                className="form-control"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="formIndividualEnding">
              <Form.Label>Ending</Form.Label>
              <Form.Control
                type="number"
                name="ending"
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
            <Row>
              <Col style={{ display: "flex", justifyContent: "right" }}>
                <Button
                  className={selectedActivity ? "d-block mx-1" : "d-none mx-1"}
                  variant="danger"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
                <Button
                  className="mx-1"
                  variant="secondary"
                  onClick={handleClose}
                >
                  Close
                </Button>
                <Button
                  className={selectedActivity ? "d-block mx-1" : "d-none mx-1"}
                  variant="primary"
                  onClick={handleCopy}
                >
                  Copy
                </Button>
                <Button variant="primary" onClick={handleAdd}>
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
