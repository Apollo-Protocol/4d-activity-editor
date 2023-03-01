import { useState, useEffect, MutableRefObject } from "react";
import { drawActivityDiagram } from "@/diagram/DrawActivityDiagram";
import { Activity, Individual, Model, Participation } from "amrc-activity-lib";
import { ConfigData } from "@/diagram/config";

interface Props {
  dataset: Model;
  configData: ConfigData;
  clickIndividual: (i: Individual) => void;
  clickActivity: (a: Activity) => void;
  clickParticipation: (a: Activity, p: Participation) => void;
  svgRef: MutableRefObject<any>;
}

const ActivityDiagram = (props: Props) => {
  const {
    dataset,
    configData,
    clickIndividual,
    clickActivity,
    clickParticipation,
    svgRef,
  } = props;

  const [plot, setPlot] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    setPlot(
      drawActivityDiagram(
        dataset,
        configData,
        svgRef.current,
        clickIndividual,
        clickActivity,
        clickParticipation
      )
    );
  }, [dataset, configData]);

  return (
    <div id="activity-diagram-scrollable-div" style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${plot.width} ${plot.height}`}
        ref={svgRef}
        style={{ minWidth: configData.viewPort.zoom * 100 + "%" }}
      />
    </div>
  );
};

export default ActivityDiagram;
