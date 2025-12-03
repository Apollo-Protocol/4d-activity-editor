import React from "react";
import Button from "react-bootstrap/Button";
import { saveJSONLD } from "lib/ActivityLib";
import { Activity } from "@/lib/Schema";

interface Props {
  dataset: any;
  activitiesInView?: Activity[];
  activityColors?: string[];
}

const ExportJson = (props: Props) => {
  const { dataset, activitiesInView = [], activityColors = [] } = props;

  function downloadjson() {
    const pom = document.createElement("a");
    saveJSONLD(dataset, (obj) => {
      // Add legend metadata to the exported JSON
      const exportData = {
        ...obj,
        _legend: {
          entityTypes: [
            { type: "System", icon: "▣" },
            { type: "SystemComponent", icon: "◇" },
            { type: "SystemComponentInstalled", icon: "◆" },
            { type: "InstalledComponent", icon: "⬡" },
            { type: "InstalledComponentInSlot", icon: "⬢" },
            { type: "Individual", icon: "○" },
          ],
          activities: activitiesInView.map((activity, idx) => ({
            id: activity.id,
            name: activity.name,
            color: activityColors[idx % activityColors.length] || "#ccc",
          })),
        },
      };

      pom.setAttribute(
        "href",
        "data:text/plain;charset=utf-8," +
          encodeURIComponent(JSON.stringify(exportData, null, 2))
      );
      pom.setAttribute("download", "activity_diagram.json");
      if (document.createEvent) {
        const event = document.createEvent("MouseEvents");
        event.initEvent("click", true, true);
        pom.dispatchEvent(event);
      } else {
        pom.click();
      }
    });
  }

  return (
    <Button
      variant="primary"
      onClick={downloadjson}
      className={dataset.individuals.size > 0 ? "mx-1 d-block" : "mx-1 d-none"}
    >
      Export JSON
    </Button>
  );
};

export default ExportJson;
