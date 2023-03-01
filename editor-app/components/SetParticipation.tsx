import React, { Dispatch, SetStateAction } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import { Activity, Participation } from "amrc-activity-lib";

interface Props {
  setDataset: (activity: Activity) => void;
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedActivity: Activity | undefined;
  setSelectedActivity: Dispatch<SetStateAction<Activity | undefined>>;
  selectedParticipation: Participation | undefined;
  setSelectedParticipation: any;
}

const SetParticipation = (props: Props) => {
  const {
    setDataset,
    show,
    setShow,
    selectedActivity,
    setSelectedActivity,
    selectedParticipation,
    setSelectedParticipation,
  } = props;

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
      setDataset(localActivity);
    }
    handleClose();
  };

  const handleChange = (e: any) => {
    setSelectedParticipation({
      ...selectedParticipation,
      [e.target.name]: e.target.value,
    });
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
              <Form.Control
                type="text"
                name="role"
                value={selectedParticipation?.role}
                onChange={handleChange}
                className="form-control"
              />
            </Form.Group>
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
