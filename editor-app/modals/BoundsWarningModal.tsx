import React, { Dispatch, SetStateAction } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import DraggableModalDialog from "@/modals/DraggableModalDialog";
import { formatBound } from "@/helpers/cascadeHelpers";
import type { AffectedActivity, PendingBoundsChange } from "@/types/setIndividualTypes";
import { Model } from "@/lib/Model";
import {
  getAffectedActivitySelectionKey,
  getAffectedActivityParticipantLabel,
  getActivityHeaderWidthCh,
} from "@/helpers/warningModalHelpers";

interface BoundsWarningModalProps {
  show: boolean;
  onHide: () => void;
  modalAnim: { className: string; sketchSvg: React.ReactNode };
  entityName: string;
  boundsWarningLeadText: string;
  boundsChangeSummary: string | null;
  installationPeriodChangeSummaries: string[];
  pendingBoundsChanges: PendingBoundsChange[];
  pendingAffectedActivities: AffectedActivity[];
  selectedAffectedActivityKeys: Set<string>;
  setSelectedAffectedActivityKeys: Dispatch<SetStateAction<Set<string>>>;
  selectedBoundsChangeIds: Set<string>;
  setSelectedBoundsChangeIds: Dispatch<SetStateAction<Set<string>>>;
  onConfirm: () => void;
  dataset: Model;
}

const BoundsWarningModal = ({
  show,
  onHide,
  modalAnim,
  entityName,
  boundsWarningLeadText,
  boundsChangeSummary,
  installationPeriodChangeSummaries,
  pendingBoundsChanges,
  pendingAffectedActivities,
  selectedAffectedActivityKeys,
  setSelectedAffectedActivityKeys,
  selectedBoundsChangeIds,
  setSelectedBoundsChangeIds,
  onConfirm,
  dataset,
}: BoundsWarningModalProps) => {
  const showBoundsFooterInfo =
    pendingBoundsChanges.length > 0 || pendingAffectedActivities.length > 0;
  const showBoundsRemovedLegend =
    pendingBoundsChanges.some((change) => change.action === "drop") ||
    pendingAffectedActivities.some((activity) => activity.action === "drop");
  const showBoundsTrimmedLegend =
    pendingBoundsChanges.some((change) => change.action === "trim") ||
    pendingAffectedActivities.some((activity) => activity.action === "trim");
  const showBoundsKeptLegend = pendingAffectedActivities.some(
    (activity) => activity.action !== "drop" && activity.action !== "trim"
  );
  const showBoundsTrimNote = showBoundsTrimmedLegend;
  const showBoundsActivityTrimmedNote = pendingAffectedActivities.some((item) =>
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
          Affected Items — {entityName}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          {boundsWarningLeadText} <strong>{entityName}</strong>
          {boundsChangeSummary && (
            <strong>{` (${boundsChangeSummary})`}</strong>
          )}
          {installationPeriodChangeSummaries.length > 0 && (
            <strong>
              {" ["}
              {installationPeriodChangeSummaries.join(", ")}
              {"]"}
            </strong>
          )}
          {" will affect the following items:"}
        </p>
        {pendingBoundsChanges.length > 0 && (
          <div className="mb-3">
            <div className="cascade-section-title">Installation Periods</div>
            <div className="cascade-badges-wrap" style={{ maxHeight: "220px", overflowY: "auto" }}>
              {[...pendingBoundsChanges].sort((a, b) => a.fromBeginning - b.fromBeginning).map((change) => {
                const isDrop = change.action === "drop";
                const isTrim = change.action === "trim";
                const isToggledToDelete = isTrim && selectedBoundsChangeIds.has(change.periodId);

                let badgeClass: string;
                if (isDrop || isToggledToDelete) {
                  badgeClass = "cascade-badge-remove";
                } else {
                  badgeClass = "cascade-badge-trim";
                }

                const isChecked = isDrop || isToggledToDelete;
                const isDisabled = isDrop;

                return (
                  <span
                    key={change.periodId}
                    className={`cascade-badge ${badgeClass}${isTrim ? " cascade-badge-checkable" : ""}`}
                    onClick={isTrim ? () => {
                      setSelectedBoundsChangeIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(change.periodId)) next.delete(change.periodId);
                        else next.add(change.periodId);
                        return next;
                      });
                    } : undefined}
                  >
                    <input
                      type="checkbox"
                      className="cascade-badge-checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => {}}
                      tabIndex={-1}
                    />
                    <span className="cascade-badge-label">
                      {change.systemComponentName}
                      {" ("}
                      {formatBound(change.fromBeginning, true)}-{formatBound(change.fromEnding, false)}
                      {change.action === "trim" && !isToggledToDelete
                        ? ` → ${formatBound(change.toBeginning ?? change.fromBeginning, true)}-${formatBound(change.toEnding ?? change.fromEnding, false)}`
                        : ""}
                      {")"}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {pendingAffectedActivities.length > 0 && (
          <div className="mb-3">
            <div className="cascade-section-title">Participation In Activities</div>
            <div style={{ maxHeight: "260px", overflowY: "auto" }}>
              {(() => {
                const grouped = new Map<string, { activityName: string; fromBeginning: number; fromEnding: number; entries: AffectedActivity[] }>();
                [...pendingAffectedActivities]
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
                          {activityTrimmed && (
                            <span className="cascade-activity-flag cascade-activity-flag-trim" aria-label="Activity trimmed to remaining participation bounds">*</span>
                          )}
                        </div>
                        <div className="cascade-badges-wrap">
                      {group.entries.map((aa) => {
                        const selectionKey = getAffectedActivitySelectionKey(aa);
                        const isDrop = aa.action === "drop";
                        const isTrim = aa.action === "trim";
                        const isToggledToDelete = isTrim && selectedAffectedActivityKeys.has(selectionKey);

                        let badgeClass: string;
                        if (isDrop || isToggledToDelete) {
                          badgeClass = "cascade-badge-remove";
                        } else if (isTrim) {
                          badgeClass = "cascade-badge-trim";
                        } else {
                          badgeClass = "cascade-badge-keep";
                        }

                        const showCheckbox = isDrop || isTrim;
                        const isChecked = isDrop || isToggledToDelete;
                        const isDisabled = isDrop;
                        const participantLabel = getAffectedActivityParticipantLabel(aa, dataset);

                        return (
                          <span
                            key={`${aa.activityId}:${aa.participationKey ?? aa.individualId}`}
                            className={`cascade-badge ${badgeClass}${isTrim ? " cascade-badge-checkable" : ""}`}
                            onClick={isTrim ? () => {
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
        {showBoundsFooterInfo && (
          <div className="cascade-footer-info">
            <div className="cascade-footer-block">
              <div className="cascade-footer-heading">Legend:</div>
              <div className="cascade-legend mb-0">
                {showBoundsRemovedLegend && (
                  <span className="cascade-legend-item">
                    <span className="cascade-badge cascade-badge-remove cascade-legend-badge">Removed</span>
                  </span>
                )}
                {showBoundsTrimmedLegend && (
                  <span className="cascade-legend-item">
                    <span className="cascade-badge cascade-badge-trim cascade-legend-badge">Trimmed to Fit</span>
                  </span>
                )}
                {showBoundsKeptLegend && (
                  <span className="cascade-legend-item">
                    <span className="cascade-badge cascade-badge-keep cascade-legend-badge">Kept</span>
                  </span>
                )}
              </div>
            </div>
            {(showBoundsTrimNote || showBoundsKeptLegend || showBoundsActivityTrimmedNote) && (
              <div className="cascade-footer-block cascade-footer-notes-block">
                <div className="cascade-footer-heading">Notes:</div>
                <div className="cascade-footer-notes">
                  {([
                    showBoundsTrimNote
                      ? "Tick boxes to remove entities."
                      : null,
                    showBoundsKeptLegend
                      ? "Kept items are removed due to no overlap, participation will return to parent entity."
                      : null,
                    showBoundsActivityTrimmedNote
                      ? (
                        <span>
                          <strong className="cascade-activity-note-marker cascade-activity-note-marker-trim">*</strong>: Activity itself will be trimmed to the remaining participation bounds.
                        </span>
                      )
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
        )}
        <Button
          variant="secondary"
          onClick={onHide}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
        >
          Apply
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default BoundsWarningModal;
