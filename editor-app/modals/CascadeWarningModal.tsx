import React, { Dispatch, SetStateAction } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import DraggableModalDialog from "@/modals/DraggableModalDialog";
import { Model } from "@/lib/Model";
import { formatBound } from "@/helpers/cascadeHelpers";
import type { AffectedActivity, CascadeWarning } from "@/types/setIndividualTypes";
import {
  getAffectedActivitySelectionKey,
  getAffectedActivityParticipantLabel,
  getActivityHeaderWidthCh,
} from "@/helpers/warningModalHelpers";

interface CascadeWarningModalProps {
  show: boolean;
  onHide: () => void;
  modalAnim: { className: string; sketchSvg: React.ReactNode };
  cascadeWarning: CascadeWarning | null;
  selectedAffectedActivityKeys: Set<string>;
  setSelectedAffectedActivityKeys: Dispatch<SetStateAction<Set<string>>>;
  selectedCascadeComponentIds: Set<string>;
  setSelectedCascadeComponentIds: Dispatch<SetStateAction<Set<string>>>;
  selectedCascadeInstallationIds: Set<string>;
  setSelectedCascadeInstallationIds: Dispatch<SetStateAction<Set<string>>>;
  onConfirm: () => void;
  dataset: Model;
}

const CascadeWarningModal = ({
  show,
  onHide,
  modalAnim,
  cascadeWarning,
  selectedAffectedActivityKeys,
  setSelectedAffectedActivityKeys,
  selectedCascadeComponentIds,
  setSelectedCascadeComponentIds,
  selectedCascadeInstallationIds,
  setSelectedCascadeInstallationIds,
  onConfirm,
  dataset,
}: CascadeWarningModalProps) => {
  const cascadeDeleteButtonLabel =
    cascadeWarning?.mode === "delete"
      ? cascadeWarning.removeButtonLabel ?? "Delete Entity"
      : "Apply";
  const cascadeCanRemove = !!cascadeWarning;

  const showCascadeFooterInfo =
    !!cascadeWarning &&
    (
      cascadeWarning.affectedComponents.length > 0 ||
      cascadeWarning.affectedComponentOfSystems.length > 0 ||
      cascadeWarning.affectedInstallations.length > 0 ||
      cascadeWarning.affectedActivities.length > 0
    );
  const showCascadeRemovedLegend =
    !!cascadeWarning &&
    (
      cascadeWarning.mode === "delete" ||
      cascadeWarning.affectedComponents.some((item) => item.action === "drop") ||
      cascadeWarning.affectedComponentOfSystems.length > 0 ||
      cascadeWarning.affectedInstallations.some((item) => item.action === "drop") ||
      cascadeWarning.affectedActivities.some((item) => item.action === "drop")
    );
  const showCascadeTrimmedLegend =
    !!cascadeWarning &&
    (
      cascadeWarning.affectedComponents.some((item) => item.action === "trim") ||
      cascadeWarning.affectedInstallations.some((item) => item.action === "trim") ||
      cascadeWarning.affectedActivities.some((item) => item.action === "trim")
    );
  const showCascadeKeptLegend =
    !!cascadeWarning &&
    cascadeWarning.affectedActivities.some((item) => {
      const isOptional = item.deleteChoice === "optional";
      const selectionKey = getAffectedActivitySelectionKey(item);
      const isToggledToDelete = isOptional && selectedAffectedActivityKeys.has(selectionKey);

      if (item.deleteChoice === "required") {
        return false;
      }

      if (isToggledToDelete) {
        return false;
      }

      return item.action === "drop" || item.action !== "trim";
    });
  const showCascadeTrimNote =
    !!cascadeWarning &&
    cascadeWarning.mode !== "delete" &&
    (
      cascadeWarning.affectedComponents.some((item) => item.action === "trim") ||
      cascadeWarning.affectedInstallations.some((item) => item.action === "trim") ||
      cascadeWarning.affectedActivities.some((item) => item.action === "trim")
    );
  const showCascadeActivityRemovedNote =
    !!cascadeWarning &&
    cascadeWarning.affectedActivities.some(
      (item) => item.deleteChoice === "required" && item.action === "drop" && !!item.activityOutcomeText
    );
  const showCascadeActivityTrimmedNote =
    !!cascadeWarning &&
    cascadeWarning.affectedActivities.some((item) =>
      item.activityOutcomeText?.startsWith("Activity itself would be trimmed to")
    );

  return (
    <Modal dialogAs={DraggableModalDialog}
      className={modalAnim.className}
      show={show}
      onHide={onHide}
      centered
      size="lg"
    >
      {modalAnim.sketchSvg}
      <Modal.Header closeButton>
        <Modal.Title>
          Affected Items — {cascadeWarning?.entityName ?? "Entity"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          {cascadeWarning?.mode === "delete" ? (
            <>
              {cascadeWarning?.leadText ?? "Deleting"} <strong>{cascadeWarning?.entityName}</strong>
              {" will remove it and affect the following items:"}
            </>
          ) : cascadeWarning?.parentSwitchSummary ? (
            <>
              {"Changing system of "}
              <strong>{cascadeWarning.entityName}</strong>
              <strong>{` (${cascadeWarning.parentSwitchSummary.componentBoundsText})`}</strong>
              {" from "}
              <strong>{cascadeWarning.parentSwitchSummary.oldParentName}</strong>
              <strong>{` (${cascadeWarning.parentSwitchSummary.oldParentBoundsText})`}</strong>
              {" to "}
              <strong>{cascadeWarning.parentSwitchSummary.newParentName}</strong>
              <strong>{` (${cascadeWarning.parentSwitchSummary.newParentBoundsText})`}</strong>
              {" will affect the following items:"}
            </>
          ) : (
            <>
              {cascadeWarning?.leadText ?? "Changing the bounds of"} <strong>{cascadeWarning?.entityName}</strong>
              {cascadeWarning?.entityBoundsText && (
                <strong>{` (${cascadeWarning.entityBoundsText})`}</strong>
              )}
              {" will affect the following items:"}
            </>
          )}
        </p>

        {cascadeWarning?.mode === "delete" &&
          cascadeWarning.affectedComponents.length === 0 &&
          cascadeWarning.affectedComponentOfSystems.length === 0 &&
          cascadeWarning.affectedInstallations.length === 0 &&
          cascadeWarning.affectedActivities.length === 0 && (
            <p className="text-muted small">
              No additional related items will be removed.
            </p>
          )}

        {cascadeWarning && cascadeWarning.affectedComponents.length > 0 && (
          <div className="mb-3">
            <div className="cascade-section-title">System Components</div>
            <div className="cascade-badges-wrap" style={{ maxHeight: "180px", overflowY: "auto" }}>
              {[...cascadeWarning.affectedComponents].sort((a, b) => a.fromBeginning - b.fromBeginning).map((ac) => {
                const isDrop = ac.action === "drop";
                const isTrim = ac.action === "trim";
                const isToggleable = cascadeWarning.mode !== "delete" && isTrim;
                const isToggledToDelete =
                  isToggleable && selectedCascadeComponentIds.has(ac.id);
                const badgeClass =
                  isDrop || isToggledToDelete
                    ? "cascade-badge-remove"
                    : "cascade-badge-trim";

                return (
                  <span
                    key={ac.id}
                    className={`cascade-badge ${badgeClass}${isToggleable ? " cascade-badge-checkable" : ""}`}
                    onClick={isToggleable ? () => {
                      setSelectedCascadeComponentIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(ac.id)) next.delete(ac.id);
                        else next.add(ac.id);
                        return next;
                      });
                    } : undefined}
                  >
                    <input
                      type="checkbox"
                      className="cascade-badge-checkbox"
                      checked={isDrop || isToggledToDelete}
                      disabled={isDrop}
                      onChange={() => {}}
                      tabIndex={-1}
                    />
                    <span className="cascade-badge-label">
                      {ac.name} ({formatBound(ac.fromBeginning, true)}-{formatBound(ac.fromEnding, false)}
                      {ac.action === "trim" && !isToggledToDelete
                        ? ` → ${formatBound(ac.toBeginning ?? ac.fromBeginning, true)}-${formatBound(ac.toEnding ?? ac.fromEnding, false)}`
                        : ""}
                      )
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {cascadeWarning && cascadeWarning.affectedComponentOfSystems.length > 0 && (
          <div className="mb-3">
            <div className="cascade-section-title">Component Of System</div>
            <div className="cascade-badges-wrap" style={{ maxHeight: "180px", overflowY: "auto" }}>
              {[...cascadeWarning.affectedComponentOfSystems]
                .sort((a, b) => a.fromBeginning - b.fromBeginning)
                .map((item) => (
                  <span
                    key={`${item.componentId}:${item.systemId}:${item.fromBeginning}:${item.fromEnding}`}
                    className="cascade-badge cascade-badge-remove"
                  >
                    <input
                      type="checkbox"
                      className="cascade-badge-checkbox"
                      checked
                      disabled
                      onChange={() => {}}
                      tabIndex={-1}
                    />
                    <span className="cascade-badge-label">
                      {item.componentName} [component of {item.systemName} ({formatBound(item.fromBeginning, true)}-{formatBound(item.fromEnding, false)})]
                    </span>
                  </span>
                ))}
            </div>
          </div>
        )}

        {cascadeWarning && cascadeWarning.affectedInstallations.length > 0 && (
          <div className="mb-3">
            <div className="cascade-section-title">Installation Periods</div>
            <div className="cascade-badges-wrap" style={{ maxHeight: "220px", overflowY: "auto" }}>
              {[...cascadeWarning.affectedInstallations].sort((a, b) => a.fromBeginning - b.fromBeginning).map((ai) => {
                const isDrop = ai.action === "drop";
                const isTrim = ai.action === "trim";
                const isToggleable = cascadeWarning.mode !== "delete" && isTrim;
                const isToggledToDelete =
                  isToggleable && selectedCascadeInstallationIds.has(ai.periodId);
                const badgeClass =
                  isDrop || isToggledToDelete
                    ? "cascade-badge-remove"
                    : "cascade-badge-trim";

                return (
                  <span
                    key={ai.periodId}
                    className={`cascade-badge ${badgeClass}${isToggleable ? " cascade-badge-checkable" : ""}`}
                    onClick={isToggleable ? () => {
                      setSelectedCascadeInstallationIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(ai.periodId)) next.delete(ai.periodId);
                        else next.add(ai.periodId);
                        return next;
                      });
                    } : undefined}
                  >
                    <input
                      type="checkbox"
                      className="cascade-badge-checkbox"
                      checked={isDrop || isToggledToDelete}
                      disabled={isDrop}
                      onChange={() => {}}
                      tabIndex={-1}
                    />
                    <span className="cascade-badge-label">
                      {ai.individualName} [installed in {ai.systemComponentName} ({formatBound(ai.fromBeginning, true)}-{formatBound(ai.fromEnding, false)}
                      {ai.action === "trim" && !isToggledToDelete
                        ? ` → ${formatBound(ai.toBeginning ?? ai.fromBeginning, true)}-${formatBound(ai.toEnding ?? ai.fromEnding, false)}`
                        : ""}
                      )]
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {cascadeWarning && cascadeWarning.affectedActivities.length > 0 && (
          <div className="mb-3">
            <div className="cascade-section-title">Participation In Activities</div>
            <div style={{ maxHeight: "260px", overflowY: "auto" }}>
              {(() => {
                const grouped = new Map<string, { activityName: string; fromBeginning: number; fromEnding: number; entries: AffectedActivity[] }>();
                [...cascadeWarning.affectedActivities]
                  .sort((a, b) => a.fromBeginning - b.fromBeginning)
                  .forEach((aa) => {
                    const existing = grouped.get(aa.activityId);
                    if (existing) {
                      existing.entries.push(aa);
                    } else {
                      grouped.set(aa.activityId, {
                        activityName: aa.activityName,
                        fromBeginning: aa.fromBeginning,
                        fromEnding: aa.fromEnding,
                        entries: [aa],
                      });
                    }
                  });
                const groupedEntries = Array.from(grouped.entries());
                const activityHeaderWidth = getActivityHeaderWidthCh(
                  groupedEntries.map(([, group]) => group)
                );
                return groupedEntries.map(([activityId, group]) => {
                  const allRequiredDrop = group.entries.every(
                    (e) => e.deleteChoice === "required" && e.action === "drop" && e.activityOutcomeText
                  );
                  const activityTrimmed = group.entries.some((entry) =>
                    entry.activityOutcomeText?.startsWith("Activity itself would be trimmed to")
                  );
                  return (
                    <div
                      key={activityId}
                      className="cascade-activity-row"
                      style={{ ["--cascade-activity-header-width" as string]: activityHeaderWidth }}
                    >
                      <div className="cascade-activity-line">
                        <div className="cascade-activity-header">
                          <span className="cascade-activity-name">{group.activityName}</span>
                          {" "}({formatBound(group.fromBeginning, true)}-{formatBound(group.fromEnding, false)}):
                          {allRequiredDrop && (
                            <span className="cascade-activity-flag cascade-activity-flag-remove" aria-label="Activity removed because no participants remain">#</span>
                          )}
                          {!allRequiredDrop && activityTrimmed && (
                            <span className="cascade-activity-flag cascade-activity-flag-trim" aria-label="Activity trimmed to remaining participation bounds">*</span>
                          )}
                        </div>
                        <div className="cascade-badges-wrap">
                        {group.entries.map((aa) => {
                          const selectionKey = getAffectedActivitySelectionKey(aa);
                          const isRequired = aa.deleteChoice === "required";
                          const isDrop = aa.action === "drop";
                          const isTrim = aa.action === "trim";
                          const isOptional = aa.deleteChoice === "optional";
                          const isToggledToDelete = isOptional && selectedAffectedActivityKeys.has(selectionKey);

                          let badgeClass: string;
                          if (isRequired) {
                            badgeClass = isTrim ? "cascade-badge-trim" : "cascade-badge-remove";
                          } else if (isToggledToDelete) {
                            badgeClass = "cascade-badge-remove";
                          } else if (isDrop) {
                            badgeClass = "cascade-badge-detached";
                          } else if (isTrim) {
                            badgeClass = "cascade-badge-trim";
                          } else {
                            badgeClass = "cascade-badge-keep";
                          }

                          const showCheckbox = isRequired || isOptional;
                          const isChecked = isRequired || isToggledToDelete;
                          const isDisabled = isRequired;
                          const canToggle = isOptional;
                          const participantLabel = getAffectedActivityParticipantLabel(aa, dataset);

                          return (
                            <span
                              key={`${aa.activityId}:${aa.participationKey ?? aa.individualId}`}
                              className={`cascade-badge ${badgeClass}${canToggle ? " cascade-badge-checkable" : ""}`}
                              onClick={canToggle ? () => {
                                setSelectedAffectedActivityKeys((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(selectionKey)) next.delete(selectionKey);
                                  else next.add(selectionKey);
                                  return next;
                                });
                              } : undefined}
                            >
                              {showCheckbox && (
                                <input
                                  type="checkbox"
                                  className="cascade-badge-checkbox"
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onChange={() => {}}
                                  tabIndex={-1}
                                />
                              )}
                              <span className="cascade-badge-label">{participantLabel}</span>
                            </span>
                          );
                        })}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {showCascadeFooterInfo ? (
          <div className="cascade-footer-info">
            <div className="cascade-footer-block">
              <div className="cascade-footer-heading">Legend:</div>
              <div className="cascade-legend mb-0">
                {showCascadeRemovedLegend && (
                  <span className="cascade-legend-item">
                    <span className="cascade-badge cascade-badge-remove cascade-legend-badge">Removed</span>
                  </span>
                )}
                {showCascadeTrimmedLegend && (
                  <span className="cascade-legend-item">
                    <span className="cascade-badge cascade-badge-trim cascade-legend-badge">Trimmed to Fit</span>
                  </span>
                )}
                {showCascadeKeptLegend && (
                  <span className="cascade-legend-item">
                    <span className="cascade-badge cascade-badge-keep cascade-legend-badge">Kept</span>
                  </span>
                )}
              </div>
            </div>
            {(showCascadeTrimNote || showCascadeKeptLegend || showCascadeActivityRemovedNote || showCascadeActivityTrimmedNote) && (
              <div className="cascade-footer-block cascade-footer-notes-block">
                <div className="cascade-footer-heading">Notes:</div>
                <div className="cascade-footer-notes">
                  {([
                    showCascadeKeptLegend
                      ? "Kept items are removed due to no overlap, participation will return to parent entity."
                      : null,
                    showCascadeActivityRemovedNote
                      ? (
                        <span>
                          <strong className="cascade-activity-note-marker">#</strong>: Activity itself will be removed (no remaining participants).
                        </span>
                      )
                      : null,
                    showCascadeActivityTrimmedNote
                      ? (
                        <span>
                          <strong className="cascade-activity-note-marker cascade-activity-note-marker-trim">*</strong>: Activity itself will be trimmed to the remaining participation bounds.
                        </span>
                      )
                      : null,
                    showCascadeTrimNote
                      ? "Tick boxes to remove entities."
                      : null,
                  ] as React.ReactNode[])
                    .filter(Boolean)
                    .map((note, index) => (
                      <div key={index} className="cascade-footer-note">
                        {index + 1} - {note}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
        <Button
          variant="secondary"
          onClick={onHide}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={!cascadeCanRemove}
        >
          {cascadeDeleteButtonLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CascadeWarningModal;
