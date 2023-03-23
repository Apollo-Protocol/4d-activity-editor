import { useEffect, useState, useRef, Dispatch } from "react";
import { config } from "@/diagram/config";
import SetIndividual from "@/components/SetIndividual";
import SetActivity from "@/components/SetActivity";
import SetConfig from "@/components/SetConfig";
import ActivityDiagram from "@/components/ActivityDiagram";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import DiagramPersistence from "@/components/DiagramPersistence";
import SortIndividuals from "./SortIndividuals";
import SetParticipation from "./SetParticipation";
import Undo from "./Undo";
import { Model } from "@/lib/Model";
import { Activity, Id, Individual, Maybe, Participation } from "@/lib/Schema";
import ExportJson from "./ExportJson";
import ExportSvg from "./ExportSvg";

const beforeUnloadHandler = (ev: BeforeUnloadEvent) => {
  ev.returnValue = "";
  ev.preventDefault();
  return;
};

export default function ActivityDiagramWrap() {
  const model = new Model();
  const [dataset, setDataset] = useState(model);
  const [dirty, setDirty] = useState(false);
  const [activityContext, setActivityContext] = useState<Maybe<Id>>(undefined);
  const [undoHistory, setUndoHistory] = useState<Model[]>([]);
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

  useEffect(() => {
    if (dirty)
      window.addEventListener("beforeunload", beforeUnloadHandler);
    else
      window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [dirty]);

  const updateDataset = (updater: Dispatch<Model>) => {
    setUndoHistory([dataset, ...undoHistory.slice(0, 5)]);
    const d = dataset.clone();
    updater(d);
    setDataset(d);
    setDirty(true);
  };
  /* Callers of this function must also handle the dirty flag. */
  const replaceDataset = (d: Model) => {
    setUndoHistory([]);
    setActivityContext(undefined);
    setDataset(d);
  };
  const undo = () => {
    if (undoHistory.length == 0) return;
    setDataset(undoHistory[0]);
    setUndoHistory(undoHistory.slice(1));
  };

  const svgRef = useRef<SVGSVGElement>(null);

  const deleteIndividual = (id: string) => {
    updateDataset((d: Model) => d.removeIndividual(id));
  };
  const setIndividual = (individual: Individual) => {
    updateDataset((d: Model) => d.addIndividual(individual));
  };
  const deleteActivity = (id: string) => {
    updateDataset((d: Model) => d.removeActivity(id));
  };
  const setActivity = (activity: Activity) => {
    updateDataset((d: Model) => d.addActivity(activity));
  };

  const clickIndividual = (i: Individual) => {
    setSelectedIndividual(i);
    setShowIndividual(true);
  };
  const clickActivity = (a: Activity) => {
    setSelectedActivity(a);
    setShowActivity(true);
  };
  const clickParticipation = (a: Activity, p: Participation) => {
    setSelectedActivity(a);
    setSelectedParticipation(p);
    setShowParticipation(true);
  };

  const rightClickIndividual = (i: Individual) => {
    console.log("Individual right clicked. Functionality can be added here.");
  };
  const rightClickActivity = (a: Activity) => {
    console.log("Activity right clicked. Functionality can be added here.");
  };
  const rightClickParticipation = (a: Activity, p: Participation) => {
    console.log(
      "Participation right clicked. Functionality can be added here."
    );
  };

  const individualsArray: Individual[] = [];
  dataset.individuals.forEach((i: Individual) => individualsArray.push(i));

  const activitiesArray: Activity[] = [];
  dataset.activities.forEach((a: Activity) => activitiesArray.push(a));

  return (
    <>
      <Container fluid>
        <ActivityDiagram
          dataset={dataset}
          configData={configData}
          activityContext={activityContext}
          setActivityContext={setActivityContext}
          clickIndividual={clickIndividual}
          clickActivity={clickActivity}
          clickParticipation={clickParticipation}
          rightClickIndividual={rightClickIndividual}
          rightClickActivity={rightClickActivity}
          rightClickParticipation={rightClickParticipation}
          svgRef={svgRef}
        />
        <Row className="mt-3">
          <Col className="d-flex justify-content-center">
            <ExportSvg dataset={dataset} svgRef={svgRef} />
            <ExportJson dataset={dataset} />
            <SetConfig
              configData={configData}
              setConfigData={setConfigData}
              showConfigModal={showConfigModal}
              setShowConfigModal={setShowConfigModal}
            />
            <SortIndividuals
              dataset={dataset}
              updateDataset={updateDataset}
              showSortIndividuals={showSortIndividuals}
              setShowSortIndividuals={setShowSortIndividuals}
            />
            <SetActivity
              show={showActivity}
              setShow={setShowActivity}
              selectedActivity={selectedActivity}
              setSelectedActivity={setSelectedActivity}
              individuals={individualsArray}
              dataset={dataset}
              updateDataset={updateDataset}
              activityContext={activityContext}
              setActivityContext={setActivityContext}
            />
            <SetIndividual
              deleteIndividual={deleteIndividual}
              setIndividual={setIndividual}
              show={showIndividual}
              setShow={setShowIndividual}
              selectedIndividual={selectedIndividual}
              setSelectedIndividual={setSelectedIndividual}
              dataset={dataset}
              updateDataset={updateDataset}
            />
            <SetParticipation
              setActivity={setActivity}
              show={showParticipation}
              setShow={setShowParticipation}
              selectedActivity={selectedActivity}
              setSelectedActivity={setSelectedActivity}
              selectedParticipation={selectedParticipation}
              setSelectedParticipation={setSelectedParticipation}
              dataset={dataset}
              updateDataset={updateDataset}
            />
            <Undo hasUndo={undoHistory.length > 0} undo={undo} />
          </Col>
        </Row>
        <Row className="mt-3">
          <Col className="d-flex justify-content-center align-items-center">
            <DiagramPersistence
              dataset={dataset}
              setDataset={replaceDataset}
              svgRef={svgRef}
              setDirty={setDirty}
            />
          </Col>
        </Row>
      </Container>
    </>
  );
}
