import { useState, useEffect, MutableRefObject } from "react";
import Breadcrumb from "react-bootstrap/Breadcrumb";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { drawActivityDiagram } from "@/diagram/DrawActivityDiagram";
import { ConfigData } from "@/diagram/config";
import { Model } from "@/lib/Model";
import { Activity, Id, Individual, Maybe, Participation } from "@/lib/Schema";

interface Props {
  dataset: Model;
  configData: ConfigData;
  activityContext: Maybe<Id>;
  setActivityContext: (c: Maybe<Id>) => void;
  clickIndividual: (i: Individual) => void;
  clickActivity: (a: Activity) => void;
  clickParticipation: (a: Activity, p: Participation) => void;
  rightClickIndividual: (i: Individual) => void;
  rightClickActivity: (a: Activity) => void;
  rightClickParticipation: (a: Activity, p: Participation) => void;
  svgRef: MutableRefObject<any>;
}

const ActivityDiagram = (props: Props) => {
  const {
    dataset,
    configData,
    activityContext,
    setActivityContext,
    clickIndividual,
    clickActivity,
    clickParticipation,
    rightClickIndividual,
    rightClickActivity,
    rightClickParticipation,
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
        activityContext,
        svgRef.current,
        clickIndividual,
        clickActivity,
        clickParticipation,
        rightClickIndividual,
        rightClickActivity,
        rightClickParticipation
      )
    );
  }, [
    dataset,
    configData,
    activityContext,
    svgRef,
    clickIndividual,
    clickActivity,
    clickParticipation,
    rightClickIndividual,
    rightClickActivity,
    rightClickParticipation,
  ]);

  const buildCrumbs = () => {
    const context = [];
    let id: string | undefined = activityContext;
    while (true) {
      const link = id;
      const act = id ? dataset.activities.get(id) : null;
      const text = act ? act.name : <i>{dataset.name ?? "Top"}</i>;
      context.push(
        <Breadcrumb.Item
          active={ id == activityContext }
          linkProps={{ onClick: () => setActivityContext(link) }}
          key={id ?? "."}
        >{text}</Breadcrumb.Item>);
      if (id == undefined)
        break;
      id = act!.partOf;
    }
    return context.reverse();
  };
  const crumbs: JSX.Element[] = buildCrumbs();

  return (
    <>
      <Breadcrumb>{crumbs}</Breadcrumb>
      <div id="activity-diagram-scrollable-div" style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${plot.width} ${plot.height}`}
          ref={svgRef}
          style={{ minWidth: configData.viewPort.zoom * 100 + "%" }}
        />
      </div>
    </>
  );
};

export default ActivityDiagram;
