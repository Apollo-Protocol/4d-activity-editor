import { useCallback, useEffect, useState, useRef, Dispatch } from "react";
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
import ExportJson from "./ExportJson";
import ExportSvg from "./ExportSvg";
import HideIndividuals from "./HideIndividuals";
import DiagramLegend from "./DiagramLegend";
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
  const [highlightedActivityId, setHighlightedActivityId] = useState<string | null>(null);

  useEffect(() => {
    if (dirty) window.addEventListener("beforeunload", beforeUnloadHandler);
    else window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [dirty]);

  useEffect(() => {
    setHighlightedActivityId(null);
  }, [activityContext]);

  const updateDataset = useCallback((updater: Dispatch<Model>) => {
    setDataset((prevDataset) => {
      setUndoHistory((prevHistory) => [prevDataset, ...prevHistory.slice(0, 5)]);
      const d = prevDataset.clone();
      updater(d);
      setDirty(true);
      return d;
    });
  }, []);
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
      ? config.presentation.activity.fill[
          selectedActivityIndex % config.presentation.activity.fill.length
        ]
      : config.presentation.activity.fill[0];

  // render
  return (
    <>
      <Container fluid>
        <div className="editor-layout">
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
          </div>

          <div className="editor-toolbar">
            <div className="toolbar-group">
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
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}