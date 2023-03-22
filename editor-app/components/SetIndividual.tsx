import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Container from "react-bootstrap/Container";
import { Individual } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import { v4 as uuidv4 } from "uuid";
import { Alert, InputGroup } from "react-bootstrap";

interface Props {
  deleteIndividual: (id: string) => void;
  setIndividual: (individual: Individual) => void;
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedIndividual: Individual | undefined;
  setSelectedIndividual: Dispatch<SetStateAction<Individual | undefined>>;
  dataset: Model;
  updateDataset: Dispatch<Dispatch<Model>>;
}

const SetIndividual = (props: Props) => {
  const {
    deleteIndividual,
    setIndividual,
    show,
    setShow,
    selectedIndividual,
    setSelectedIndividual,
    dataset,
    updateDataset,
  } = props;
  let defaultIndividual: Individual = {
    id: "",
    name: "",
    type: dataset.defaultIndividualType,
    description: "",
    beginning: -1,
    ending: Model.END_OF_TIME,
    beginsWithParticipant: false,
    endsWithParticipant: false,
  };

  const newType = useRef<any>(null);
  const [errors, setErrors] = useState([]);
  const [inputs, setInputs] = useState(
    selectedIndividual ? selectedIndividual : defaultIndividual
  );
  const [beginsWithParticipant, setBeginsWithParticipant] = useState(false);
  const [endsWithParticipant, setEndsWithParticipant] = useState(false);
  const [individualHasParticipants, setIndividualHasParticipants] =
    useState(false);

  useEffect(() => {
    if (selectedIndividual) {
      setIndividualHasParticipants(
        dataset.hasParticipants(selectedIndividual.id)
      );
    }

    if (selectedIndividual && selectedIndividual.beginning > -1) {
      setBeginsWithParticipant(true);
    } else {
      setBeginsWithParticipant(false);
    }

    if (selectedIndividual && selectedIndividual.ending < Model.END_OF_TIME) {
      setEndsWithParticipant(true);
    } else {
      setEndsWithParticipant(false);
    }
  }, [selectedIndividual, dataset]);

  const handleClose = () => {
    setShow(false);
    setInputs(defaultIndividual);
    setSelectedIndividual(undefined);
    setErrors([]);
  };
  const handleShow = () => {
    if (selectedIndividual) {
      setInputs(selectedIndividual);
    } else {
      defaultIndividual.id = uuidv4();
      setInputs(defaultIndividual);
    }
  };
  const handleAdd = (event: any) => {
    event.preventDefault();
    const isValid = validateInputs();
    if (isValid) {
      setIndividual(inputs);
      handleClose();
    }
  };
  const handleDelete = (event: any) => {
    deleteIndividual(inputs.id);
    handleClose();
  };

  const handleChange = (e: any) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const handleTypeChange = (e: any) => {
    dataset.individualTypes.forEach((type) => {
      if (e.target.value == type.id) {
        console.log(inputs);
        setInputs({ ...inputs, [e.target.name]: type });
      }
    });
  };

  const handleBeginsWithParticipant = (e: any) => {
    const checked = e.target.checked;
    const earliestBeginning = selectedIndividual
      ? dataset.earliestParticipantBeginning(selectedIndividual.id)
      : 0;
    setBeginsWithParticipant(checked);
    if (checked) {
      setInputs({
        ...inputs,
        beginning: earliestBeginning ? earliestBeginning : 0,
      });
    } else {
      setInputs({
        ...inputs,
        beginning: -1,
      });
    }
  };

  const handleEndsWithParticipant = (e: any) => {
    const checked = e.target.checked;
    const lastEnding = selectedIndividual
      ? dataset.lastParticipantEnding(selectedIndividual.id)
      : Number.MAX_VALUE;
    setEndsWithParticipant(checked);
    if (checked) {
      setInputs({
        ...inputs,
        ending: lastEnding,
      });
    } else {
      setInputs({
        ...inputs,
        ending: Number.MAX_VALUE,
      });
    }
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
      updateDataset((d) =>
        d.addIndividualType(uuidv4(), newType.current.value)
      );
      newType.current.value = null;
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setShow(true)} className="mx-1">
        Add Individual
      </Button>

      <Modal show={show} onHide={handleClose} onShow={handleShow}>
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedIndividual ? "Edit Individual" : "Add Individual"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAdd}>
            <Form.Group className="mb-3" controlId="formIndividualName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={inputs?.name}
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
                {dataset.individualTypes.map((type) => (
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
                value={inputs?.description}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>
            <Form.Group
              className="mb-3"
              controlId="formIndividualBeginsWithParticipant"
            >
              <Form.Check
                type="switch"
                name="beginsWithParticipant"
                label="Begins With Participant"
                disabled={!individualHasParticipants}
                checked={beginsWithParticipant}
                onChange={handleBeginsWithParticipant}
              />
            </Form.Group>
            <Form.Group
              className="mb-3"
              controlId="formIndividualEndsWithParticipant"
            >
              <Form.Check
                type="switch"
                name="endsWithParticipant"
                label="Ends With Participant"
                disabled={!individualHasParticipants}
                checked={endsWithParticipant}
                onChange={handleEndsWithParticipant}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Container>
            <Row>
              <Col style={{ display: "flex", justifyContent: "right" }}>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  className={selectedIndividual ? "d-block mx-1" : "d-none"}
                >
                  Delete
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleClose}
                  className="mx-1"
                >
                  Close
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

export default SetIndividual;
