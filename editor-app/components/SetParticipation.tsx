import React, { Dispatch, SetStateAction, useRef } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import { Activity, Participation } from "lib/Schema";
import { InputGroup } from "react-bootstrap";
import { v4 as uuidv4 } from "uuid";
import { Model } from "@/lib/Model";

interface Props {
  setActivity: (activity: Activity) => void;
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedActivity: Activity | undefined;
  setSelectedActivity: Dispatch<SetStateAction<Activity | undefined>>;
  selectedParticipation: Participation | undefined;
  setSelectedParticipation: any;
  dataset: Model;
  updateDataset: Dispatch<Dispatch<Model>>;
}

const SetParticipation = (props: Props) => {
  const {
    setActivity,
    show,
    setShow,
    selectedActivity,
    setSelectedActivity,
    selectedParticipation,
    setSelectedParticipation,
    dataset,
    updateDataset,
  } = props;

  const newRole = useRef<any>(null);

  const handleClose = () => {
    setShow(false);
    setSelectedParticipation(undefined);
    setSelectedActivity(undefined);
  };
  const handleShow = () => {};
  const handleAdd = (event: any) => {
    event.preventDefault();
    if (
      selectedActivity &&
      selectedActivity.participations &&
      selectedParticipation &&
      selectedParticipation.individualId
    ) {
      let localActivity: Activity = { ...selectedActivity };
      localActivity.participations.set(
        selectedParticipation.individualId,
        selectedParticipation
      );
      setActivity(localActivity);
    }
    handleClose();
  };

  const handleTypeChange = (e: any) => {
    dataset.roles.forEach((role) => {
      if (e.target.value == role.id) {
        setSelectedParticipation({
          ...selectedParticipation,
          [e.target.name]: role,
        });
      }
    });
  };

  const addRole = (e: any) => {
    if (newRole.current && newRole.current.value) {
      updateDataset((d) => d.addRoleType(uuidv4(), newRole.current.value));
      newRole.current.value = null;
    }
  };

  return (
    <>
      <Modal show={show} onHide={handleClose} onShow={handleShow}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Participation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAdd}>
            <Form.Group className="mb-3" controlId="formParticipationRole">
              <Form.Label>Role</Form.Label>
              <Form.Select
                name="role"
                value={selectedParticipation?.role?.id}
                onChange={handleTypeChange}
                className="form-control"
              >
                {selectedParticipation?.role == undefined && (
                  <option value={undefined}>Choose role</option>
                )}
                {dataset.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <InputGroup className="mb-3" size="sm">
              <InputGroup.Text id="basic-addon1">Add option</InputGroup.Text>
              <Form.Control
                placeholder="New Role"
                aria-label="New Role"
                ref={newRole}
              />
              <Button
                variant="outline-secondary"
                id="button-addon2"
                onClick={addRole}
              >
                Add Type
              </Button>
            </InputGroup>
          </Form>
        </Modal.Body>
        <Modal.Footer>
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

export default SetParticipation;
