import React, { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import DraggableModalDialog from "@/components/DraggableModalDialog";
import Form from "react-bootstrap/Form";
import Table from "react-bootstrap/Table";
import Alert from "react-bootstrap/Alert";
import Card from "react-bootstrap/Card";
import { v4 as uuidv4 } from "uuid";
import { Activity, Individual, InstallationPeriod } from "@/lib/Schema";
import { Model } from "@/lib/Model";
import {
  ENTITY_CATEGORY,
  ENTITY_TYPE_IDS,
  ENTITY_TYPE_OPTIONS,
  getEntityCategoryFromTypeId,
  getEntityTypeIdFromIndividual,
} from "@/lib/entityTypes";
import {
  getInstallationPeriods,
  normalizeEnd,
  normalizeStart,
  syncLegacyInstallationFields,
} from "@/utils/installations";

interface Props {
  deleteIndividual: (id: string) => void;
  setIndividual: (individual: Individual) => void;
  show: boolean;
  setShow: Dispatch<SetStateAction<boolean>>;
  selectedIndividual: Individual | undefined;
  setSelectedIndividual: Dispatch<SetStateAction<Individual | undefined>>;
  dataset: Model;
  updateDataset: Dispatch<Dispatch<Model>>;
}

type InstallationRow = {
  id: string;
  systemComponentId: string;
  beginningText: string;
  endingText: string;
};

type NormalizedInstallationRow = {
  id: string;
  systemComponentId: string;
  beginning: number;
  ending: number;
};

type PendingBoundsChange = {
  periodId: string;
  systemComponentId: string;
  systemComponentName: string;
  parentSystemName?: string;
  fromBeginning: number;
  fromEnding: number;
  toBeginning?: number;
  toEnding?: number;
  action: "trim" | "drop";
};

type AffectedComponent = {
  id: string;
  name: string;
  fromBeginning: number;
  fromEnding: number;
  toBeginning?: number;
  toEnding?: number;
  action: "trim" | "drop";
};

type AffectedInstallation = {
  periodId: string;
  individualId: string;
  individualName: string;
  systemComponentId: string;
  systemComponentName: string;
  fromBeginning: number;
  fromEnding: number;
  toBeginning?: number;
  toEnding?: number;
  action: "trim" | "drop";
};

type AffectedActivity = {
  activityId: string;
  activityName: string;
  /** The individual whose bounds changed, causing this activity to be affected */
  individualId: string;
  individualName: string;
  systemName?: string;
  systemComponentName?: string;
  fromBeginning: number;
  fromEnding: number;
  toBeginning?: number;
  toEnding?: number;
  action: "trim" | "drop";
};

type CascadeWarning = {
  entityName: string;
  affectedComponents: AffectedComponent[];
  affectedInstallations: AffectedInstallation[];
  affectedActivities: AffectedActivity[];
  pendingIndividual: Individual;
  /** Pre-computed model updater that applies the chosen action (trim or remove) */
  applyTrim: () => void;
  applyRemove: () => void;
};

const EMPTY_BEGINNING = "";
const EMPTY_ENDING = "";

const SetIndividual = (props: Props) => {
  const {
    deleteIndividual,
    setIndividual,
    show,
    setShow,
    selectedIndividual,
    setSelectedIndividual,
    dataset,
    updateDataset,
  } = props;

  const defaultIndividual: Individual = {
    id: "",
    name: "",
    type:
      dataset.individualTypes.find((kind) => kind.name === "Resource") ??
      dataset.defaultIndividualType,
    description: "",
    beginning: -1,
    ending: Model.END_OF_TIME,
    beginsWithParticipant: false,
    endsWithParticipant: false,
    installedIn: undefined,
    installedBeginning: undefined,
    installedEnding: undefined,
    installations: [],
    entityType: ENTITY_CATEGORY.INDIVIDUAL,
  };

  const [inputs, setInputs] = useState<Individual>(defaultIndividual);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Custom type selector state
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeValue, setEditingTypeValue] = useState("");
  const typeDropdownRef = React.useRef<HTMLDivElement | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const itemRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  const [beginningText, setBeginningText] = useState(EMPTY_BEGINNING);
  const [endingText, setEndingText] = useState(EMPTY_ENDING);

  const [showInstallationsModal, setShowInstallationsModal] = useState(false);
  const [installationRows, setInstallationRows] = useState<InstallationRow[]>([]);
  const [installationErrors, setInstallationErrors] = useState<string[]>([]);
  const [showBoundsWarningModal, setShowBoundsWarningModal] = useState(false);
  const [pendingSaveIndividual, setPendingSaveIndividual] =
    useState<Individual | null>(null);
  const [pendingRemoveIndividual, setPendingRemoveIndividual] =
    useState<Individual | null>(null);
  const [pendingTrimCount, setPendingTrimCount] = useState(0);
  const [pendingDroppedCount, setPendingDroppedCount] = useState(0);
  const [pendingBoundsChanges, setPendingBoundsChanges] = useState<PendingBoundsChange[]>([]);
  const [pendingAffectedActivities, setPendingAffectedActivities] = useState<AffectedActivity[]>([]);

  const [showCascadeWarningModal, setShowCascadeWarningModal] = useState(false);
  const [cascadeWarning, setCascadeWarning] = useState<CascadeWarning | null>(null);

  const isEditMode = !!selectedIndividual;
  const selectedEntityTypeId = getEntityTypeIdFromIndividual(inputs);

  const systems = useMemo(
    () =>
      Array.from(dataset.individuals.values()).filter(
        (individual) =>
          individual.id !== inputs.id &&
          getEntityTypeIdFromIndividual(individual) === ENTITY_TYPE_IDS.SYSTEM
      ),
    [dataset.individuals, inputs.id]
  );

  const systemComponents = useMemo(
    () =>
      Array.from(dataset.individuals.values()).filter(
        (individual) =>
          individual.id !== inputs.id &&
          getEntityTypeIdFromIndividual(individual) ===
            ENTITY_TYPE_IDS.SYSTEM_COMPONENT
      ),
    [dataset.individuals, inputs.id]
  );

  const selectedParentSystem = useMemo(
    () =>
      inputs.installedIn ? dataset.individuals.get(inputs.installedIn) : undefined,
    [dataset.individuals, inputs.installedIn]
  );

  const systemComponentSlotHints = useMemo(() => {
    if (!selectedParentSystem) return null;

    const systemStart = normalizeStart(selectedParentSystem.beginning);
    const systemEnd = normalizeEnd(selectedParentSystem.ending);

    return {
      bounds: `${systemStart}-${
        systemEnd >= Model.END_OF_TIME ? "∞" : String(systemEnd)
      }`,
    };
  }, [selectedParentSystem]);

  const asInputText = (value: number, isBeginning: boolean) => {
    if (isBeginning && value <= 0) return "0";
    if (!isBeginning && (value <= 0 || value >= Model.END_OF_TIME)) return "";
    return String(value);
  };

  const formatBound = (value: number, isBeginning: boolean) => {
    if (isBeginning && value <= 0) return "0";
    if (!isBeginning && value >= Model.END_OF_TIME) return "∞";
    return String(value);
  };

  /**
   * Find activities that have participations with a given individual whose
   * activity bounds exceed the individual's new bounds AND the situation is
   * worse than the old bounds (i.e. the new bounds are more restrictive).
   * @param entityId  The individual whose bounds changed
   * @param entityName  Friendly name for the individual  
   * @param newStart  The new normalized start bound for the entity
   * @param newEnd    The new normalized end bound for the entity
   * @param oldStart  The old normalized start bound for the entity
   * @param oldEnd    The old normalized end bound for the entity
   */
  const findAffectedActivities = (
    entityId: string,
    entityName: string,
    newStart: number,
    newEnd: number,
    oldStart?: number,
    oldEnd?: number,
  ): AffectedActivity[] => {
    const result: AffectedActivity[] = [];
    for (const act of Array.from(dataset.activities.values())) {
      if (!act.participations.has(entityId)) continue;
      const actStart = normalizeStart(act.beginning);
      const actEnd = normalizeEnd(act.ending);
      const clampedStart = Math.max(actStart, newStart);
      const clampedEnd = Math.min(actEnd, newEnd);

      // If old bounds were provided, compute what the clamp was before.
      // Only warn if the new bounds are MORE restrictive than the old bounds
      // for this activity (i.e. expanding bounds should never trigger a warning).
      if (oldStart !== undefined && oldEnd !== undefined) {
        const oldClampedStart = Math.max(actStart, oldStart);
        const oldClampedEnd = Math.min(actEnd, oldEnd);
        // New clamp is at least as permissive as old clamp → skip
        if (clampedStart <= oldClampedStart && clampedEnd >= oldClampedEnd) continue;
      }

      if (clampedEnd <= clampedStart) {
        result.push({
          activityId: act.id,
          activityName: act.name,
          individualId: entityId,
          individualName: entityName,
          fromBeginning: act.beginning,
          fromEnding: act.ending,
          action: "drop",
        });
      } else if (clampedStart !== actStart || clampedEnd !== actEnd) {
        result.push({
          activityId: act.id,
          activityName: act.name,
          individualId: entityId,
          individualName: entityName,
          fromBeginning: act.beginning,
          fromEnding: act.ending,
          toBeginning: clampedStart,
          toEnding: clampedEnd,
          action: "trim",
        });
      }
    }
    return result;
  };

  const parseBoundary = (text: string, isBeginning: boolean) => {
    if (text.trim() === "") {
      return isBeginning ? -1 : Model.END_OF_TIME;
    }
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) {
      return isBeginning ? -1 : Model.END_OF_TIME;
    }
    if (isBeginning && numeric <= 0) {
      return -1;
    }
    if (!isBeginning && numeric <= 0) {
      return Model.END_OF_TIME;
    }
    return Math.trunc(numeric);
  };

  const updateInputs = (key: keyof Individual, value: any) => {
    setInputs((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  };

  const handleClose = () => {
    setShow(false);
    setSelectedIndividual(undefined);
    setInputs(defaultIndividual);
    setDirty(false);
    setErrors([]);
    setBeginningText(EMPTY_BEGINNING);
    setEndingText(EMPTY_ENDING);
    setInstallationRows([]);
    setInstallationErrors([]);
    setShowInstallationsModal(false);
    setShowBoundsWarningModal(false);
    setPendingSaveIndividual(null);
    setPendingRemoveIndividual(null);
    setPendingTrimCount(0);
    setPendingDroppedCount(0);
    setPendingBoundsChanges([]);
    setPendingAffectedActivities([]);
    setShowCascadeWarningModal(false);
    setCascadeWarning(null);
    
    setTypeOpen(false);
    setTypeSearch("");
    setEditingTypeId(null);
    setEditingTypeValue("");
  };

  const handleModalHide = () => {
    if (editingTypeId) {
      return;
    }
    handleClose();
  };

  const commitIndividualSave = (next: Individual) => {
    setIndividual(next);
    handleClose();
  };

  const handleShow = () => {
    const base = selectedIndividual
      ? { ...selectedIndividual }
      : { ...defaultIndividual, id: uuidv4() };

    const category =
      base.entityType ??
      getEntityCategoryFromTypeId(getEntityTypeIdFromIndividual(base));

    const normalized = syncLegacyInstallationFields({
      ...base,
      entityType: category,
      installations: getInstallationPeriods(base),
    });

    if (getEntityTypeIdFromIndividual(normalized) === ENTITY_TYPE_IDS.INDIVIDUAL) {
      const hasParticipants = dataset.hasParticipants(normalized.id);
      if (hasParticipants) {
        const earliestBeginning = dataset.earliestParticipantBeginning(normalized.id);
        const latestEnding = dataset.lastParticipantEnding(normalized.id);

        if (
          normalized.beginning >= 0 &&
          !normalized.beginsWithParticipant &&
          normalized.beginning === earliestBeginning
        ) {
          normalized.beginsWithParticipant = true;
        }

        if (
          normalized.ending < Model.END_OF_TIME &&
          !normalized.endsWithParticipant &&
          normalized.ending === latestEnding
        ) {
          normalized.endsWithParticipant = true;
        }
      }
    }

    setInputs(normalized);
    setBeginningText(asInputText(normalized.beginning, true));
    setEndingText(asInputText(normalized.ending, false));
    setDirty(false);
    setErrors([]);
    setTypeOpen(false);
  };

  useEffect(() => {
    if (!show) return;
    handleShow();
  }, [show]);

  // Handle click outside type dropdown
  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(ev.target as Node)
      ) {
        setTypeOpen(false);
        setEditingTypeId(null);
        setEditingTypeValue("");
      }
    }
    if (typeOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [typeOpen]);

  // Ensure a highlighted item is visible when changed
  useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      const el = itemRefs.current[highlightedIndex];
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleChangeText = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateInputs(e.target.name as keyof Individual, e.target.value);
  };

  const handleBeginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextText = e.target.value;
    setBeginningText(nextText);
    updateInputs("beginning", parseBoundary(nextText, true));
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextText = e.target.value;
    setEndingText(nextText);
    updateInputs("ending", parseBoundary(nextText, false));
  };

  // ----- New helper functions for custom TYPE selector -----
  const filteredTypes = dataset.individualTypes.filter((t) =>
    t.name.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const showCreateTypeOption =
    typeSearch.trim().length > 0 &&
    !dataset.individualTypes.some(
      (t) => t.name.toLowerCase() === typeSearch.trim().toLowerCase()
    );

  const handleSelectType = (typeId: string) => {
    const t = dataset.individualTypes.find((x) => x.id === typeId);
    if (t) updateInputs("type", t);
    setTypeOpen(false);
    setTypeSearch("");
    setEditingTypeId(null);
    setEditingTypeValue("");
  };

  const moveHighlight = (delta: number) => {
    if (filteredTypes.length === 0) return;
    setHighlightedIndex((prev) => {
      let next = prev + delta;
      if (next < 0) next = filteredTypes.length - 1;
      if (next >= filteredTypes.length) next = 0;
      return next;
    });
  };

  const selectHighlighted = () => {
    if (highlightedIndex >= 0 && highlightedIndex < filteredTypes.length) {
      handleSelectType(filteredTypes[highlightedIndex].id);
    }
  };

  const handleCreateTypeFromSearch = () => {
    const name = typeSearch.trim();
    if (!name) return;
    const newId = uuidv4();

    updateDataset((d) => {
      d.addIndividualType(newId, name);
      return d;
    });

    // Immediately select the newly created type for this form
    updateInputs("type", { id: newId, name });
    setTypeOpen(false);
    setTypeSearch("");
  };

  const startEditType = (typeId: string, currentName: string, e: any) => {
    e.stopPropagation();
    setEditingTypeId(typeId);
    setEditingTypeValue(currentName);
  };

  const saveEditType = () => {
    if (!editingTypeId) return;
    const newName = editingTypeValue.trim();
    if (!newName) return;

    updateDataset((d) => {
      const existing = d.individualTypes.find(t => t.id === editingTypeId);
      if (existing) existing.name = newName;

      // Update individuals that use this type to reference the canonical Type object
      d.individuals.forEach((ind) => {
        if (ind.type && ind.type.id === editingTypeId) {
          const canonical = d.individualTypes.find((x) => x.id === editingTypeId);
          if (canonical) ind.type = canonical;
        }
      });
      
      if (d.defaultIndividualType && d.defaultIndividualType.id === editingTypeId) {
         const canonical = d.individualTypes.find((x) => x.id === editingTypeId);
         if (canonical) d.defaultIndividualType = canonical;
      }
      return d;
    });

    // Also update current inputs if it was the selected type
    if (inputs.type && inputs.type.id === editingTypeId) {
       updateInputs("type", { id: editingTypeId, name: newName });
    }

    setEditingTypeId(null);
    setEditingTypeValue("");
  };

  const cancelEditType = () => {
    setEditingTypeId(null);
    setEditingTypeValue("");
  };
  // ----- end helpers -----

  const handleEntityType = (typeId: string) => {
    if (isEditMode) return;

    const category = getEntityCategoryFromTypeId(typeId);
    setInputs((previous) => {
      const next: Individual = {
        ...previous,
        entityType: category,
      };
      if (typeId !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        next.installedIn = undefined;
      }
      if (typeId !== ENTITY_TYPE_IDS.INDIVIDUAL) {
        next.installations = [];
        next.installedIn = undefined;
        next.installedBeginning = undefined;
        next.installedEnding = undefined;
      }
      return next;
    });
    setDirty(true);
  };

  const validateMainInputs = () => {
    const runningErrors: string[] = [];

    if (!inputs.name?.trim()) {
      runningErrors.push("Name field is required");
    }

    if (!inputs.type) {
      runningErrors.push("Type field is required");
    }

    if (
      Number.isFinite(inputs.beginning) &&
      Number.isFinite(inputs.ending) &&
      inputs.beginning >= 0 &&
      inputs.ending < Model.END_OF_TIME &&
      inputs.ending <= inputs.beginning
    ) {
      runningErrors.push("Ending must be after Beginning");
    }

    if (selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
      if (!inputs.installedIn) {
        runningErrors.push("System Component must be installed to a System");
      } else {
        const parentSystem = dataset.individuals.get(inputs.installedIn);
        if (
          !parentSystem ||
          getEntityTypeIdFromIndividual(parentSystem) !== ENTITY_TYPE_IDS.SYSTEM
        ) {
          runningErrors.push("System Component can only be installed into a System");
        } else {
          const parentStart = normalizeStart(parentSystem.beginning);
          const parentEnd = normalizeEnd(parentSystem.ending);
          const ownStart = normalizeStart(inputs.beginning);
          const ownEnd = normalizeEnd(inputs.ending);

          if (ownStart < parentStart) {
            runningErrors.push(
              `System Component beginning must be within ${parentSystem.name}`
            );
          }
        }
      }
    }

    if (runningErrors.length > 0) {
      setErrors(runningErrors);
      return false;
    }

    setErrors([]);
    return true;
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty) {
      handleClose();
      return;
    }

    if (!validateMainInputs()) return;

    let next = { ...inputs };

    if (selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL) {
      const originalPeriods = getInstallationPeriods(next);
      let periods = originalPeriods;
      const ownStart = normalizeStart(next.beginning);
      const ownEnd = normalizeEnd(next.ending);
      const existingInd = dataset.individuals.get(next.id);
      const oldOwnStart = existingInd ? normalizeStart(existingInd.beginning) : ownStart;
      const oldOwnEnd = existingInd ? normalizeEnd(existingInd.ending) : ownEnd;
      let trimmedCount = 0;
      let droppedCount = 0;
      const boundsChanges: PendingBoundsChange[] = [];

      periods = periods
        .map((period) => {
          const component = dataset.individuals.get(period.systemComponentId);
          const parentSystem = component?.installedIn
            ? dataset.individuals.get(component.installedIn)
            : undefined;
          const systemComponentName = component?.name ?? period.systemComponentId;

          const beginning = Math.max(period.beginning, ownStart);
          const ending = Math.min(period.ending, ownEnd);

          if (ending <= beginning) {
            droppedCount += 1;
            boundsChanges.push({
              periodId: period.id,
              systemComponentId: period.systemComponentId,
              systemComponentName,
              parentSystemName: parentSystem?.name,
              fromBeginning: period.beginning,
              fromEnding: period.ending,
              action: "drop",
            });
            return null;
          }

          if (beginning !== period.beginning || ending !== period.ending) {
            trimmedCount += 1;
            boundsChanges.push({
              periodId: period.id,
              systemComponentId: period.systemComponentId,
              systemComponentName,
              parentSystemName: parentSystem?.name,
              fromBeginning: period.beginning,
              fromEnding: period.ending,
              toBeginning: beginning,
              toEnding: ending,
              action: "trim",
            });
          }

          return {
            ...period,
            beginning,
            ending,
          };
        })
        .filter((period): period is InstallationPeriod => !!period);

      if (trimmedCount > 0 || droppedCount > 0) {

        // Also check activities that participate this individual
        const indAffectedActivities = findAffectedActivities(next.id, next.name, ownStart, ownEnd, oldOwnStart, oldOwnEnd);

        const pending = syncLegacyInstallationFields({
          ...next,
          // Clear legacy fields so getInstallationPeriods inside sync
          // doesn't fall back to them and resurrect dropped periods.
          installedIn: undefined,
          installedBeginning: undefined,
          installedEnding: undefined,
          installations: periods,
        });

        const affectedPeriodIds = new Set(boundsChanges.map((change) => change.periodId));
        const removeAllAffectedPeriods = originalPeriods.filter(
          (period) => !affectedPeriodIds.has(period.id)
        );
        const pendingRemoveAll = syncLegacyInstallationFields({
          ...next,
          installedIn: undefined,
          installedBeginning: undefined,
          installedEnding: undefined,
          installations: removeAllAffectedPeriods,
        });

        setPendingSaveIndividual(pending);
        setPendingRemoveIndividual(pendingRemoveAll);
        setPendingTrimCount(trimmedCount);
        setPendingDroppedCount(droppedCount);
        setPendingBoundsChanges(boundsChanges);
        setPendingAffectedActivities(indAffectedActivities);
        setShowBoundsWarningModal(true);
        return;
      }

      // Even without installation changes, check for affected activities
      {
        const indAffectedActivities = findAffectedActivities(next.id, next.name, ownStart, ownEnd, oldOwnStart, oldOwnEnd);
        if (indAffectedActivities.length > 0) {
          const pending = syncLegacyInstallationFields({
            ...next,
            installedIn: undefined,
            installedBeginning: undefined,
            installedEnding: undefined,
            installations: periods,
          });
          setPendingSaveIndividual(pending);
          setPendingRemoveIndividual(pending);
          setPendingTrimCount(0);
          setPendingDroppedCount(0);
          setPendingBoundsChanges([]);
          setPendingAffectedActivities(indAffectedActivities);
          setShowBoundsWarningModal(true);
          return;
        }
      }

      next = syncLegacyInstallationFields({
        ...next,
        installedIn: undefined,
        installedBeginning: undefined,
        installedEnding: undefined,
        installations: periods,
      });
    } else {
      next = {
        ...next,
        installations: [],
        installedBeginning: undefined,
        installedEnding: undefined,
      };
      if (selectedEntityTypeId !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        next.installedIn = undefined;
      }

      // --- Cascade detection for SYSTEM and SYSTEM_COMPONENT ---
      const newStart = normalizeStart(next.beginning);
      const newEnd = normalizeEnd(next.ending);

      if (
        selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM &&
        isEditMode
      ) {
        // Get the old system bounds to detect trivial start-date propagation
        const oldSystem = dataset.individuals.get(next.id);
        const oldStart = oldSystem ? normalizeStart(oldSystem.beginning) : 0;

        const affectedComps: AffectedComponent[] = [];
        const affectedInstalls: AffectedInstallation[] = [];
        // Components that only need their 0-start bumped to the new system start
        const silentCompTrims: AffectedComponent[] = [];

        // Find child system components whose bounds exceed the new system bounds
        const childComponents = Array.from(dataset.individuals.values()).filter(
          (ind) =>
            ind.installedIn === next.id &&
            getEntityTypeIdFromIndividual(ind) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT
        );

        for (const comp of childComponents) {
          const compStart = normalizeStart(comp.beginning);
          const compEnd = normalizeEnd(comp.ending);

          // If the component's ending is infinity, keep it as infinity
          // regardless of the system's new bounds.
          const compEndIsInfinity = comp.ending >= Model.END_OF_TIME;

          const clampedStart = Math.max(compStart, newStart);
          const clampedEnd = compEndIsInfinity ? compEnd : Math.min(compEnd, newEnd);

          // Preserve original raw values when the normalized value didn't change
          // e.g. beginning:-1 (infinite past) normalizes to 0, so if clamped to 0
          // we keep -1 to preserve the visual open-start rendering.
          const rawClampedStart = clampedStart === compStart ? comp.beginning : clampedStart;
          const rawClampedEnd = clampedEnd === compEnd ? comp.ending : clampedEnd;

          if (clampedEnd <= clampedStart) {
            // Component falls entirely outside new bounds
            affectedComps.push({
              id: comp.id,
              name: comp.name,
              fromBeginning: comp.beginning,
              fromEnding: comp.ending,
              action: "drop",
            });

            // All installations referencing this component are also dropped
            for (const ind of Array.from(dataset.individuals.values())) {
              const periods = getInstallationPeriods(ind);
              for (const p of periods) {
                if (p.systemComponentId === comp.id) {
                  affectedInstalls.push({
                    periodId: p.id,
                    individualId: ind.id,
                    individualName: ind.name,
                    systemComponentId: comp.id,
                    systemComponentName: comp.name,
                    fromBeginning: p.beginning,
                    fromEnding: p.ending,
                    action: "drop",
                  });
                }
              }
            }
          } else {
            const compTrimmed = clampedStart !== compStart || clampedEnd !== compEnd;
            if (compTrimmed) {
              // Detect trivial start-date propagation: old system start was 0,
              // component also started at 0, and only the start is changing.
              const isTrivialStartBump =
                oldStart === 0 &&
                compStart === 0 &&
                clampedStart !== compStart &&
                clampedEnd === compEnd;

              const entry: AffectedComponent = {
                id: comp.id,
                name: comp.name,
                fromBeginning: comp.beginning,
                fromEnding: comp.ending,
                toBeginning: rawClampedStart,
                toEnding: rawClampedEnd,
                action: "trim",
              };

              if (isTrivialStartBump) {
                silentCompTrims.push(entry);
              } else {
                affectedComps.push(entry);
              }
            }

            // Check installations referencing this component
            // They are always clamped to the intersection of the component bounds
            // and the system's new bounds (even when the component itself keeps infinity).
            const effectiveCompStart = Math.max(compTrimmed ? clampedStart : compStart, newStart);
            const effectiveCompEnd = Math.min(compTrimmed ? clampedEnd : compEnd, newEnd);

            // Whether this component was silently trimmed (trivial start bump)
            const compIsSilent = silentCompTrims.some((c) => c.id === comp.id);

            for (const ind of Array.from(dataset.individuals.values())) {
              const periods = getInstallationPeriods(ind);
              for (const p of periods) {
                if (p.systemComponentId === comp.id) {
                  const pStart = Math.max(p.beginning, effectiveCompStart);
                  const pEnd = Math.min(p.ending, effectiveCompEnd);

                  if (pEnd <= pStart) {
                    affectedInstalls.push({
                      periodId: p.id,
                      individualId: ind.id,
                      individualName: ind.name,
                      systemComponentId: comp.id,
                      systemComponentName: comp.name,
                      fromBeginning: p.beginning,
                      fromEnding: p.ending,
                      action: "drop",
                    });
                  } else if (pStart !== p.beginning || pEnd !== p.ending) {
                    // Trivial: installation start was 0, only start changed,
                    // and the owning component is also a silent trim
                    const installIsTrivial =
                      compIsSilent &&
                      oldStart === 0 &&
                      p.beginning === 0 &&
                      pStart !== p.beginning &&
                      pEnd === p.ending;

                    if (!installIsTrivial) {
                      affectedInstalls.push({
                        periodId: p.id,
                        individualId: ind.id,
                        individualName: ind.name,
                        systemComponentId: comp.id,
                        systemComponentName: comp.name,
                        fromBeginning: p.beginning,
                        fromEnding: p.ending,
                        toBeginning: pStart,
                        toEnding: pEnd,
                        action: "trim",
                      });
                    }
                  }
                }
              }
            }
          }
        }

        // If there are non-trivial affected items, include silent trims in the affected list
        if (silentCompTrims.length > 0 && (affectedComps.length > 0 || affectedInstalls.length > 0)) {
          affectedComps.push(...silentCompTrims);
        }

        // Check activities that participate the system or any of its child components or installed individuals
        const affectedActivities: AffectedActivity[] = [];
        // Activities participating the system itself
        const oldEnd = oldSystem ? normalizeEnd(oldSystem.ending) : newEnd;
        affectedActivities.push(...findAffectedActivities(next.id, next.name, newStart, newEnd, oldStart, oldEnd));
        // Activities participating child components
        const allCompEntries = [...affectedComps, ...silentCompTrims];
        for (const comp of childComponents) {
          const compFinalStart = (() => {
            const ac = allCompEntries.find((c) => c.id === comp.id);
            return ac?.toBeginning !== undefined ? normalizeStart(ac.toBeginning) : normalizeStart(comp.beginning);
          })();
          const compFinalEnd = (() => {
            const ac = allCompEntries.find((c) => c.id === comp.id);
            if (ac?.action === "drop") return 0; // component will be dropped
            return ac?.toEnding !== undefined ? normalizeEnd(ac.toEnding) : normalizeEnd(comp.ending);
          })();
          
          const compEffStart = Math.max(compFinalStart, newStart);
          const compEffEnd = Math.min(compFinalEnd, newEnd);
          const oldCompEffStart = Math.max(normalizeStart(comp.beginning), oldStart);
          const oldCompEffEnd = Math.min(normalizeEnd(comp.ending), oldEnd);

          if (compEffEnd > compEffStart) {
            affectedActivities.push(...findAffectedActivities(comp.id, comp.name, compEffStart, compEffEnd, oldCompEffStart, oldCompEffEnd).map(a => ({...a, systemName: next.name})));
          } else {
            affectedActivities.push(...findAffectedActivities(comp.id, comp.name, compEffStart, compEffStart, oldCompEffStart, oldCompEffEnd).map(a => ({...a, systemName: next.name})));
          }

          // Activities participating individuals installed in this component
          for (const ind of Array.from(dataset.individuals.values())) {
            const periods = getInstallationPeriods(ind);
            const isInstalledInComp = periods.some((p) => p.systemComponentId === comp.id);
            if (!isInstalledInComp) continue;
            // The individual's effective bounds are clamped to the component's final effective bounds
            const indStart = normalizeStart(ind.beginning);
            const indEnd = normalizeEnd(ind.ending);
            const indEffStart = Math.max(indStart, compEffStart);
            const indEffEnd = Math.min(indEnd, compEffEnd);
            const oldIndEffStart = Math.max(indStart, oldCompEffStart);
            const oldIndEffEnd = Math.min(indEnd, oldCompEffEnd);

            if (indEffEnd > indEffStart) {
              affectedActivities.push(...findAffectedActivities(ind.id, ind.name, indEffStart, indEffEnd, oldIndEffStart, oldIndEffEnd).map(a => ({...a, systemName: next.name, systemComponentName: comp.name})));
            } else {
              affectedActivities.push(...findAffectedActivities(ind.id, ind.name, indEffStart, indEffStart, oldIndEffStart, oldIndEffEnd).map(a => ({...a, systemName: next.name, systemComponentName: comp.name})));
            }
          }
        }
        // De-duplicate by activityId (activity may participate multiple affected entities)
        const seenActivityIds = new Set<string>();
        const dedupedActivities = affectedActivities.filter((aa) => {
          if (seenActivityIds.has(aa.activityId)) return false;
          seenActivityIds.add(aa.activityId);
          return true;
        });

        // Auto-apply any silent component trims without a warning (only if no other items affected)
        if (silentCompTrims.length > 0 && affectedComps.length === 0 && affectedInstalls.length === 0 && dedupedActivities.length === 0) {
          // All affected items are trivial — apply silently
          updateDataset((d: Model) => {
            d.addIndividual(next);
            for (const sc of silentCompTrims) {
              const comp = d.individuals.get(sc.id);
              if (comp && sc.toBeginning !== undefined && sc.toEnding !== undefined) {
                d.addIndividual({ ...comp, beginning: sc.toBeginning, ending: sc.toEnding });
              }
            }
            // Also bump installations whose start matched 0
            const silentCompIds = new Set(silentCompTrims.map((c) => c.id));
            for (const ind of Array.from(d.individuals.values())) {
              const periods = getInstallationPeriods(ind);
              let changed = false;
              const updated = periods.map((p) => {
                if (!silentCompIds.has(p.systemComponentId)) return p;
                const cStart = Math.max(p.beginning, newStart);
                const cEnd = Math.min(p.ending, newEnd);
                if (cEnd <= cStart) { changed = true; return null; }
                if (cStart !== p.beginning || cEnd !== p.ending) {
                  changed = true;
                  return { ...p, beginning: cStart, ending: cEnd };
                }
                return p;
              }).filter((p): p is InstallationPeriod => !!p);
              if (changed) {
                d.addIndividual(syncLegacyInstallationFields({
                  ...ind,
                  installedIn: undefined,
                  installedBeginning: undefined,
                  installedEnding: undefined,
                  installations: updated,
                }));
              }
            }
          });
          handleClose();
          return;
        }

        // Include silent trims in the warning if we still have non-trivial items
        if (silentCompTrims.length > 0 && affectedComps.length === 0) {
          affectedComps.push(...silentCompTrims);
        }

        if (affectedComps.length > 0 || affectedInstalls.length > 0 || dedupedActivities.length > 0) {
          const pending = { ...next };
          setCascadeWarning({
            entityName: next.name,
            affectedComponents: affectedComps,
            affectedInstallations: affectedInstalls,
            affectedActivities: dedupedActivities,
            pendingIndividual: pending,
            applyTrim: () => {
              // Do everything in one atomic updateDataset call
              updateDataset((d: Model) => {
                // Save the system itself
                d.addIndividual(pending);

                // Trim or drop affected components
                for (const ac of affectedComps) {
                  const comp = d.individuals.get(ac.id);
                  if (!comp) continue;
                  if (ac.action === "trim" && ac.toBeginning !== undefined && ac.toEnding !== undefined) {
                    // Update bounds directly — do NOT call syncLegacyInstallationFields
                    // because it would wipe `installedIn` (the parent system reference).
                    d.addIndividual({
                      ...comp,
                      beginning: ac.toBeginning,
                      ending: ac.toEnding,
                    });
                  }
                  if (ac.action === "drop") {
                    d.individuals.delete(ac.id);
                  }
                }

                // Trim affected installations on the individuals that own them
                const installsByIndividual = new Map<string, AffectedInstallation[]>();
                for (const ai of affectedInstalls) {
                  const list = installsByIndividual.get(ai.individualId) ?? [];
                  list.push(ai);
                  installsByIndividual.set(ai.individualId, list);
                }

                Array.from(installsByIndividual.entries()).forEach(([indId, affectedPeriods]) => {
                  const ind = d.individuals.get(indId);
                  if (!ind) return;
                  const droppedCompIds = new Set(
                    affectedComps.filter((c) => c.action === "drop").map((c) => c.id)
                  );
                  let periods = getInstallationPeriods(ind)
                    // Remove periods for dropped components
                    .filter((p) => !droppedCompIds.has(p.systemComponentId));

                  periods = periods.map((p) => {
                    const match = affectedPeriods.find((a: AffectedInstallation) => a.periodId === p.id);
                    if (match && match.action === "trim" && match.toBeginning !== undefined && match.toEnding !== undefined) {
                      return { ...p, beginning: match.toBeginning, ending: match.toEnding };
                    }
                    // Drop periods that would be removed
                    if (match && match.action === "drop") return null;
                    return p;
                  }).filter((p): p is InstallationPeriod => !!p);

                  d.addIndividual(syncLegacyInstallationFields({
                    ...ind,
                    installedIn: undefined,
                    installedBeginning: undefined,
                    installedEnding: undefined,
                    installations: periods,
                  }));
                });

                // Remove participations for affected activities (drop only)
                for (const aa of affectedActivities) {
                  if (aa.action !== "drop") continue;
                  const act = d.activities.get(aa.activityId);
                  if (act) act.participations.delete(aa.individualId);
                }

                return d;
              });

              setShowCascadeWarningModal(false);
              setCascadeWarning(null);
              handleClose();
            },
            applyRemove: () => {
              updateDataset((d: Model) => {
                // Save the system itself
                d.addIndividual(pending);

                // Remove dropped components entirely
                const droppedCompIds = new Set(
                  affectedComps.filter((c) => c.action === "drop").map((c) => c.id)
                );
                Array.from(droppedCompIds).forEach((compId) => {
                  d.individuals.delete(compId);
                });

                // Remove ALL affected installations (both trimmed and dropped)
                const installsToRemove = new Set(affectedInstalls.map((ai) => ai.periodId));

                // Also any installations referencing dropped components
                for (const ind of Array.from(d.individuals.values())) {
                  const periods = getInstallationPeriods(ind);
                  const hasAffected = periods.some(
                    (p) => installsToRemove.has(p.id) || droppedCompIds.has(p.systemComponentId)
                  );
                  if (hasAffected) {
                    const kept = periods.filter(
                      (p) => !installsToRemove.has(p.id) && !droppedCompIds.has(p.systemComponentId)
                    );
                    d.addIndividual(syncLegacyInstallationFields({
                      ...ind,
                      installedIn: undefined,
                      installedBeginning: undefined,
                      installedEnding: undefined,
                      installations: kept,
                    }));
                  }
                }

                // Remove all affected participations
                for (const aa of affectedActivities) {
                  const act = d.activities.get(aa.activityId);
                  if (act) act.participations.delete(aa.individualId);
                }

                return d;
              });

              setShowCascadeWarningModal(false);
              setCascadeWarning(null);
              handleClose();
            },
          });
          setShowCascadeWarningModal(true);
          return;
        }
      }

      if (
        selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
        isEditMode
      ) {
        // Compute effective bounds: intersection of component bounds and parent system bounds
        let effectiveStart = newStart;
        let effectiveEnd = newEnd;
        if (next.installedIn) {
          const parentSystem = dataset.individuals.get(next.installedIn);
          if (parentSystem && getEntityTypeIdFromIndividual(parentSystem) === ENTITY_TYPE_IDS.SYSTEM) {
            effectiveStart = Math.max(effectiveStart, normalizeStart(parentSystem.beginning));
            effectiveEnd = Math.min(effectiveEnd, normalizeEnd(parentSystem.ending));
          }
        }

        const affectedInstalls: AffectedInstallation[] = [];

        // Find all installations across all individuals that reference this component
        for (const ind of Array.from(dataset.individuals.values())) {
          const periods = getInstallationPeriods(ind);
          for (const p of periods) {
            if (p.systemComponentId === next.id) {
              const pStart = Math.max(p.beginning, effectiveStart);
              const pEnd = Math.min(p.ending, effectiveEnd);

              // Preserve raw values when normalized value didn't change
              const rawPStart = pStart === p.beginning ? p.beginning : pStart;
              const rawPEnd = pEnd === p.ending ? p.ending : pEnd;

              if (pEnd <= pStart) {
                affectedInstalls.push({
                  periodId: p.id,
                  individualId: ind.id,
                  individualName: ind.name,
                  systemComponentId: next.id,
                  systemComponentName: next.name,
                  fromBeginning: p.beginning,
                  fromEnding: p.ending,
                  action: "drop",
                });
              } else if (pStart !== p.beginning || pEnd !== p.ending) {
                affectedInstalls.push({
                  periodId: p.id,
                  individualId: ind.id,
                  individualName: ind.name,
                  systemComponentId: next.id,
                  systemComponentName: next.name,
                  fromBeginning: p.beginning,
                  fromEnding: p.ending,
                  toBeginning: rawPStart,
                  toEnding: rawPEnd,
                  action: "trim",
                });
              }
            }
          }
        }

        // Check activities that participate the system component
        const existingComp = dataset.individuals.get(next.id);
        let oldEffStart = existingComp ? normalizeStart(existingComp.beginning) : effectiveStart;
        let oldEffEnd = existingComp ? normalizeEnd(existingComp.ending) : effectiveEnd;
        let parentSystemName = undefined;
        if (existingComp?.installedIn) {
          const parentSystem = dataset.individuals.get(existingComp.installedIn);
          if (parentSystem && getEntityTypeIdFromIndividual(parentSystem) === ENTITY_TYPE_IDS.SYSTEM) {
            oldEffStart = Math.max(oldEffStart, normalizeStart(parentSystem.beginning));
            oldEffEnd = Math.min(oldEffEnd, normalizeEnd(parentSystem.ending));
            parentSystemName = parentSystem.name;
          }
        }
        if (!parentSystemName && next.installedIn) {
          const newSys = dataset.individuals.get(next.installedIn);
          if (newSys && getEntityTypeIdFromIndividual(newSys) === ENTITY_TYPE_IDS.SYSTEM) {
            parentSystemName = newSys.name;
          }
        }

        const compAffectedActivities: AffectedActivity[] = [];
        compAffectedActivities.push(...findAffectedActivities(next.id, next.name, effectiveStart, effectiveEnd, oldEffStart, oldEffEnd).map(a => ({...a, systemName: parentSystemName})));

        // Also check activities for individuals installed in this component
        for (const ind of Array.from(dataset.individuals.values())) {
          const periods = getInstallationPeriods(ind);
          const isInstalledInComp = periods.some((p) => p.systemComponentId === next.id);
          if (!isInstalledInComp) continue;
          const indStart = normalizeStart(ind.beginning);
          const indEnd = normalizeEnd(ind.ending);
          const indEffStart = Math.max(indStart, effectiveStart);
          const indEffEnd = Math.min(indEnd, effectiveEnd);
          const oldIndEffStart = Math.max(indStart, oldEffStart);
          const oldIndEffEnd = Math.min(indEnd, oldEffEnd);
          
          if (indEffEnd > indEffStart) {
            compAffectedActivities.push(...findAffectedActivities(ind.id, ind.name, indEffStart, indEffEnd, oldIndEffStart, oldIndEffEnd).map(a => ({...a, systemName: parentSystemName, systemComponentName: next.name})));
          } else {
            compAffectedActivities.push(...findAffectedActivities(ind.id, ind.name, indEffStart, indEffStart, oldIndEffStart, oldIndEffEnd).map(a => ({...a, systemName: parentSystemName, systemComponentName: next.name})));
          }
        }

        // De-duplicate by activityId+individualId
        const seenCompActKeys = new Set<string>();
        const dedupedCompActivities = compAffectedActivities.filter((aa) => {
          const key = aa.activityId + ":" + aa.individualId;
          if (seenCompActKeys.has(key)) return false;
          seenCompActKeys.add(key);
          return true;
        });

        if (affectedInstalls.length > 0 || dedupedCompActivities.length > 0) {
          const pending = { ...next };

          setCascadeWarning({
            entityName: next.name,
            affectedComponents: [],
            affectedInstallations: affectedInstalls,
            affectedActivities: dedupedCompActivities,
            pendingIndividual: pending,
            applyTrim: () => {
              updateDataset((d: Model) => {
                // Save the system component itself
                d.addIndividual(pending);

                // Trim affected installations
                const installsByIndividual = new Map<string, AffectedInstallation[]>();
                for (const ai of affectedInstalls) {
                  const list = installsByIndividual.get(ai.individualId) ?? [];
                  list.push(ai);
                  installsByIndividual.set(ai.individualId, list);
                }

                Array.from(installsByIndividual.entries()).forEach(([indId, affectedPeriods]) => {
                  const ind = d.individuals.get(indId);
                  if (!ind) return;
                  const periods = getInstallationPeriods(ind)
                    .map((p) => {
                      const match = affectedPeriods.find((a: AffectedInstallation) => a.periodId === p.id);
                      if (match && match.action === "trim" && match.toBeginning !== undefined && match.toEnding !== undefined) {
                        return { ...p, beginning: match.toBeginning, ending: match.toEnding };
                      }
                      if (match && match.action === "drop") return null;
                      return p;
                    })
                    .filter((p): p is InstallationPeriod => !!p);
                  d.addIndividual(syncLegacyInstallationFields({
                    ...ind,
                    installedIn: undefined,
                    installedBeginning: undefined,
                    installedEnding: undefined,
                    installations: periods,
                  }));
                });

                // Remove participations for affected activities (drop only)
                for (const aa of dedupedCompActivities) {
                  if (aa.action !== "drop") continue;
                  const act = d.activities.get(aa.activityId);
                  if (act) act.participations.delete(aa.individualId);
                }

                return d;
              });

              setShowCascadeWarningModal(false);
              setCascadeWarning(null);
              handleClose();
            },
            applyRemove: () => {
              updateDataset((d: Model) => {
                // Save the system component itself
                d.addIndividual(pending);

                // Remove all affected installations
                const installsToRemove = new Set(affectedInstalls.map((ai) => ai.periodId));
                for (const ind of Array.from(d.individuals.values())) {
                  const periods = getInstallationPeriods(ind);
                  const hasAffected = periods.some((p) => installsToRemove.has(p.id));
                  if (hasAffected) {
                    const kept = periods.filter((p) => !installsToRemove.has(p.id));
                    d.addIndividual(syncLegacyInstallationFields({
                      ...ind,
                      installedIn: undefined,
                      installedBeginning: undefined,
                      installedEnding: undefined,
                      installations: kept,
                    }));
                  }
                }

                // Remove all affected participations
                for (const aa of dedupedCompActivities) {
                  const act = d.activities.get(aa.activityId);
                  if (act) act.participations.delete(aa.individualId);
                }

                return d;
              });

              setShowCascadeWarningModal(false);
              setCascadeWarning(null);
              handleClose();
            },
          });
          setShowCascadeWarningModal(true);
          return;
        }
      }
    }

    commitIndividualSave(next);
  };

  const confirmBoundsAdjustment = () => {
    if (!pendingSaveIndividual) {
      setShowBoundsWarningModal(false);
      return;
    }
    // If there are affected activities, handle them in a single update
    if (pendingAffectedActivities.length > 0) {
      updateDataset((d: Model) => {
        d.addIndividual(pendingSaveIndividual);
        // Remove participations for affected activities (drop only)
        for (const aa of pendingAffectedActivities) {
          if (aa.action !== "drop") continue;
          const act = d.activities.get(aa.activityId);
          if (act) act.participations.delete(aa.individualId);
        }
      });
      handleClose();
    } else {
      commitIndividualSave(pendingSaveIndividual);
    }
  };

  const confirmBoundsDeleteAffected = () => {
    if (!pendingRemoveIndividual) {
      setShowBoundsWarningModal(false);
      return;
    }
    // If there are affected activities, handle them in a single update
    if (pendingAffectedActivities.length > 0) {
      updateDataset((d: Model) => {
        d.addIndividual(pendingRemoveIndividual);
        // Remove all affected participations
        for (const aa of pendingAffectedActivities) {
          const act = d.activities.get(aa.activityId);
          if (act) act.participations.delete(aa.individualId);
        }
      });
      handleClose();
    } else {
      commitIndividualSave(pendingRemoveIndividual);
    }
  };

  const handleDelete = () => {
    deleteIndividual(inputs.id);
    handleClose();
  };

  const openInstallationsModal = () => {
    const rows = getInstallationPeriods(inputs).map((period) => ({
      id: period.id,
      systemComponentId: period.systemComponentId,
      beginningText: String(period.beginning),
      endingText: period.ending >= Model.END_OF_TIME ? "" : String(period.ending),
    }));
    setInstallationRows(
      rows.length > 0
        ? rows
        : [
            {
              id: uuidv4(),
              systemComponentId: "",
              beginningText: "0",
              endingText: "",
            },
          ]
    );
    setInstallationErrors([]);
    setShowInstallationsModal(true);
  };

  const addInstallationRow = () => {
    setInstallationRows((previous) => [
      ...previous,
      {
        id: uuidv4(),
        systemComponentId: "",
        beginningText: "0",
        endingText: "",
      },
    ]);
  };

  const removeInstallationRow = (rowId: string) => {
    setInstallationRows((previous) => {
      const nextRows = previous.filter((row) => row.id !== rowId);
      if (nextRows.length === 0) {
        setInstallationErrors([]);
      } else {
        const { rowErrors } = normalizeInstallationRows(nextRows);
        setInstallationErrors(rowErrors);
      }
      return nextRows;
    });
  };

  const updateInstallationRow = (
    rowId: string,
    key: keyof InstallationRow,
    value: string
  ) => {
    setInstallationRows((previous) =>
      previous.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  };

  const normalizeInstallationRows = (rows: InstallationRow[]) => {
    const rowErrors: string[] = [];
    const normalized: NormalizedInstallationRow[] = [];

    rows.forEach((row, index) => {
      const rowPrefix = `Row ${index + 1}`;

      if (!row.systemComponentId) {
        rowErrors.push(`${rowPrefix}: System Component is required`);
        return;
      }

      const component = dataset.individuals.get(row.systemComponentId);
      if (
        !component ||
        getEntityTypeIdFromIndividual(component) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT
      ) {
        rowErrors.push(`${rowPrefix}: Selected System Component is invalid`);
        return;
      }

      if (row.beginningText.trim() === "") {
        rowErrors.push(`${rowPrefix}: Beginning is required`);
        return;
      }

      const beginning = Math.trunc(Number(row.beginningText));

      let ending =
        row.endingText.trim() === ""
          ? Model.END_OF_TIME
          : Math.trunc(Number(row.endingText));
      if (ending <= 0) ending = Model.END_OF_TIME;

      if (!Number.isFinite(beginning) || beginning < 0) {
        rowErrors.push(`${rowPrefix}: Beginning must be 0 or greater`);
        return;
      }

      if (!Number.isFinite(ending) || ending <= beginning) {
        rowErrors.push(`${rowPrefix}: Ending must be after Beginning`);
        return;
      }

      const logicalComponentStart =
        component.beginning === -1 ? -Infinity : component.beginning;
      const logicalComponentEnd =
        component.ending >= Model.END_OF_TIME ? Infinity : component.ending;
      const logicalBeginning = beginning;
      const logicalEnding = ending >= Model.END_OF_TIME ? Infinity : ending;

      if (logicalBeginning < logicalComponentStart) {
        rowErrors.push(
          `${rowPrefix}: Beginning must be within ${component.name} bounds`
        );
      }
      if (logicalEnding > logicalComponentEnd) {
        rowErrors.push(`${rowPrefix}: Ending must be within ${component.name} bounds`);
      }

      const logicalOwnStart = inputs.beginning === -1 ? -Infinity : inputs.beginning;
      const logicalOwnEnd = inputs.ending >= Model.END_OF_TIME ? Infinity : inputs.ending;
      
      if (logicalBeginning < logicalOwnStart) {
        rowErrors.push(`${rowPrefix}: Beginning must be within entity bounds`);
      }
      if (logicalEnding > logicalOwnEnd) {
        rowErrors.push(`${rowPrefix}: Ending must be within entity bounds`);
      }

      normalized.push({
        id: row.id,
        systemComponentId: row.systemComponentId,
        beginning,
        ending,
      });
    });

    for (let first = 0; first < normalized.length; first += 1) {
      for (let second = first + 1; second < normalized.length; second += 1) {
        const a = normalized[first];
        const b = normalized[second];
        if (a.systemComponentId !== b.systemComponentId) continue;

        const overlap = a.beginning < b.ending && b.beginning < a.ending;
        if (!overlap) continue;

        rowErrors.push(
          `Rows ${first + 1} and ${second + 1} overlap within the same system component`
        );
      }
    }

    normalized.forEach((candidate, index) => {
      const overlappingOther = Array.from(dataset.individuals.values())
        .filter((other) => other.id !== inputs.id)
        .some((other) =>
          getInstallationPeriods(other).some((period) => {
            if (period.systemComponentId !== candidate.systemComponentId) {
              return false;
            }
            return (
              candidate.beginning < period.ending &&
              period.beginning < candidate.ending
            );
          })
        );

      if (overlappingOther) {
        rowErrors.push(
          `Row ${index + 1} overlaps another individual in the same system component slot`
        );
      }
    });

    return { normalized, rowErrors };
  };

  useEffect(() => {
    if (!showInstallationsModal) return;
    const { rowErrors } = normalizeInstallationRows(installationRows);
    setInstallationErrors(rowErrors);
  }, [installationRows, showInstallationsModal]);

  const saveInstallations = () => {
    if (installationRows.length === 0) {
      const synced = syncLegacyInstallationFields({
        ...inputs,
        installedIn: undefined,
        installedBeginning: undefined,
        installedEnding: undefined,
        installations: [],
      });

      setInputs(synced);
      setDirty(true);
      setShowInstallationsModal(false);
      setInstallationErrors([]);
      return;
    }

    const { normalized, rowErrors } = normalizeInstallationRows(installationRows);
    if (rowErrors.length > 0) {
      setInstallationErrors(rowErrors);
      return;
    }

    const nextInstallations: InstallationPeriod[] = normalized
      .sort((first, second) => first.beginning - second.beginning)
      .map((row) => ({
        id: row.id,
        systemComponentId: row.systemComponentId,
        beginning: row.beginning,
        ending: row.ending,
      }));

    const synced = syncLegacyInstallationFields({
      ...inputs,
      // Clear legacy fields so getInstallationPeriods inside sync
      // uses only the explicit installations array, not stale legacy values.
      installedIn: undefined,
      installedBeginning: undefined,
      installedEnding: undefined,
      installations: nextInstallations,
    });

    setInputs(synced);
    setDirty(true);
    setShowInstallationsModal(false);
    setInstallationErrors([]);
  };

  const getAvailabilityForRow = (row: InstallationRow) => {
    if (!row.systemComponentId) return null;

    const component = dataset.individuals.get(row.systemComponentId);
    if (!component) return null;

    const start = normalizeStart(component.beginning);
    const end = normalizeEnd(component.ending);

    const occupied = installationRows
      .filter((entry) => entry.id !== row.id)
      .map((entry) => {
        if (!entry.systemComponentId) return undefined;

        const isSameSlot = entry.systemComponentId === row.systemComponentId;

        if (!isSameSlot) {
          return undefined;
        }

        const from = Math.trunc(Number(entry.beginningText));
        const until =
          entry.endingText.trim() === ""
            ? Model.END_OF_TIME
            : Math.trunc(Number(entry.endingText));

        if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) {
          return undefined;
        }

        return { from, until };
      })
      .filter(
        (value): value is { from: number; until: number } =>
          !!value && value.until > start && value.from < end
      )
      .map((value) => ({
        from: Math.max(start, value.from),
        until: Math.min(end, value.until),
      }));

    const occupiedByDataset = Array.from(dataset.individuals.values())
      .filter((other) => other.id !== inputs.id)
      .flatMap((other) =>
        getInstallationPeriods(other)
          .map((period) => {
            if (period.systemComponentId !== row.systemComponentId) {
              return undefined;
            }
            return {
              from: Math.max(start, period.beginning),
              until: Math.min(end, period.ending),
            };
          })
          .filter(
            (value): value is { from: number; until: number } =>
              !!value && value.until > value.from
          )
      );

    const combinedOccupied = [...occupied, ...occupiedByDataset]
      .sort((first, second) => first.from - second.from);

    const merged: Array<{ from: number; until: number }> = [];
    combinedOccupied.forEach((slot) => {
      const previous = merged[merged.length - 1];
      if (!previous || slot.from > previous.until) {
        merged.push({ ...slot });
        return;
      }
      previous.until = Math.max(previous.until, slot.until);
    });

    const available: Array<{ from: number; until: number }> = [];
    let cursor = start;
    merged.forEach((slot) => {
      if (slot.from > cursor) {
        available.push({ from: cursor, until: slot.from });
      }
      cursor = Math.max(cursor, slot.until);
    });
    if (cursor < end) {
      available.push({ from: cursor, until: end });
    }

    const formatIntervals = (intervals: Array<{ from: number; until: number }>) =>
      intervals.length === 0
        ? "None"
        : intervals
            .map((interval) =>
              interval.until >= Model.END_OF_TIME
                ? `${interval.from}-∞`
                : `${interval.from}-${interval.until}`
            )
            .join(", ");

    return {
      occupied: formatIntervals(merged),
      available: formatIntervals(available),
    };
  };

  const hasPendingTrimAction = pendingBoundsChanges.some((change) => change.action === "trim") ||
    pendingAffectedActivities.some((aa) => aa.action === "trim");
  const hasPendingDropAction = pendingBoundsChanges.some((change) => change.action === "drop") ||
    pendingAffectedActivities.some((aa) => aa.action === "drop");
  const cascadeHasTrimAction =
    !!cascadeWarning &&
    (
      cascadeWarning.affectedComponents.some((item) => item.action === "trim") ||
      cascadeWarning.affectedInstallations.some((item) => item.action === "trim") ||
      cascadeWarning.affectedActivities.some((item) => item.action === "trim")
    );
  const cascadeHasDropAction =
    !!cascadeWarning &&
    (
      cascadeWarning.affectedComponents.some((item) => item.action === "drop") ||
      cascadeWarning.affectedInstallations.some((item) => item.action === "drop") ||
      cascadeWarning.affectedActivities.some((item) => item.action === "drop")
    );

  return (
    <>
      <Button variant="primary" onClick={() => setShow(true)} className="mx-1">
        Add Entity
      </Button>

      <Modal dialogAs={DraggableModalDialog} 
        show={
          show &&
          !showInstallationsModal &&
          !showBoundsWarningModal &&
          !showCascadeWarningModal
        }
        onHide={handleModalHide}
      >
        <Modal.Header closeButton>
          <Modal.Title>{isEditMode ? "Edit Entity" : "Add Entity"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSave}>
            <Form.Group className="mb-3" controlId="formEntityCategory">
              <Form.Label>Entity Type</Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {ENTITY_TYPE_OPTIONS.map((option) => {
                  const selected = selectedEntityTypeId === option.id;
                  const disabled = isEditMode && !selected;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={selected ? "primary" : "outline-secondary"}
                      disabled={disabled}
                      onClick={() => handleEntityType(option.id)}
                    >
                      {option.glyph} {option.label}
                    </Button>
                  );
                })}
              </div>
            </Form.Group>

            <Form.Group className="mb-3" controlId="formEntityName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={inputs.name}
                onChange={handleChangeText}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formEntityType">
              <Form.Label>Type</Form.Label>
              <div
                ref={typeDropdownRef}
                className="position-relative"
                style={{ zIndex: 1050 }}
              >
                <button
                  type="button"
                  className="w-100 btn btn-outline-secondary d-flex justify-content-between align-items-center"
                  onClick={() => setTypeOpen((s) => !s)}
                >
                  <span className="text-truncate">
                    {inputs?.type?.name || "Select type..."}
                  </span>
                  <span style={{ marginLeft: 8 }}>▾</span>
                </button>

                {typeOpen && (
                  <div
                    className="card mt-1"
                    style={{ maxHeight: 300, overflow: "hidden" }}
                  >
                    <div className="card-body p-2 border-bottom">
                      <input
                        className="form-control form-control-sm"
                        placeholder="Search or create type..."
                        value={typeSearch}
                        onChange={(e) => setTypeSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && showCreateTypeOption) {
                            e.preventDefault();
                            handleCreateTypeFromSearch();
                            return;
                          }
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            moveHighlight(1);
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            moveHighlight(-1);
                            return;
                          }
                          if (e.key === "Escape") {
                            setTypeOpen(false);
                            return;
                          }
                          if (e.key === "Enter" && filteredTypes.length > 0 && !showCreateTypeOption) {
                            e.preventDefault();
                            selectHighlighted();
                            return;
                          }
                        }}
                        autoFocus
                      />
                    </div>

                    <div style={{ maxHeight: 180, overflow: "auto" }}>
                      {filteredTypes.map((t, idx) => (
                        <div
                          key={t.id}
                          ref={(el) => {
                            if (itemRefs.current) itemRefs.current[idx] = el;
                          }}
                          tabIndex={-1}
                          className={`d-flex align-items-center justify-content-between px-3 py-2 ${
                            highlightedIndex === idx
                              ? "bg-primary text-white"
                              : ""
                          }`}
                          style={{ cursor: "pointer" }}
                          onClick={() => handleSelectType(t.id)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") selectHighlighted();
                            if (e.key === "Escape") setTypeOpen(false);
                          }}
                        >
                          {editingTypeId === t.id ? (
                            <div className="d-flex align-items-center w-100">
                              <input
                                className="form-control form-control-sm me-2"
                                value={editingTypeValue}
                                onChange={(e) =>
                                  setEditingTypeValue(e.target.value)
                                }
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditType();
                                  if (e.key === "Escape") cancelEditType();
                                  e.stopPropagation(); // prevent parent from handling
                                }}
                                autoFocus
                              />
                              <div className="d-flex align-items-center">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success me-1"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    saveEditType();
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    cancelEditType();
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-grow-1">{t.name}</div>
                              <div className="d-flex align-items-center">
                                {inputs?.type?.id === t.id && (
                                  <span className="me-2">✓</span>
                                )}
                                <button
                                  type="button"
                                  className={`btn btn-sm btn-link p-0 ${
                                    highlightedIndex === idx
                                      ? "text-white"
                                      : ""
                                  }`}
                                  onClick={(e) =>
                                    startEditType(t.id, t.name, e)
                                  }
                                >
                                  edit
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {showCreateTypeOption && (
                        <div
                          className="px-3 py-2 text-primary fw-medium border-top"
                          style={{ cursor: "pointer" }}
                          onClick={handleCreateTypeFromSearch}
                        >
                          Create &quot;{typeSearch}&quot;
                        </div>
                      )}

                      {filteredTypes.length === 0 && !showCreateTypeOption && (
                        <div className="p-3 text-muted small">
                          No results found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Form.Group>

            {selectedEntityTypeId === ENTITY_TYPE_IDS.SYSTEM_COMPONENT && (
              <Form.Group className="mb-3" controlId="formSystemComponentParent">
                <Form.Label>Install To System</Form.Label>
                <Form.Select
                  value={inputs.installedIn ?? ""}
                  onChange={(event) => {
                    const systemId = event.target.value || undefined;
                    setInputs((previous) => ({
                      ...previous,
                      installedIn: systemId,
                    }));
                    setDirty(true);
                  }}
                >
                  <option value="">Select system...</option>
                  {systems.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.name}
                    </option>
                  ))}
                </Form.Select>
                {systems.length === 0 && (
                  <Form.Text className="text-danger">
                    Create a System entity before adding a System Component.
                  </Form.Text>
                )}
                {systemComponentSlotHints && (
                  <Form.Text className="text-muted d-block mt-1">
                    System bounds: {systemComponentSlotHints.bounds} | Multiple system components can share the same slot range.
                  </Form.Text>
                )}
              </Form.Group>
            )}

            <Form.Group className="mb-3" controlId="formEntityBeginning">
              <Form.Label>Beginning</Form.Label>
              <Form.Control
                type="number"
                min="0" step="any"
                value={beginningText}
                onChange={handleBeginChange}
                disabled={
                  selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL &&
                  inputs.beginsWithParticipant
                }
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formEntityEnding">
              <Form.Label>Ending</Form.Label>
              <Form.Control
                type="number"
                min="0" step="any"
                value={endingText}
                onChange={handleEndChange}
                disabled={
                  selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL &&
                  inputs.endsWithParticipant
                }
              />
            </Form.Group>

            {selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL && (
              <>
                <Form.Group className="mb-2" controlId="formBeginWithParticipant">
                  <Form.Check
                    type="switch"
                    label="Begins With Participant"
                    checked={!!inputs.beginsWithParticipant}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      const nextBeginning = checked
                        ? dataset.earliestParticipantBeginning(inputs.id)
                        : -1;

                      setBeginningText(asInputText(nextBeginning, true));
                      setInputs((previous) => ({
                        ...previous,
                        beginsWithParticipant: checked,
                        beginning: nextBeginning,
                      }));
                      setDirty(true);
                    }}
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="formEndWithParticipant">
                  <Form.Check
                    type="switch"
                    label="Ends With Participant"
                    checked={!!inputs.endsWithParticipant}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      const nextEnding = checked
                        ? dataset.lastParticipantEnding(inputs.id)
                        : Model.END_OF_TIME;

                      setEndingText(asInputText(nextEnding, false));
                      setInputs((previous) => ({
                        ...previous,
                        endsWithParticipant: checked,
                        ending: nextEnding,
                      }));
                      setDirty(true);
                    }}
                  />
                </Form.Group>
              </>
            )}

            {isEditMode && selectedEntityTypeId === ENTITY_TYPE_IDS.INDIVIDUAL && (
              <Card className="mb-3">
                <Card.Body className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold">Installations</div>
                    <div className="text-muted">
                      {getInstallationPeriods(inputs).length === 0
                        ? "Not installed in any slot yet."
                        : `${getInstallationPeriods(inputs).length} total installation${
                            getInstallationPeriods(inputs).length > 1 ? "s" : ""
                          }`}
                    </div>
                  </div>
                  <Button variant="outline-primary" onClick={openInstallationsModal}>
                    {getInstallationPeriods(inputs).length > 0
                      ? `Add/Edit Installation${getInstallationPeriods(inputs).length > 1 ? "s" : ""}`
                      : "Add Installation"}
                  </Button>
                </Card.Body>
              </Card>
            )}

            <Form.Group className="mb-3" controlId="formEntityDescription">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                name="description"
                value={inputs.description ?? ""}
                onChange={handleChangeText}
              />
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <div className="w-100 d-flex justify-content-between align-items-center">
            <div>
              <Button
                variant="danger"
                onClick={handleDelete}
                className={isEditMode ? "d-inline-block" : "d-none"}
              >
                Delete
              </Button>
            </div>
            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={!dirty}>
                Save
              </Button>
            </div>
          </div>

          {errors.length > 0 && (
            <Alert variant="danger" className="w-100 p-2 m-0 mt-2">
              {errors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </Alert>
          )}
        </Modal.Footer>
      </Modal>

      <Modal dialogAs={DraggableModalDialog} 
        show={showInstallationsModal}
        onHide={() => setShowInstallationsModal(false)}
        size="xl"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Add Installation for {inputs.name || "Entity"} ({inputs.beginning === -1 ? "0" : inputs.beginning} - {inputs.ending >= Model.END_OF_TIME ? "∞" : inputs.ending})
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table bordered responsive>
            <thead>
              <tr>
                <th>#</th>
                <th>System Component *</th>
                <th>From *</th>
                <th>Until</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {installationRows.map((row, index) => {
                const availability = getAvailabilityForRow(row);
                return (
                  <tr key={row.id} className="installation-row">
                    <td>{index + 1}</td>
                    <td>
                      <Form.Select
                        value={row.systemComponentId}
                        onChange={(event) =>
                          updateInstallationRow(
                            row.id,
                            "systemComponentId",
                            event.target.value
                          )
                        }
                      >
                        <option value="">-- Select slot --</option>
                        {systemComponents.map((component) => {
                          const system = component.installedIn
                            ? dataset.individuals.get(component.installedIn)
                            : undefined;
                          const begin = normalizeStart(component.beginning);
                          const end = normalizeEnd(component.ending);
                          return (
                            <option key={component.id} value={component.id}>
                              {`${component.name}${
                                system ? ` (in ${system.name})` : ""
                              } (${begin}-${
                                end >= Model.END_OF_TIME ? "∞" : String(end)
                              })`}
                            </option>
                          );
                        })}
                      </Form.Select>
                      {availability && (
                        <Form.Text className="text-muted d-block mt-1">
                          Occupied: {availability.occupied} | Available: {availability.available}
                        </Form.Text>
                      )}
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        min="0" step="any"
                        value={row.beginningText}
                        onChange={(event) =>
                          updateInstallationRow(row.id, "beginningText", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        min="0" step="any"
                        placeholder="∞"
                        value={row.endingText}
                        onChange={(event) =>
                          updateInstallationRow(row.id, "endingText", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <Button
                        variant="outline-danger"
                        onClick={() => removeInstallationRow(row.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <Button variant="outline-primary" onClick={addInstallationRow}>
            + Add Another Installation Period
          </Button>

          {installationErrors.length > 0 && (
            <Alert variant="danger" className="mt-3 mb-0">
              {installationErrors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="w-100 d-flex justify-content-between align-items-center">
            <div className="text-muted">
              {installationRows.length} total installation
              {installationRows.length === 1 ? "" : "s"}
            </div>
            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={() => setShowInstallationsModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveInstallations}>
                Save
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>

      <Modal dialogAs={DraggableModalDialog} 
        show={showBoundsWarningModal}
        onHide={() => setShowBoundsWarningModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Affected Items — {inputs.name || "Entity"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Changing the bounds of <strong>{inputs.name || "Entity"}</strong> will
            affect the following items:
          </p>
          {pendingBoundsChanges.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold mb-2">Installation Periods</div>
              <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                {[...pendingBoundsChanges].sort((a, b) => a.fromBeginning - b.fromBeginning).map((change) => (
                  <div key={change.periodId} className="mb-1 small">
                    <span className="fw-semibold">{change.systemComponentName}</span>
                    {change.parentSystemName ? ` (in ${change.parentSystemName})` : ""}
                    {": "}
                    {formatBound(change.fromBeginning, true)}-{formatBound(change.fromEnding, false)}
                    {change.action === "trim"
                      ? ` → ${formatBound(change.toBeginning ?? change.fromBeginning, true)}-${formatBound(change.toEnding ?? change.fromEnding, false)} (trimmed)`
                      : " → removed (no overlap)"}
                  </div>
                ))}
              </div>
            </div>
          )}
          {pendingAffectedActivities.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold mb-2">Activities</div>
              <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                {[...pendingAffectedActivities].sort((a, b) => a.fromBeginning - b.fromBeginning).map((aa) => (
                  <div key={aa.activityId} className="mb-1 small">
                    <span className="fw-semibold">{aa.activityName}</span>
                    <span className="text-muted">
                      {" (Participant: "}
                      {aa.systemName ? `${aa.systemName} → ` : ""}
                      {aa.systemComponentName ? `${aa.systemComponentName} → ` : ""}
                      {aa.individualName}
                      {")"}
                    </span>
                    {": "}
                    {formatBound(aa.fromBeginning, true)}-{formatBound(aa.fromEnding, false)}
                    {aa.action === "trim"
                      ? ` → ${formatBound(aa.toBeginning ?? aa.fromBeginning, true)}-${formatBound(aa.toEnding ?? aa.fromEnding, false)} (would be trimmed)`
                      : " → would be removed (no overlap)"}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowBoundsWarningModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={confirmBoundsDeleteAffected}
            disabled={!hasPendingDropAction}
          >
            Delete All Affected Periods
          </Button>
          <Button
            variant="primary"
            onClick={confirmBoundsAdjustment}
            disabled={!hasPendingTrimAction}
          >
            Resolve Affected Periods
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cascade warning modal for System / System Component bounds changes */}
      <Modal dialogAs={DraggableModalDialog} 
        show={showCascadeWarningModal}
        onHide={() => {
          setShowCascadeWarningModal(false);
          setCascadeWarning(null);
        }}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Affected Items — {cascadeWarning?.entityName ?? "Entity"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Changing the bounds of <strong>{cascadeWarning?.entityName}</strong> will
            affect the following items:
          </p>

          {cascadeWarning && cascadeWarning.affectedComponents.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold mb-2">System Components</div>
              <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                {[...cascadeWarning.affectedComponents].sort((a, b) => a.fromBeginning - b.fromBeginning).map((ac) => (
                  <div key={ac.id} className="mb-1 small">
                    <span className="fw-semibold">{ac.name}</span>
                    {": "}
                    {formatBound(ac.fromBeginning, true)}-{formatBound(ac.fromEnding, false)}
                    {ac.action === "trim"
                      ? ` → ${formatBound(ac.toBeginning ?? ac.fromBeginning, true)}-${formatBound(ac.toEnding ?? ac.fromEnding, false)} (would be trimmed)`
                      : " → would be removed (no overlap)"}
                  </div>
                ))}
              </div>
            </div>
          )}

          {cascadeWarning && cascadeWarning.affectedInstallations.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold mb-2">Installation Periods</div>
              <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                {[...cascadeWarning.affectedInstallations].sort((a, b) => a.fromBeginning - b.fromBeginning).map((ai) => (
                  <div key={ai.periodId} className="mb-1 small">
                    <span className="fw-semibold">{ai.individualName}</span>
                    {" installed in "}
                    <span className="fw-semibold">{ai.systemComponentName}</span>
                    {": "}
                    {formatBound(ai.fromBeginning, true)}-{formatBound(ai.fromEnding, false)}
                    {ai.action === "trim"
                      ? ` → ${formatBound(ai.toBeginning ?? ai.fromBeginning, true)}-${formatBound(ai.toEnding ?? ai.fromEnding, false)} (would be trimmed)`
                      : " → would be removed (no overlap)"}
                  </div>
                ))}
              </div>
            </div>
          )}

          {cascadeWarning && cascadeWarning.affectedActivities.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold mb-2">Activities</div>
              <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                {[...cascadeWarning.affectedActivities].sort((a, b) => a.fromBeginning - b.fromBeginning).map((aa) => (
                  <div key={aa.activityId} className="mb-1 small">
                    <span className="fw-semibold">{aa.activityName}</span>
                    <span className="text-muted">
                      {" (Participant: "}
                      {aa.systemName ? `${aa.systemName} → ` : ""}
                      {aa.systemComponentName ? `${aa.systemComponentName} → ` : ""}
                      {aa.individualName}
                      {")"}
                    </span>
                    {": "}
                    {formatBound(aa.fromBeginning, true)}-{formatBound(aa.fromEnding, false)}
                    {aa.action === "trim"
                      ? ` → ${formatBound(aa.toBeginning ?? aa.fromBeginning, true)}-${formatBound(aa.toEnding ?? aa.fromEnding, false)} (would be trimmed)`
                      : " → would be removed (no overlap)"}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowCascadeWarningModal(false);
              setCascadeWarning(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => cascadeWarning?.applyRemove()}
            disabled={!cascadeHasDropAction}
          >
            Delete All Affected Periods
          </Button>
          <Button
            variant="primary"
            onClick={() => cascadeWarning?.applyTrim()}
            disabled={!cascadeHasTrimAction}
          >
            Resolve Affected Periods
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SetIndividual;
