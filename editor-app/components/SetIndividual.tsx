import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import { Model, Individual } from "amrc-activity-lib";
import { v4 as uuidv4 } from "uuid";

interface Props {
  deleteIndividual: (id: string) => void;
  setDataset: (individual: Individual) => void;
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedIndividual: Individual | undefined;
  setSelectedIndividual: Dispatch<SetStateAction<Individual | undefined>>;
  dataset: Model;
}

const SetIndividual = (props: Props) => {
  const {
    deleteIndividual,
    setDataset,
    show,
    setShow,
    selectedIndividual,
    setSelectedIndividual,
    dataset,
  } = props;
  let defaultIndividual: Individual = {
    id: "",
    name: "",
    type: "",
    description: "",
    beginning: -1,
    ending: Model.END_OF_TIME,
    beginsWithParticipant: false,
    endsWithParticipant: false,
  };

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
    setDataset(inputs);
    handleClose();
  };
  const handleDelete = (event: any) => {
    deleteIndividual(inputs.id);
    handleClose();
  };

  const handleChange = (e: any) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
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
              <Form.Control
                type="text"
                name="type"
                value={inputs?.type}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>
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
