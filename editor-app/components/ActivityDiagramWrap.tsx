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
import {
  Activity,
  Id,
  Individual,
  Maybe,
  Participation,
  EntityType,
} from "@/lib/Schema";
import ExportJson from "./ExportJson";
import ExportSvg from "./ExportSvg";
import { Button } from "react-bootstrap";
import HideIndividuals from "./HideIndividuals";
import React from "react";
import Card from "react-bootstrap/Card";
import DiagramLegend from "./DiagramLegend";

const beforeUnloadHandler = (ev: BeforeUnloadEvent) => {
  ev.returnValue = "";
  ev.preventDefault();
  return;
};

/* XXX Most of this component needs refactoring into a Controller class,
 * leaving the react component as just the View. */
export default function ActivityDiagramWrap() {
  // compactMode hides individuals that participate in zero activities
  const [compactMode, setCompactMode] = useState(false);
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
    if (dirty) window.addEventListener("beforeunload", beforeUnloadHandler);
    else window.removeEventListener("beforeunload", beforeUnloadHandler);
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
  const clearDiagram = () => replaceDataset(new Model());

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

  // Sort individuals: Systems first with their components grouped underneath
  const individualsArray = Array.from(dataset.individuals.values());

  const sortedIndividuals = [...individualsArray].sort((a, b) => {
    // Helper: Get group key - systems use own ID, components use parent ID
    const getGroupKey = (ind: Individual) => {
      if ((ind.entityType ?? EntityType.Individual) === EntityType.System) {
        return ind.id;
      }
      if (
        (ind.entityType ?? EntityType.Individual) ===
          EntityType.SystemComponent &&
        ind.parentSystemId
      ) {
        return ind.parentSystemId;
      }
      return `_individual_${ind.id}`; // Regular individuals get unique keys
    };

    const groupA = getGroupKey(a);
    const groupB = getGroupKey(b);

    // Different groups? Systems/components come first, then individuals
    if (groupA !== groupB) {
      const aIsIndividual =
        (a.entityType ?? EntityType.Individual) === EntityType.Individual;
      const bIsIndividual =
        (b.entityType ?? EntityType.Individual) === EntityType.Individual;

      if (aIsIndividual && !bIsIndividual) return 1; // a after b
      if (!aIsIndividual && bIsIndividual) return -1; // a before b

      return groupA.localeCompare(groupB);
    }

    // Same group: System first, then components alphabetically
    const aIsSystem =
      (a.entityType ?? EntityType.Individual) === EntityType.System;
    const bIsSystem =
      (b.entityType ?? EntityType.Individual) === EntityType.System;
    const aIsComponent =
      (a.entityType ?? EntityType.Individual) === EntityType.SystemComponent;
    const bIsComponent =
      (b.entityType ?? EntityType.Individual) === EntityType.SystemComponent;

    if (aIsSystem && bIsComponent) return -1;
    if (aIsComponent && bIsSystem) return 1;

    // Both same type: sort by name
    return a.name.localeCompare(b.name);
  });

  // Build an array of activities from the dataset so it can be filtered below
  const activitiesArray = Array.from(dataset.activities.values());

  // Filter activities for the current context
  let activitiesInView: Activity[] = [];
  if (activityContext) {
    // Only include activities that are part of the current context
    activitiesInView = activitiesArray.filter(
      (a) => a.partOf === activityContext
    );
  } else {
    // Top-level activities (no parent)
    activitiesInView = activitiesArray.filter((a) => !a.partOf);
  }

  const partsCountMap: Record<string, number> = {};
  activitiesInView.forEach((a) => {
    partsCountMap[a.id] =
      typeof dataset.getPartsCount === "function"
        ? dataset.getPartsCount(a.id)
        : 0;
  });

  // render
  return (
    <>
      <Container fluid>
        <Row>
          <Col xs="auto">
            <DiagramLegend
              activities={activitiesInView}
              activityColors={config.presentation.activity.fill}
              partsCount={partsCountMap}
              onOpenActivity={(a) => {
                setSelectedActivity(a);
                setShowActivity(true);
              }}
            />
          </Col>
          <Col>
            <ActivityDiagram
              dataset={dataset}
              configData={config}
              activityContext={activityContext}
              setActivityContext={setActivityContext}
              clickIndividual={clickIndividual}
              clickActivity={clickActivity}
              clickParticipation={clickParticipation}
              rightClickIndividual={rightClickIndividual}
              rightClickActivity={rightClickActivity}
              rightClickParticipation={rightClickParticipation}
              svgRef={svgRef}
              hideNonParticipating={compactMode}
              sortedIndividuals={sortedIndividuals}
            />
          </Col>
        </Row>
        <Row className="mt-3 justify-content-between">
          <Col className="d-flex justify-content-start">
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
            <SortIndividuals
              dataset={dataset}
              updateDataset={updateDataset}
              showSortIndividuals={showSortIndividuals}
              setShowSortIndividuals={setShowSortIndividuals}
            />
            <HideIndividuals
              compactMode={compactMode}
              setCompactMode={setCompactMode}
              dataset={dataset}
              activitiesInView={activitiesInView}
            />
          </Col>
          <Col className="d-flex justify-content-end">
            <Undo
              hasUndo={undoHistory.length > 0}
              undo={undo}
              clearDiagram={clearDiagram}
            />
            <SetConfig
              configData={configData}
              setConfigData={setConfigData}
              showConfigModal={showConfigModal}
              setShowConfigModal={setShowConfigModal}
            />
            <ExportSvg dataset={dataset} svgRef={svgRef} />
            <ExportJson dataset={dataset} />
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

// Pass compactMode down to ActivityDiagram (already rendered above)
// Update ActivityDiagram invocation near top of file:

/*
  Replace the existing ActivityDiagram invocation with:
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
    hideNonParticipating={compactMode}
  />

  (The earlier invocation should be replaced so ActivityDiagram receives the prop.)
*/
