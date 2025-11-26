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

  // Add new state for the InstalledComponent editor
  const [showInstalledComponentEditor, setShowInstalledComponentEditor] =
    useState(false);
  const [selectedInstalledComponent, setSelectedInstalledComponent] = useState<
    Individual | undefined
  >(undefined);

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

  const clickIndividual = (i: Individual) => {
    // If it's an InstalledComponent, open the special editor
    if (
      (i.entityType ?? EntityType.Individual) === EntityType.InstalledComponent
    ) {
      setSelectedInstalledComponent(i);
      setShowInstalledComponentEditor(true);
    } else {
      // For other types, open the regular editor
      setSelectedIndividual(i);
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

  // Sort individuals to show nested hierarchy
  // InstalledComponents appear BOTH at top-level AND under their installation targets
  const sortedIndividuals = useMemo(() => {
    const result: Individual[] = [];
    const visited = new Set<string>();

    // Recursive function to add an individual and its descendants
    const addWithDescendants = (ind: Individual) => {
      if (visited.has(ind.id)) return;
      visited.add(ind.id);
      result.push(ind);

      // Find children of this individual
      const children: Individual[] = [];

      // 1. SystemComponents whose parent is this individual
      individualsArray.forEach((child) => {
        const childEntityType = child.entityType ?? EntityType.Individual;
        if (
          childEntityType === EntityType.SystemComponent &&
          child.parentSystemId === ind.id
        ) {
          children.push(child);
        }
      });

      // Sort children by name and add them
      children
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((child) => addWithDescendants(child));

      // 2. After adding SystemComponent children, check if this IS a SystemComponent
      //    If so, find InstalledComponents that are installed into this slot
      const indEntityType = ind.entityType ?? EntityType.Individual;
      if (indEntityType === EntityType.SystemComponent) {
        // Find all InstalledComponents that have an installation targeting this slot
        const installedHere = individualsArray.filter((ic) => {
          const icType = ic.entityType ?? EntityType.Individual;
          if (icType !== EntityType.InstalledComponent) return false;
          if (!ic.installations || ic.installations.length === 0) return false;
          return ic.installations.some((inst) => inst.targetId === ind.id);
        });

        // Add these as "installation references"
        installedHere
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((ic) => {
            // Create a reference entry with composite ID
            // The ID format is: originalId__installed_in__slotId
            const installRef: Individual = {
              ...ic,
              id: `${ic.id}__installed_in__${ind.id}`,
              // Keep beginning/ending as the full timeline for the row shape
              // The actual installation period will be drawn by DrawInstallations
              beginning: -1,
              ending: Model.END_OF_TIME,
            };
            result.push(installRef);
          });
      }
    };

    // Separate entities into groups
    const systems: Individual[] = [];
    const installedComponents: Individual[] = [];
    const regularIndividuals: Individual[] = [];
    const orphanedSystemComponents: Individual[] = [];

    individualsArray.forEach((ind) => {
      const entityType = ind.entityType ?? EntityType.Individual;

      if (entityType === EntityType.System) {
        systems.push(ind);
      } else if (entityType === EntityType.InstalledComponent) {
        installedComponents.push(ind);
      } else if (entityType === EntityType.SystemComponent) {
        // SystemComponents without a valid parent are orphans (show at top level)
        if (!ind.parentSystemId) {
          orphanedSystemComponents.push(ind);
        } else {
          const parentExists = individualsArray.some(
            (i) => i.id === ind.parentSystemId
          );
          if (!parentExists) {
            orphanedSystemComponents.push(ind);
          }
          // Otherwise, they will be added as children of their parent
        }
      } else if (entityType === EntityType.Individual) {
        regularIndividuals.push(ind);
      }
    });

    // 1. Add Systems first (with their nested SystemComponents and InstalledComponents)
    systems
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((sys) => addWithDescendants(sys));

    // 2. Add orphaned SystemComponents (if any)
    orphanedSystemComponents
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((sc) => addWithDescendants(sc));

    // 3. Add InstalledComponents (physical objects shown at top level)
    installedComponents
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((ic) => {
        if (!visited.has(ic.id)) {
          visited.add(ic.id);
          result.push(ic);
        }
      });

    // 4. Add regular Individuals last (sorted alphabetically)
    regularIndividuals
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((ind) => {
        if (!visited.has(ind.id)) {
          visited.add(ind.id);
          result.push(ind);
        }
      });

    return result;
  }, [individualsArray]);

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

      {/* Add the new InstalledComponent editor modal */}
      <EditInstalledComponent
        show={showInstalledComponentEditor}
        setShow={setShowInstalledComponentEditor}
        individual={selectedInstalledComponent}
        setIndividual={setIndividual}
        dataset={dataset}
        updateDataset={updateDataset}
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
