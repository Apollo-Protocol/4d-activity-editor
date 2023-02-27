import { useState, useRef, MutableRefObject } from "react";
import { config } from "@/diagram/config";
import SetIndividual from "@/components/SetIndividual";
import SetActivity from "@/components/SetActivity";
import SetConfig from "@/components/SetConfig";
import ActivityDiagram from "@/components/ActivityDiagram";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import { Model, Individual, Activity, Participation } from "amrc-activity-lib";
import DiagramPersistence from "@/components/DiagramPersistence";
import SortIndividuals from "./SortIndividuals";
import SetParticipation from "./SetParticipation";

export default function ActivityDiagramWrap() {
  const model = new Model();
  const [dataset, setDataset] = useState(model);
  const [showIndividual, setShowIndividual] = useState(false);
  const [selectedIndividual, setSelectedIndividual] = useState<
    Individual | undefined
  >(undefined);
  const [showActivity, setShowActivity] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<
    Activity | undefined
  >(undefined);
  const [showParticipation, setShowParticipation] = useState(false);
  const [selectedParticipation, setSelectedParticipation] = useState<
    Participation | undefined
  >(undefined);
  const [configData, setConfigData] = useState(config);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSortIndividuals, setShowSortIndividuals] = useState(false);

  const svgRef: MutableRefObject<any> = useRef();

  const deleteIndividual = (id: string) => {
    const d = dataset.clone();
    d.removeIndividual(id);
    setDataset(d);
  };
  const setIndividual = (individual: Individual) => {
    const d = dataset.clone();
    d.addIndividual(individual);
    setDataset(d);
  };
  const deleteActivity = (id: string) => {
    const d = dataset.clone();
    d.removeActivity(id);
    setDataset(d);
  };
  const setActivity = (activity: Activity) => {
    const d = dataset.clone();
    d.addActivity(activity);
    setDataset(d);
  };

  const clickIndividual = (i: Individual) => {
    setSelectedIndividual(i);
    setShowIndividual(true);
  };
  const clickActivity = (a: any) => {
    setSelectedActivity(a);
    setShowActivity(true);
  };
  const clickParticipation = (a: Activity, p: Participation) => {
    setSelectedActivity(a);
    setSelectedParticipation(p);
    setShowParticipation(true);
  };

  const individualsArray: Individual[] = [];
  dataset.individuals.forEach((i: Individual) => individualsArray.push(i));

  return (
    <>
      <Container fluid>
        <ActivityDiagram
          dataset={dataset}
          configData={configData}
          clickIndividual={clickIndividual}
          clickActivity={clickActivity}
          clickParticipation={clickParticipation}
          svgRef={svgRef}
        />
        <Row className="mt-3">
          <Col className="d-flex justify-content-center">
            <SetConfig
              configData={configData}
              setConfigData={setConfigData}
              showConfigModal={showConfigModal}
              setShowConfigModal={setShowConfigModal}
            />
            <SortIndividuals
              dataset={dataset}
              setDataset={setDataset}
              showSortIndividuals={showSortIndividuals}
              setShowSortIndividuals={setShowSortIndividuals}
            />
            <SetActivity
              deleteActivity={deleteActivity}
              setDataset={setActivity}
              show={showActivity}
              setShow={setShowActivity}
              selectedActivity={selectedActivity}
              setSelectedActivity={setSelectedActivity}
              individuals={individualsArray}
            />
            <SetIndividual
              deleteIndividual={deleteIndividual}
              setDataset={setIndividual}
              show={showIndividual}
              setShow={setShowIndividual}
              selectedIndividual={selectedIndividual}
              setSelectedIndividual={setSelectedIndividual}
            />
            <SetParticipation
              setDataset={setActivity}
              show={showParticipation}
              setShow={setShowParticipation}
              selectedActivity={selectedActivity}
              setSelectedActivity={setSelectedActivity}
              selectedParticipation={selectedParticipation}
              setSelectedParticipation={setSelectedParticipation}
            />
          </Col>
        </Row>
        <Row className="mt-3">
          <Col className="d-flex justify-content-center">
            <DiagramPersistence
              dataset={dataset}
              setDataset={setDataset}
              svgRef={svgRef}
            />
          </Col>
        </Row>
      </Container>
    </>
  );
}
