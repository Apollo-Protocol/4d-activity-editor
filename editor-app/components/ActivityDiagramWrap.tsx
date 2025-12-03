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
import { load, save } from "@/lib/ActivityLib";

const beforeUnloadHandler = (ev: BeforeUnloadEvent) => {
  ev.returnValue = "";
  ev.preventDefault();
  return;
};

/**
 * Filter individuals based on compact mode rules:
 * 1. Top-level SC/IC with installations are ALWAYS hidden in compact mode
 * 2. Virtual rows are shown only if they participate
 * 3. Systems are shown if they or their children participate
 * 4. Regular individuals are shown if they participate
 */
function filterIndividualsForCompactMode(
  individuals: Individual[],
  participatingIds: Set<string>,
  dataset: Model
): Individual[] {
  // Track which Systems should be visible (because their children participate)
  const parentSystemsToShow = new Set<string>();

  // First pass: find parent systems of participating virtual rows
  participatingIds.forEach((id) => {
    if (id.includes("__installed_in__")) {
      const parts = id.split("__installed_in__");
      const rest = parts[1];
      const targetId = rest.split("__")[0];

      const target = dataset.individuals.get(targetId);
      if (target) {
        const targetType = target.entityType ?? EntityType.Individual;

        if (targetType === EntityType.System) {
          parentSystemsToShow.add(targetId);
        } else if (targetType === EntityType.SystemComponent) {
          // Find parent System of this SC
          if (target.installations) {
            target.installations.forEach((inst) => {
              const parentTarget = dataset.individuals.get(inst.targetId);
              if (parentTarget) {
                const parentType =
                  parentTarget.entityType ?? EntityType.Individual;
                if (parentType === EntityType.System) {
                  parentSystemsToShow.add(inst.targetId);
                }
              }
            });
          }
        }
      }
    }
  });

  return individuals.filter((ind) => {
    const entityType = ind.entityType ?? EntityType.Individual;
    const isVirtualRow = ind.id.includes("__installed_in__");

    // Rule 1: Top-level SC/IC with installations - ALWAYS hidden
    if (
      (entityType === EntityType.SystemComponent ||
        entityType === EntityType.InstalledComponent) &&
      !isVirtualRow &&
      ind.installations &&
      ind.installations.length > 0
    ) {
      return false;
    }

    // Rule 2: Virtual rows - show only if participating
    if (isVirtualRow) {
      return participatingIds.has(ind.id);
    }

    // Rule 3: Systems - show if participating or if children participate
    if (entityType === EntityType.System) {
      return participatingIds.has(ind.id) || parentSystemsToShow.has(ind.id);
    }

    // Rule 4: Regular individuals (and SC/IC without installations) - show if participating
    return participatingIds.has(ind.id);
  });
}

export default function ActivityDiagramWrap() {
  // compactMode hides individuals that participate in zero activities
  const [compactMode, setCompactMode] = useState(false);
  const model = new Model();
  const [dataset, setDataset] = useState(model);
  // Add a state to track initialization
  const [isInitialized, setIsInitialized] = useState(false);
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
  const [targetSlotId, setTargetSlotId] = useState<string | undefined>(
    undefined
  );

  // State for the SystemComponent editor
  const [showSystemComponentEditor, setShowSystemComponentEditor] =
    useState(false);
  const [selectedSystemComponent, setSelectedSystemComponent] = useState<
    Individual | undefined
  >(undefined);
  const [targetSystemId, setTargetSystemId] = useState<string | undefined>(
    undefined
  );

  const handleOpenSystemComponentInstallation = (individual: Individual) => {
    setSelectedSystemComponent(individual);
    setTargetSystemId(undefined);
    setShowSystemComponentEditor(true);
  };

  const handleOpenInstalledComponentInstallation = (individual: Individual) => {
    setSelectedInstalledComponent(individual);
    setTargetSlotId(undefined);
    setTargetSystemId(undefined);
    setShowInstalledComponentEditor(true);
  };

  useEffect(() => {
    if (dirty) window.addEventListener("beforeunload", beforeUnloadHandler);
    else window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [dirty]);

  // 1. Load diagram from localStorage on mount
  useEffect(() => {
    // Ensure we are in the browser
    if (typeof window !== "undefined") {
      const savedTtl = localStorage.getItem("4d-activity-editor-autosave");
      if (savedTtl) {
        try {
          const loadedModel = load(savedTtl);
          if (loadedModel instanceof Model) {
            setDataset(loadedModel);
            setUndoHistory([]); // Clear undo history on load
          }
        } catch (err) {
          console.error("Failed to load autosave:", err);
        }
      }
      setIsInitialized(true);
    }
  }, []);

  // 2. Save diagram to localStorage whenever dataset changes
  useEffect(() => {
    if (!isInitialized) return;

    // Debounce save to avoid performance hit on every small change
    const timer = setTimeout(() => {
      try {
        const ttl = save(dataset);
        localStorage.setItem("4d-activity-editor-autosave", ttl);
      } catch (err) {
        console.error("Failed to autosave:", err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [dataset, isInitialized]);

  const updateDataset = (updater: Dispatch<Model>) => {
    setUndoHistory([dataset, ...undoHistory.slice(0, 5)]);
    const d = dataset.clone();
    updater(d);
    setDataset(d);
    setDirty(true);
  };
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

  const individualsArray = Array.from(dataset.individuals.values());

  const deleteIndividual = (id: string) => {
    updateDataset((d: Model) => d.removeIndividual(id));
  };
  const setIndividual = (individual: Individual) => {
    updateDataset((d: Model) => d.addIndividual(individual));
  };
  const setActivity = (activity: Activity) => {
    updateDataset((d: Model) => d.addActivity(activity));
  };

  const clickIndividual = (i: any) => {
    const isVirtual = i.id.includes("__installed_in__");

    if (isVirtual) {
      const originalId = i.id.split("__installed_in__")[0];
      const rest = i.id.split("__installed_in__")[1];
      const parts = rest.split("__");
      const targetId = parts[0];

      const originalIndividual = dataset.individuals.get(originalId);
      if (!originalIndividual) return;

      const entityType = originalIndividual.entityType ?? EntityType.Individual;

      if (entityType === EntityType.SystemComponent) {
        setSelectedSystemComponent(originalIndividual);
        setTargetSystemId(targetId);
        setShowSystemComponentEditor(true);
      } else if (entityType === EntityType.InstalledComponent) {
        const contextMatch = i.id.match(/__ctx_([^_]+)$/);
        const contextId = contextMatch ? contextMatch[1] : undefined;

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

  const activitiesArray = Array.from(dataset.activities.values());

  let activitiesInView: Activity[] = [];
  if (activityContext) {
    activitiesInView = activitiesArray.filter(
      (a) => a.partOf === activityContext
    );
  } else {
    activitiesInView = activitiesArray.filter((a) => !a.partOf);
  }

  // Get all participating IDs for current view
  const participatingIds = useMemo(() => {
    const ids = new Set<string>();
    activitiesInView.forEach((a) =>
      a.participations.forEach((p) => ids.add(p.individualId))
    );
    return ids;
  }, [activitiesInView]);

  // Get sorted individuals and apply compact mode filter
  const sortedIndividuals = useMemo(() => {
    const allIndividuals = dataset.getDisplayIndividuals();

    if (compactMode) {
      return filterIndividualsForCompactMode(
        allIndividuals,
        participatingIds,
        dataset
      );
    }

    return allIndividuals;
  }, [dataset, compactMode, participatingIds]);

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

        {/* All buttons in a flex container that wraps */}
        <div
          className="mt-3 d-flex flex-wrap align-items-center justify-content-between gap-2"
          style={{ rowGap: "0.5rem" }}
        >
          {/* Left side buttons */}
          <div className="d-flex flex-wrap align-items-center gap-1">
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
          </div>

          {/* Center - Load/Save TTL */}
          <div className="d-flex justify-content-center">
            <DiagramPersistence
              dataset={dataset}
              setDataset={replaceDataset}
              svgRef={svgRef}
              setDirty={setDirty}
            />
          </div>

          {/* Right side buttons */}
          <div className="d-flex flex-wrap align-items-center gap-1">
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
            <ExportSvg
              dataset={dataset}
              svgRef={svgRef}
              activitiesInView={activitiesInView}
              activityColors={config.presentation.activity.fill}
            />
            <ExportJson dataset={dataset} />
            {/* <ExportJsonLegends
              dataset={dataset}
              activitiesInView={activitiesInView}
              activityColors={config.presentation.activity.fill}
            /> */}
          </div>
        </div>
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
