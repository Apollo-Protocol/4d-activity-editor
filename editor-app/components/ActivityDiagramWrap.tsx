import { useCallback, useEffect, useState, useRef, Dispatch } from "react";
import Link from "next/link";
import { config } from "@/diagram/config";
import SetIndividual from "@/components/SetIndividual";
import SetActivity from "@/components/SetActivity";
import SetConfig from "@/components/SetConfig";
import ActivityDiagram from "@/components/ActivityDiagram";
import Container from "react-bootstrap/Container";
import DiagramPersistence from "@/components/DiagramPersistence";
import SortIndividuals from "./SortIndividuals";
import SetParticipation from "./SetParticipation";
import Undo from "./Undo";
import { Model } from "@/lib/Model";
import { Activity, Id, Individual, Maybe, Participation } from "@/lib/Schema";
import { ENTITY_TYPE_IDS, getEntityTypeIdFromIndividual } from "@/lib/entityTypes";
import {
  getInstallationPeriods,
  normalizeEnd,
  normalizeStart,
  syncLegacyInstallationFields,
} from "@/utils/installations";
import { save as saveTTL, load as loadTTL } from "@/lib/ActivityLib";
import ExportJson from "./ExportJson";
import ExportSvg from "./ExportSvg";
import HideIndividuals from "./HideIndividuals";
import DiagramLegend from "./DiagramLegend";
import EntityTypeLegend from "./EntityTypeLegend";

const SESSION_KEY = "activity-editor-session";

const normalizeConfigData = (storedConfig: Partial<typeof config>) => ({
  ...config,
  ...storedConfig,
  viewPort: {
    ...config.viewPort,
    ...storedConfig.viewPort,
  },
  layout: {
    ...config.layout,
    ...storedConfig.layout,
    individual: {
      ...config.layout.individual,
      ...storedConfig.layout?.individual,
    },
    system: {
      ...config.layout.system,
      ...storedConfig.layout?.system,
    },
  },
  presentation: {
    ...config.presentation,
    ...storedConfig.presentation,
    individual: {
      ...config.presentation.individual,
      ...storedConfig.presentation?.individual,
    },
    activity: {
      ...config.presentation.activity,
      ...storedConfig.presentation?.activity,
    },
    participation: {
      ...config.presentation.participation,
      ...storedConfig.presentation?.participation,
    },
    axis: {
      ...config.presentation.axis,
      ...storedConfig.presentation?.axis,
    },
  },
  labels: {
    ...config.labels,
    ...storedConfig.labels,
    individual: {
      ...config.labels.individual,
      ...storedConfig.labels?.individual,
    },
    activity: {
      ...config.labels.activity,
      ...storedConfig.labels?.activity,
    },
  },
});

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
  const [redoHistory, setRedoHistory] = useState<Model[]>([]);
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
  const [configData, setConfigData] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("activity-editor-config");
        if (stored) return normalizeConfigData(JSON.parse(stored));
      } catch (e) {
        console.warn("Failed to restore config from session map:", e);
      }
    }
    return config;
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSortIndividuals, setShowSortIndividuals] = useState(false);
  const [highlightedActivityId, setHighlightedActivityId] = useState<string | null>(null);

  // Restore from sessionStorage on mount
  const didRestore = useRef(false);
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const restored = loadTTL(stored);
        if (restored instanceof Error) {
          console.warn("Failed to restore session data:", restored);
        } else {
          setDataset(restored);
        }
      }
    } catch (e) {
      console.warn("Failed to read session storage:", e);
    }
  }, []);

  // Persist to sessionStorage whenever dataset changes
  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    try {
      const ttl = saveTTL(dataset);
      sessionStorage.setItem(SESSION_KEY, ttl);
    } catch (e) {
      console.warn("Failed to save session storage:", e);
    }
  }, [dataset]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("activity-editor-config", JSON.stringify(configData));
      } catch (e) {
        console.warn("Failed to save config session storage:", e);
      }
    }
  }, [configData]);

  useEffect(() => {
    if (dirty) window.addEventListener("beforeunload", beforeUnloadHandler);
    else window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [dirty]);

  useEffect(() => {
    setHighlightedActivityId(null);
  }, [activityContext]);

  const updateDataset = useCallback((updater: Dispatch<Model>) => {
    setDataset((prevDataset) => {
      setUndoHistory((prevHistory) => {
        if (prevHistory.length > 0 && prevHistory[0] === prevDataset) return prevHistory;
        return [prevDataset, ...prevHistory.slice(0, 49)];
      });
      setRedoHistory([]);
      const d = prevDataset.clone();
      updater(d);
      setDirty(true);
      return d;
    });
  }, []);
  /* Callers of this function must also handle the dirty flag. */
  const replaceDataset = (d: Model) => {
    setUndoHistory([]);
    setRedoHistory([]);
    setActivityContext(undefined);
    setDataset(d);
  };
  const undo = () => {
    if (undoHistory.length === 0) return;
    const [previousDataset, ...remainingHistory] = undoHistory;
    setRedoHistory((prevHistory) => [dataset, ...prevHistory.slice(0, 49)]);
    setDataset(previousDataset);
    setUndoHistory(remainingHistory);
    setDirty(true);
  };
  const redo = () => {
    if (redoHistory.length === 0) return;
    const [nextDataset, ...remainingHistory] = redoHistory;
    setUndoHistory((prevHistory) => [dataset, ...prevHistory.slice(0, 49)]);
    setDataset(nextDataset);
    setRedoHistory(remainingHistory);
    setDirty(true);
  };
  const clearDiagram = () => {
    replaceDataset(new Model());
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  };

  const svgRef = useRef<SVGSVGElement>(null);

  const deleteIndividual = (id: string) => {
    updateDataset((d: Model) => d.removeIndividual(id));
  };

  const sanitizeAllInstallations = (d: Model) => {
    const allIndividuals = Array.from(d.individuals.values());

    allIndividuals.forEach((individual) => {
      if (getEntityTypeIdFromIndividual(individual) !== ENTITY_TYPE_IDS.INDIVIDUAL) {
        return;
      }

      const ownStart = normalizeStart(individual.beginning);
      const ownEnd = normalizeEnd(individual.ending);

      const sanitizedInstallations = getInstallationPeriods(individual)
        .map((period) => {
          const component = d.individuals.get(period.systemComponentId);
          if (
            !component ||
            getEntityTypeIdFromIndividual(component) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT
          ) {
            return null;
          }

          let validStart = normalizeStart(component.beginning);
          let validEnd = normalizeEnd(component.ending);

          // If component is hosted by a system, installation is only valid while
          // the host system exists.
          if (component.installedIn) {
            const host = d.individuals.get(component.installedIn);
            if (
              host &&
              getEntityTypeIdFromIndividual(host) === ENTITY_TYPE_IDS.SYSTEM
            ) {
              validStart = Math.max(validStart, normalizeStart(host.beginning));
              validEnd = Math.min(validEnd, normalizeEnd(host.ending));
            }
          }

          const beginning = Math.max(period.beginning, validStart, ownStart);
          const ending = Math.min(period.ending, validEnd, ownEnd);

          if (ending <= beginning) {
            return null;
          }

          return {
            ...period,
            beginning,
            ending,
          };
        })
        .filter((period): period is NonNullable<typeof period> => !!period)
        .sort((a, b) => a.beginning - b.beginning);

      const synced = syncLegacyInstallationFields({
        ...individual,
        installations: sanitizedInstallations,
      });

      d.addIndividual(synced);
    });
  };

  const setIndividual = (individual: Individual) => {
    updateDataset((d: Model) => {
      d.addIndividual(individual);
      sanitizeAllInstallations(d);
    });
  };
  const deleteActivity = (id: string) => {
    updateDataset((d: Model) => d.removeActivity(id));
  };
  const setActivity = (activity: Activity) => {
    updateDataset((d: Model) => d.addActivity(activity));
  };

  const clickIndividual = useCallback((i: Individual) => {
    setSelectedIndividual(i);
    setShowIndividual(true);
  }, []);
  const clickActivity = useCallback((a: Activity) => {
    setSelectedActivity(a);
    setShowActivity(true);
  }, []);
  const clickParticipation = useCallback((a: Activity, p: Participation) => {
    setSelectedActivity(a);
    setSelectedParticipation(p);
    setShowParticipation(true);
  }, []);

  const rightClickIndividual = useCallback((i: Individual) => {
    console.log("Individual right clicked. Functionality can be added here.");
  }, []);
  const rightClickActivity = useCallback((a: Activity) => {
    console.log("Activity right clicked. Functionality can be added here.");
  }, []);
  const rightClickParticipation = useCallback((a: Activity, p: Participation) => {
    console.log(
      "Participation right clicked. Functionality can be added here."
    );
  }, []);

  const individualsArray: Individual[] = [];
  dataset.individuals.forEach((i: Individual) => individualsArray.push(i));

  const activitiesArray: Activity[] = [];
  dataset.activities.forEach((a: Activity) => activitiesArray.push(a));

  const reorderIndividuals = useCallback((orderedIds: string[]) => {
    updateDataset((d: Model) => {
      const current = Array.from(d.individuals.values());
      const byId = new Map(current.map((individual) => [individual.id, individual]));
      const seen = new Set<string>();
      const reordered: Individual[] = [];

      orderedIds.forEach((id) => {
        const individual = byId.get(id);
        if (!individual) return;
        reordered.push(individual);
        seen.add(id);
      });

      current.forEach((individual) => {
        if (!seen.has(individual.id)) reordered.push(individual);
      });

      // Normalize: ensure system components stay grouped under their parent system
      const systems = new Set(
        reordered
          .filter((item) => getEntityTypeIdFromIndividual(item) === ENTITY_TYPE_IDS.SYSTEM)
          .map((item) => item.id)
      );

      const componentsBySystem = new Map<string, Individual[]>();
      reordered.forEach((item) => {
        if (getEntityTypeIdFromIndividual(item) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) return;
        if (!item.installedIn || !systems.has(item.installedIn)) return;
        const list = componentsBySystem.get(item.installedIn);
        if (list) list.push(item);
        else componentsBySystem.set(item.installedIn, [item]);
      });

      const normalized: Individual[] = [];
      const emitted = new Set<string>();
      reordered.forEach((item) => {
        if (emitted.has(item.id)) return;
        const type = getEntityTypeIdFromIndividual(item);
        if (
          type === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
          item.installedIn &&
          systems.has(item.installedIn)
        ) {
          return; // will be emitted after parent system
        }
        normalized.push(item);
        emitted.add(item.id);
        if (type === ENTITY_TYPE_IDS.SYSTEM) {
          (componentsBySystem.get(item.id) ?? []).forEach((child) => {
            if (!emitted.has(child.id)) {
              normalized.push(child);
              emitted.add(child.id);
            }
          });
        }
      });

      d.individuals.clear();
      normalized.forEach((individual) => {
        d.individuals.set(individual.id, individual);
      });
    });
  }, [updateDataset]);

  const renameIndividual = useCallback((id: string, newName: string) => {
    updateDataset((d: Model) => {
      const individual = d.individuals.get(id);
      if (individual) {
        d.addIndividual({ ...individual, name: newName });
      }
    });
  }, [updateDataset]);

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

  const selectedActivityIndex = selectedActivity
    ? activitiesInView.findIndex((a) => a.id === selectedActivity.id)
    : -1;
  const selectedActivityAutoColor =
    selectedActivityIndex >= 0
      ? configData.presentation.activity.fill[
          selectedActivityIndex % configData.presentation.activity.fill.length
        ]
      : configData.presentation.activity.fill[
          activitiesInView.length % configData.presentation.activity.fill.length
        ];

  const isDiagramEmpty = dataset.individuals.size === 0 && dataset.activities.size === 0;

  // render
  return (
    <>
      <Container fluid>
        <div className={`editor-layout ${isDiagramEmpty ? "is-empty" : ""}`}>
          <div className="editor-legend">
            <div className="legend-sticky">
              <EntityTypeLegend />
              <DiagramLegend
                activities={activitiesInView}
                activityColors={config.presentation.activity.fill}
                partsCount={partsCountMap}
                onOpenActivity={(a) => {
                  setSelectedActivity(a);
                  setShowActivity(true);
                }}
                highlightedActivityId={highlightedActivityId}
                onHighlightActivity={(id) =>
                  setHighlightedActivityId((prev) => (prev === id ? null : id))
                }
              />
            </div>
          </div>
          <div className="editor-diagram">
            {isDiagramEmpty ? (
              <div className="w-100 h-100 bg-white overflow-auto">
                <div className="container py-3 py-md-4">
                  <div className="empty-state-stage">
                    <div className="empty-state-hero">
                      <div className="bg-light mr-md-3 pt-3 px-3 pt-md-5 px-md-5 text-center overflow-hidden h-100 empty-state-card">
                        <div className="my-3 p-3">
                          <h2 className="display-4">Activity Diagram Editor</h2>
                          <p className="lead">
                            Your diagram is empty, but the canvas does not have to stay quiet for long.
                            Start with an entity, pull in an example, or load a TTL file and bring the model to life.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="empty-state-illustration" aria-hidden="true">
                      <div className="empty-state-board empty-state-board-illustration">
                        <span className="empty-state-board-top">Top</span>
                        <span className="empty-state-board-axis empty-state-board-axis-y"></span>
                        <span className="empty-state-board-axis empty-state-board-axis-x"></span>
                        <span className="empty-state-board-label empty-state-board-label-space">Space</span>
                        <span className="empty-state-board-label empty-state-board-label-time">Time</span>
                        <div className="empty-state-board-chalk" aria-hidden="true">
                          <span className="empty-state-eraser"></span>
                          <span className="empty-state-chalk-stick empty-state-chalk-stick-1"></span>
                          <span className="empty-state-chalk-stick empty-state-chalk-stick-2"></span>
                          <span className="empty-state-chalk-stick empty-state-chalk-stick-3"></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="row pt-3 pt-md-4">
                    <div className="col-md">
                      <div className="bg-light mr-md-3 pt-3 px-3 pt-md-5 px-md-5 text-center overflow-hidden h-100">
                        <div className="my-3 p-3">
                          <h2 className="display-5">Learn</h2>
                          <p className="lead">
                            Read the editor guide to learn terminology, settings,
                            navigation, and how to create your first model.
                          </p>
                          <Link href="/manual" className="btn btn-outline-secondary">
                            Open Editor Guide
                          </Link>
                        </div>
                        <div className="bg-white box-shadow mx-auto"></div>
                      </div>
                    </div>
                    <div className="col-md">
                      <div className="bg-light mr-md-3 pt-3 px-3 pt-md-5 px-md-5 text-center overflow-hidden h-100">
                        <div className="my-3 p-3">
                          <h2 className="display-5">Start Modelling</h2>
                          <p className="lead">
                            Create the first entity or load an existing model to populate the workspace.
                          </p>
                          <div className="empty-state-actions">
                            <SetIndividual
                              deleteIndividual={deleteIndividual}
                              setIndividual={setIndividual}
                              show={showIndividual}
                              setShow={setShowIndividual}
                              selectedIndividual={selectedIndividual}
                              setSelectedIndividual={setSelectedIndividual}
                              dataset={dataset}
                              updateDataset={updateDataset}
                              triggerVariant="outline-secondary"
                              triggerClassName=""
                            />
                            <DiagramPersistence
                              dataset={dataset}
                              setDataset={replaceDataset}
                              svgRef={svgRef}
                              setDirty={setDirty}
                              showSaveButton={false}
                              showReferenceToggle={false}
                              className="empty-persistence"
                              buttonVariant="outline-secondary"
                            />
                          </div>
                        </div>
                        <div className="bg-white box-shadow mx-auto"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <ActivityDiagram
                dataset={dataset}
                configData={configData}
                setConfigData={setConfigData}
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
                highlightedActivityId={highlightedActivityId}
                onReorderIndividuals={reorderIndividuals}
                renameIndividual={renameIndividual}
              />
            )}
          </div>

          <div className={`editor-toolbar ${isDiagramEmpty ? "d-none" : ""}`}>
            <div className="toolbar-group">
            {!isDiagramEmpty && (
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
            )}
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
              autoActivityColor={selectedActivityAutoColor}
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

            <div className="toolbar-group toolbar-center">
              <DiagramPersistence
                dataset={dataset}
                setDataset={replaceDataset}
                svgRef={svgRef}
                setDirty={setDirty}
              />
            </div>

            <div className="toolbar-group">
              <Undo
                hasUndo={undoHistory.length > 0}
                hasRedo={redoHistory.length > 0}
                undo={undo}
                redo={redo}
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
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}