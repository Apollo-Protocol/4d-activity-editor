import { useEffect, useState, useRef, Dispatch, useMemo } from "react";
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
import EditInstalledComponent from "./EditInstalledComponent";
import EditSystemComponentInstallation from "./EditSystemComponentInstallation";
import EntityTypeLegend from "./EntityTypeLegend";

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

  // State for the InstalledComponent editor
  const [showInstalledComponentEditor, setShowInstalledComponentEditor] =
    useState(false);
  const [selectedInstalledComponent, setSelectedInstalledComponent] = useState<
    Individual | undefined
  >(undefined);
  // State for target slot ID (when clicking on a specific installation row)
  const [targetSlotId, setTargetSlotId] = useState<string | undefined>(
    undefined
  );

  // State for the SystemComponent editor
  const [showSystemComponentEditor, setShowSystemComponentEditor] =
    useState(false);
  const [selectedSystemComponent, setSelectedSystemComponent] = useState<
    Individual | undefined
  >(undefined);
  // State for target system ID (when clicking on a specific installation row)
  const [targetSystemId, setTargetSystemId] = useState<string | undefined>(
    undefined
  );

  // State for SystemComponent installation modal
  const [
    showEditSystemComponentInstallation,
    setShowEditSystemComponentInstallation,
  ] = useState(false);
  const [
    selectedIndividualForScInstallation,
    setSelectedIndividualForScInstallation,
  ] = useState<Individual | undefined>();
  const [targetSystemIdForScInstallation, setTargetSystemIdForScInstallation] =
    useState<string | undefined>();

  // State for InstalledComponent installation modal
  const [showEditInstalledComponent, setShowEditInstalledComponent] =
    useState(false);
  const [
    selectedIndividualForIcInstallation,
    setSelectedIndividualForIcInstallation,
  ] = useState<Individual | undefined>();
  const [targetSlotIdForIcInstallation, setTargetSlotIdForIcInstallation] =
    useState<string | undefined>();
  const [targetSystemIdForIcInstallation, setTargetSystemIdForIcInstallation] =
    useState<string | undefined>();

  // Add callbacks for opening installation modals from SetIndividual
  const handleOpenSystemComponentInstallation = (individual: Individual) => {
    setSelectedSystemComponent(individual);
    setTargetSystemId(undefined); // Show all systems
    setShowSystemComponentEditor(true);
  };

  const handleOpenInstalledComponentInstallation = (individual: Individual) => {
    setSelectedInstalledComponent(individual);
    setTargetSlotId(undefined); // Show all slots
    setTargetSystemId(undefined);
    setShowInstalledComponentEditor(true);
  };

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

  // Build an array of individuals from the dataset
  const individualsArray = Array.from(dataset.individuals.values());

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

  const clickIndividual = (i: any) => {
    // Check if this is a virtual row (installation reference)
    const isVirtual = i.id.includes("__installed_in__");

    if (isVirtual) {
      // This is a virtual row - open the installation editor
      const originalId = i.id.split("__installed_in__")[0];
      const rest = i.id.split("__installed_in__")[1];
      const parts = rest.split("__");
      const targetId = parts[0];

      const originalIndividual = dataset.individuals.get(originalId);
      if (!originalIndividual) return;

      const entityType = originalIndividual.entityType ?? EntityType.Individual;

      if (entityType === EntityType.SystemComponent) {
        // Virtual SystemComponent - open installation editor for this system
        setSelectedSystemComponent(originalIndividual);
        setTargetSystemId(targetId);
        setShowSystemComponentEditor(true);
      } else if (entityType === EntityType.InstalledComponent) {
        // Virtual InstalledComponent - open installation editor for this slot
        // Extract the system context from the virtual ID if present
        const contextMatch = i.id.match(/__ctx_([^_]+)$/);
        const contextId = contextMatch ? contextMatch[1] : undefined;

        // Find the system ID from the context
        let systemId: string | undefined;
        if (contextId && targetId) {
          const targetSc = dataset.individuals.get(targetId);
          if (targetSc?.installations) {
            const scInst = targetSc.installations.find(
              (inst) => inst.id === contextId
            );
            if (scInst) {
              systemId = scInst.targetId;
            }
          }
        }

        setSelectedInstalledComponent(originalIndividual);
        setTargetSlotId(targetId);
        setTargetSystemId(systemId);
        setShowInstalledComponentEditor(true);
      }
    } else {
      // This is a top-level entity - open the entity editor
      const individual = dataset.individuals.get(i.id);
      if (!individual) return;

      setSelectedIndividual(individual);
      setShowIndividual(true);
    }
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

  // Use the Model's getDisplayIndividuals method for sorting
  const sortedIndividuals = useMemo(() => {
    return dataset.getDisplayIndividuals();
  }, [dataset]);

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
            {/* Entity Type Legend above Activity Legend */}
            <EntityTypeLegend />
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
              onOpenSystemComponentInstallation={
                handleOpenSystemComponentInstallation
              }
              onOpenInstalledComponentInstallation={
                handleOpenInstalledComponentInstallation
              }
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

      <EditInstalledComponent
        show={showInstalledComponentEditor}
        setShow={setShowInstalledComponentEditor}
        individual={selectedInstalledComponent}
        setIndividual={setIndividual}
        dataset={dataset}
        updateDataset={updateDataset}
        targetSlotId={targetSlotId}
      />

      <EditSystemComponentInstallation
        show={showSystemComponentEditor}
        setShow={setShowSystemComponentEditor}
        individual={selectedSystemComponent}
        setIndividual={setIndividual}
        dataset={dataset}
        updateDataset={updateDataset}
        targetSystemId={targetSystemId}
      />
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
