import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { Col, Container, Row } from "react-bootstrap";
import { ButtonRow, LinkButton } from "@/components/Util";
import JumpLinks, { JumpLinkItem } from "@/components/JumpLinks";
import { publicPath } from "@/utils/publicPath";

import styles from "@/styles/Home.module.css";

const introSections: JumpLinkItem[] = [
  { id: "intro-overview", label: "Overview" },
  { id: "intro-step-1", label: "Step 1: Develop an initial lifecycle activity model" },
  { id: "intro-step-2", label: "Step 2: Identify participants in each activity" },
  { id: "intro-step-3", label: "Step 3: Identify decisions relating to those activities" },
  { id: "intro-step-4", label: "Step 4: Proceed to information requirements capture" },
];

export default function Page() {
  return (
    <>
      <Head>
        <title>Activity Modelling Introduction | Activity Diagram Editor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="favicon.ico" />
      </Head>
      <Container>
      <div className="row">
    <div className="col mb-2 mb-lg-5">
    <h1 id="page-top" className="display-4 font-weight-normal">Introduction to Activity Modelling</h1>
    </div>
  </div>
      <div className="doc-page-layout">
        <JumpLinks items={introSections} label="Jump to section" />
        <div className="doc-page-content">
        <Row className="justify-content-center row-cols-1 row-cols-lg-2">
          <Col id="intro-overview" className="amrc-text doc-section-heading">
            <p className="lead">Activity happens all the time: the wind blows, seasons
            pass and the sun&apos;s fusion radiates photons and other
            subatomic particles throughout the solar system.  Human
            activity is also part of the range of activities.  Keeping
            track of intended and actual activities is hard, especially
            when it is the participants in those activities that set
            their context and determine what the result is.  A
            participant can be anything material that is involved
            intentionally or by virtue of its interaction with other
            participants (e.g. the environment itself or the floor of a
            building in which activity of interest is taking place).</p>

            <p className="lead">Whether a participant is significant-enough to warrant
            inclusion in a model is ultimately a decision, a decision
            based on whether there is a need for information records of
            it.  For business activity lifecycles, the only need for
            information is to support decisions in those, or other,
            business activities.  This page introduces a basic
            method for analysing activities and their participants
            to enable activity models to be developed to support
            subsequent information system development.</p>
          </Col>
          <Col className="col-md text-center align-self-center">
            <picture><img src={publicPath("/process-for-identifying-decisions-with-numbers.svg")} className="img-fluid mb-5 mt-3" alt="The four-step activity modelling 
            method as a flowchart."></img></picture>
          </Col>
        </Row>
        <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
          <Col>
            <h2 id="intro-step-1" className="doc-section-heading">Step 1: Develop an initial lifecycle activity model</h2>

            <p>An activity lifecycle is a
            decomposition of possible activities that represents a pattern
             of activity from the start to the end of something.  This is 
            typically business or organisational activities.  To get 
            started an initial set of activities should be created, 
            around which the activity analysis and decomposition can be
            done.</p>

            <h2 id="intro-step-2" className="doc-section-heading">Step 2: Identify participants in each activity</h2>

            <p>Why are participants important?  Firstly, they are the
            only things involved in activities.  If something else is
            involved, then it is also a participant.  Secondly, these
            participants each have lifecycles of their own.</p>
            <p>For example, a nut used on a production line will have been
            manufactured and sourced independently of a torque wrench
            used to tighten it and the robot manipulating the torque 
            wrench.  Each item modelled has an identity that
            can be used to create and query for records at any point in
            its lifecycle (at least, if we arrange for the data records
            to be managed in a way that allows for this).</p>

            <h2 id="intro-step-3" className="doc-section-heading">Step 3: Identify decisions relating to those activities</h2>

            <p>Identifying the decisions that require information should
            be an easy task once Steps 1 & 2 have been completed sufficiently.  
            If not, further iterations of those steps will be needed.</p>

            <p>When done in enough detail, decisions tend to be needed at the
            start and end of activities.</p>

            <h2 id="intro-step-4" className="doc-section-heading">Step 4: Proceed to information requirements capture</h2>

            <p>Once the activity lifecycle has been captured with the
            participants it is now ready for information requirements
            capture to support the decisions.  The activity model from 
            the Activity Modeller can be used to analyse what information 
            is needed relating to each participant to support any other 
            decision in the activity lifecycle.</p>
            
            <p>Data from the Activity Modeller can serve as a record of 
            the analysis of, and decisions made, for information 
            requirements capture.  The full draft methodology for implementing
            information systems based on this analysis is available for 
            trial use <Link href="https://github.com/Apollo-Protocol/information-requirement-methodology">
            here</Link>.</p>
          </Col>
          <Col className="col-md text-center align-self-center">
            <picture><img src={publicPath("/CraneLift-20230329b.png")} className="img-fluid mb-5" alt="
              A space-time diagram has two axes, Time horizontally and
              Space vertically. Resources are displayed as horizontal
              bars spaced along the Space axis. Activities are displayed
              as boxes spanning the resources they use and their
              temporal extent on the Time axis. Where a resource
              participates in an activity the overlapping area is
              shaded."></img></picture>
          </Col>
        </Row>

        <Link className="btn btn-outline-secondary mr-1" href="crane">See an example</Link>
        <p></p>
        <Link className="btn btn-outline-secondary" href="editor">Try the Activity Diagram Editor</Link>
        <p className="doc-back-to-top"><a href="#page-top">Back to top</a></p>

        </div>
      </div>

      </Container>
    </>
  );
}
