import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import { Model, Individual } from "amrc-activity-lib";
import { v4 as uuidv4 } from "uuid";
import { InputGroup } from "react-bootstrap";

interface Props {
  deleteIndividual: (id: string) => void;
  setIndividual: (individual: Individual) => void;
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedIndividual: Individual | undefined;
  setSelectedIndividual: Dispatch<SetStateAction<Individual | undefined>>;
  dataset: Model;
  setDataset: Dispatch<SetStateAction<Model>>;
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
    setDataset,
  } = props;
  let defaultIndividual: Individual = {
    id: "",
    name: "",
    type: undefined,
    description: "",
    beginning: -1,
    ending: Model.END_OF_TIME,
    beginsWithParticipant: false,
    endsWithParticipant: false,
  };

  const newType = useRef<any>(null);
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
  }, [selectedIndividual]);

  const handleClose = () => {
    setShow(false);
    setInputs(defaultIndividual);
    setSelectedIndividual(undefined);
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
    setIndividual(inputs);
    handleClose();
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

  const addType = (e: any) => {
    if (newType.current && newType.current.value) {
      const d = dataset.clone();
      d.addIndividualType(uuidv4(), newType.current.value);
      setDataset(d);
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
          <Button
            variant="danger"
            onClick={handleDelete}
            className={selectedIndividual ? "d-block" : "d-none"}
          >
            Delete
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

export default SetIndividual;
