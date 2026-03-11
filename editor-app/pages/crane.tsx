import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import fs from "fs";
import path from "path";
import { Col, Container, Row } from "react-bootstrap";
import styles from "@/styles/Home.module.css";
import JumpLinks, { JumpLinkItem } from "@/components/JumpLinks";
// @ts-ignore
import ModalImage from "react-modal-image";

export async function getStaticProps() {
  const imagesDir = path.join(process.cwd(), "public", "crane");
  let files: string[] = [];
  try {
    files = fs.readdirSync(imagesDir);
  } catch (e) {
    // ignore
  }

  const imageMap: Record<string, string> = {};
  files.forEach((file) => {
    const parsed = path.parse(file);
    if (parsed.ext) {
      imageMap[parsed.name] = parsed.ext.replace(".", "");
    }
  });

  return {
    props: {
      imageMap,
    },
  };
}

const craneSections: JumpLinkItem[] = [
  { id: "crane-overview", label: "Overview" },
  { id: "top-level-approach", label: "Top-level approach" },
  { id: "crane-step-1", label: "Step 1: Lifecycle Activity Model" },
  {
    id: "crane-step-2",
    label: "Step 2: Analysing the Activities",
    children: [
      { id: "representing-a-step-on-the-diagram", label: "Representing a step" },
      { id: "adding-more-steps", label: "Adding more steps" },
      { id: "break-down-the-individual-steps", label: "Break down the steps" },
    ],
  },
  {
    id: "crane-step-3",
    label: "Step 3: Identifying Decisions",
    children: [
      { id: "identifying-decision-points", label: "Identifying decision points" },
      { id: "finding-the-source-of-information", label: "Finding the source" },
      { id: "deciding-where-to-stop", label: "Where to stop" },
    ],
  },
];

const getCraneImageSrc = (baseName: string, imageMap: Record<string, string>, fallbackExt: string = "svg") =>
  `/crane/${baseName}.${imageMap[baseName] ?? fallbackExt}`;

export default function Page({ imageMap }: { imageMap: Record<string, string> }) {
  return (
    <>
      <Head>
        <title>Analysing a Crane Lift | Activity Diagram Editor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="favicon.ico" />
      </Head>
      <Container>
      <div className="row">
    <div className="col mb-2 mb-lg-5">
    <h1 id="page-top" className="display-4 font-weight-normal">Analysing a Crane Lift</h1>
    </div>
  </div>
        <div className="doc-page-layout">
          <JumpLinks items={craneSections} label="Jump to section" />
          <div className="doc-page-content">

            {/* Overview */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2">
              <Col id="crane-overview" className="amrc-text doc-section-heading">
                <p>This document walks through the process of analysing the
                data required to perform an industrial activity, in this
                case a lift with an overhead crane. The purpose of this
                analysis is to illustrate the application of the
                activity analysis method.</p>

                <p>This analysis performs Step 2 of the {}<Link
                href="intro">information requirements methodology</Link>,
                that of identifying all participants involved in the
                activity in question and breaking down the steps in the
                activity until decision points can be identified.</p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
                <picture>
                  <img className="w-100" src={getCraneImageSrc("crane-lift", imageMap, "jpeg")} alt="" />
                </picture>
              </Col>
            </Row>

            {/* Top-level approach */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h2 id="top-level-approach" className="doc-section-heading">Top-level approach</h2>
                <p>At the top level, the methodology is about identifying
                information that is required, and deciding how to make sure
                that information is provided at an appropriate quality. It
                is important that the first step is performed objectively,
                without being biased by what is already available; it is
                very easy to talk yourself into believing the information
                you have currently is what you need.</p>

                <p>This doesn&apos;t mean your existing information
                infrastructure needs to be thrown out; it means that you
                need an unbiased assessment of what information you require
                before you start looking at whether the current systems can
                supply that information, and where the shortfalls are. (It
                may also be the case that you find you are currently
                collecting a lot of data you can&apos;t make any use of.)</p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
                {/* No image specifically for top-level approach, leaving blank or omitting column, but keeping structure */}
              </Col>
            </Row>

            {/* Step 1 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h2 id="crane-step-1" className="doc-section-heading">Step 1: Lifecycle Activity Model</h2>
                <p> Everything has a lifecycle; comprising at least a start 
                and an end. Activities are no different. If we wish to 
                support decisions with information throughout the lifecycle 
                of a set of business activities we need to have some 
                representation of what these activities are.</p>
                
                <p>If done diligently the activity models can be used directly
                to develop information models that match the intended 
                activities. As part of a continuous approach to improvement, 
                the activity models can support business performance analysis 
                and can be updated to better reflect ongoing activities.</p>

                <p>In some industries there will be existing libraries of
                activity models (or process models) which can be used or
                adapted for this purpose. However, in most cases these will
                not exist. In this situation it is probably easier to start
                by analysing a few of your existing processes, and build up
                a library of common activity types as you go. The diagram
                editor option to import and export reference data (activity,
                resource and participant types) may be helpful here.</p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
              </Col>
            </Row>

            {/* Step 2 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h2 id="crane-step-2" className="doc-section-heading">Step 2: Analysing the Activities</h2>
                <p>The first step in analysing a particular activity is to
                identify the steps involved and the points where decisions
                are required. In this case we started with an existing
                Method Statement document specifying how to perform the lift
                and generated a diagram showing the steps involved, the
                objects (human, mechanical and documentary) listed in the
                Method Statement as being involved in the lift, and which
                steps required which participants.</p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
              </Col>
            </Row>

            {/* Representing a step */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="representing-a-step-on-the-diagram" className="doc-section-heading">Representing a step on the diagram</h3>
                <p>Take the first step in the process as documented, and {}
                <Link href="manual#creating-a-diagram">represent it on the
                diagram</Link>. Horizontal boxes represent physical objects
                involved in the process: people, machines, documents,
                anything at all in the real world that might affect the
                outcome of the activity. Vertical boxes represent
                activities, or steps in activities; these are arranged in a
                timeline. Filled in sections where an activity and a
                physical object overlap indicate that the object is directly
                involved in this step of the activity.
                </p>

                <p>There are two people involved in this activity; they have
                both been given the type &lsquo;Person&rsquo;. The activity
                itself has been given the type &lsquo;Briefing&rsquo;; if we
                were carrying our analysis on to further activities it would
                be useful to be able to identify all the
                &lsquo;Briefing&rsquo; steps across all analysed activities,
                for example to require that a suitable record must be
                kept.</p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
                <picture><ModalImage className="img-fluid border rounded shadow-sm zoom-cursor-img w-100" small={getCraneImageSrc("rams-briefing", imageMap)} large={getCraneImageSrc("rams-briefing", imageMap)} imageBackgroundColor="#fff" alt="" /></picture>
              </Col>
            </Row>

            {/* Adding more steps */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="adding-more-steps" className="doc-section-heading">Adding more steps</h3>
                <p>Continue adding the rest of the steps in the process as
                documented. Create new physical objects as needed and add
                them to the activity steps they are involved in.
                </p>

                <p>The analysis at this point is very much following the
                process documentation as given in the original Method
                Statement document. This means that we have not yet tried to
                identify any activity participants not originally part of
                the process documentation. To do this we need to start
                breaking down the steps further, and looking in more detail
                at what each step involves.</p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0 d-flex flex-column gap-3">
                <picture><ModalImage className="img-fluid border rounded shadow-sm zoom-cursor-img w-100" small={getCraneImageSrc("rams-review", imageMap)} large={getCraneImageSrc("rams-review", imageMap)} imageBackgroundColor="#fff" alt="" /></picture>
                <picture><ModalImage className="img-fluid border rounded shadow-sm zoom-cursor-img w-100" small={getCraneImageSrc("rams-walk-route", imageMap)} large={getCraneImageSrc("rams-walk-route", imageMap)} imageBackgroundColor="#fff" alt="" /></picture>
                <picture><ModalImage className="img-fluid border rounded shadow-sm zoom-cursor-img w-100" small={getCraneImageSrc("rams-complete", imageMap)} large={getCraneImageSrc("rams-complete", imageMap)} imageBackgroundColor="#fff" alt="" /></picture>
              </Col>
            </Row>

            {/* Break down the individual steps */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="break-down-the-individual-steps" className="doc-section-heading">Break down the individual steps</h3>
                <p>It is then necessary to further analyse each step,
                breaking it down further if necessary and identifying the
                decision points. It is important at this stage to also
                identify any additional physical objects participating in
                the activity which have been missed; this is easier to do as
                you &lsquo;drill down&rsquo; into the detail of the activity.</p>

                <p>Here is one of the steps from the lift above, represented
                on a separate diagram.</p>
                <picture><ModalImage className="img-fluid border rounded shadow-sm zoom-cursor-img w-100" small={getCraneImageSrc("sub-inspect-inspect", imageMap)} large={getCraneImageSrc("sub-inspect-inspect", imageMap)} imageBackgroundColor="#fff" alt="" /></picture>
                <br />

                <p>Looking into the activity at this level of detail has
                identified more participants in the activity: there are
                safety inspection tags on the equipment which must be
                checked, and a quarantine area where unsafe equipment is
                kept for inspection or disposal.</p>

                <p>In this diagram there are steps which may be omitted (if
                the equipment is safe it will not be quarantined) and steps
                which may be repeated (if we quarantine unsafe equipment we
                need to choose another set and re-inspect). There are also
                situations (an unsafe crane) where the entire activity will
                need to be abandoned. Currently it is not clear how best to
                model these situations; work is ongoing.</p>

                <p>To create a sub-task breakdown like this, <Link
                href="manual#breaking-down-activities">open the sub-tasks
                of one of the existing steps</Link>. This will open a new
                diagram view showing sub-tasks of the chosen task. Now start
                creating activities as before.</p>

                <p>Create new individuals as needed; these will also show
                up on the top-level view.</p>

                <p>Once the sub-task has been analysed, it is helpful to go
                back to the top-level view and add the new individuals
                identified as participants in the top-level activity.</p>

                <p>This can be loaded as an example in the Editor.</p>

                <p>The completed diagram can be loaded into the editor from
                the examples menu.</p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0 d-flex flex-column gap-3">
                <picture><ModalImage className="img-fluid border rounded shadow-sm zoom-cursor-img w-100" small={getCraneImageSrc("sub-inspect-first", imageMap)} large={getCraneImageSrc("sub-inspect-first", imageMap)} imageBackgroundColor="#fff" alt="" /></picture>
                <picture><ModalImage className="img-fluid border rounded shadow-sm zoom-cursor-img w-100" small={getCraneImageSrc("sub-inspect-quarantine", imageMap)} large={getCraneImageSrc("sub-inspect-quarantine", imageMap)} imageBackgroundColor="#fff" alt="" /></picture>
                <picture><ModalImage className="img-fluid border rounded shadow-sm zoom-cursor-img w-100" small={getCraneImageSrc("sub-inspect-inspect", imageMap)} large={getCraneImageSrc("sub-inspect-inspect", imageMap)} imageBackgroundColor="#fff" alt="" /></picture>
                <picture><ModalImage className="img-fluid border rounded shadow-sm zoom-cursor-img w-100" small={getCraneImageSrc("sub-inspect-top", imageMap)} large={getCraneImageSrc("sub-inspect-top", imageMap)} imageBackgroundColor="#fff" alt="" /></picture>
              </Col>
            </Row>

            {/* Step 3 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h2 id="crane-step-3" className="doc-section-heading">Step 3: Identifying Decisions</h2>
                <p>This step has not been carried out in detail, as it is
                out of the scope of the activity diagram editor as such.
                Currently this step would need to be performed manually, by
                making lists of the activities identified and the decisions
                involved. Our hope is that in the future tooling can be
                developed to make this stage of the analysis easier.</p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
              </Col>
            </Row>

            {/* Identifying decision points */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="identifying-decision-points" className="doc-section-heading">Identifying decision points</h3>
                <p>Decisions are normally made at the start or end of
                activities. A decision in the middle of an activity normally
                indicates that there are sub-tasks that need further
                analysis. So, given our breakdown of the steps in the
                activity, we can look at each step and ask:</p>

                <ul>
                 <li>Do we need to make a decision at the start or end of
                 this task?</li>
                 <li>What information do we require to make those decisions?</li>
                 <li>Where does that information come from?</li>
                </ul>

                <p>For even a relatively simple process this can result in a
                lot of information requirements, but without performing the
                analysis we have no way of knowing whether these
                requirements can be met consistently.</p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
              </Col>
            </Row>

            {/* Finding the source of the information */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="finding-the-source-of-information" className="doc-section-heading">Finding the source of the information</h3>
                <p>Having identified the decision points in the activity,
                and the information required to make these decisions, we now
                need to track the objects involved back in time to find
                where this information was created.</p>

                <p>Sometimes this may involve going a long way back. For
                example, part of deciding whether the crane is safe to use
                involves checking the safety tag put on by the insurance
                safety inspector; this means we need to track the history of
                the crane back at least as far as the last inspection.
                Deciding whether the crane is capable of performing the lift
                requires the crane&apos;s working limits, which were
                supplied to us at the time the crane was bought.</p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
                <picture><ModalImage className="img-fluid border rounded shadow-sm zoom-cursor-img w-100" small={getCraneImageSrc("life-crane", imageMap)} large={getCraneImageSrc("life-crane", imageMap)} imageBackgroundColor="#fff" alt="" /></picture>
              </Col>
            </Row>

            {/* Deciding where to stop */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="deciding-where-to-stop" className="doc-section-heading">Deciding where to stop</h3>
                <p>One of the important questions to ask here is &lsquo;when
                do we stop analysing&rsquo;. The answer is &lsquo;when you
                have identified all the information you need for your
                original activity&rsquo;, but the only way to really be sure
                you have identified everything is to go at least one step
                further than you need, so that you can see that the new
                information you are identifying does not bear on the
                original activity.</p>

                <p>For the purposes of our analysis, we are going to say
                that information about the actual inspection represented by
                the safety tag is out of scope, and the only information
                required by the safety check step is whether a valid tag is
                present or not. However, it is important to recognise that
                information quality management is a process, and we may need
                to revisit decisions like this later.</p>

                <p className="doc-back-to-top mt-5"><a href="#page-top">Back to top</a></p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
              </Col>
            </Row>

          </div>
        </div>
      </Container>
    </>
  );
}
