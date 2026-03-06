import Head from "next/head";
import Link from "next/link";
import { Col, Container, Row } from "react-bootstrap";
import JumpLinks, { JumpLinkItem } from "@/components/JumpLinks";

const systemExampleSections: JumpLinkItem[] = [
  { id: "system-example-overview", label: "Overview" },
  { id: "system-example-step-1", label: "Step 1: Define the system" },
  { id: "system-example-step-2", label: "Step 2: Define the slots" },
  { id: "system-example-step-3", label: "Step 3: Install equipment" },
  { id: "system-example-step-4", label: "Step 4: Model activities" },
  { id: "system-example-step-5", label: "Step 5: Use warnings" },
  { id: "system-example-variations", label: "Suggested variations" },
];

const Placeholder = ({ alt }: { alt: string }) => (
  <picture>
    <div
      className="mb-5 mt-3"
      style={{
        backgroundColor: "#e9ecef",
        width: "100%",
        height: "200px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#6c757d",
        border: "1px dashed #ced4da",
        borderRadius: "4px",
        fontSize: "0.9rem",
      }}
    >
      {alt}
    </div>
  </picture>
);

export default function Page() {
  return (
    <>
      <Head>
        <title>System Component Example Analysis | Activity Diagram Editor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="favicon.ico" />
      </Head>
      <Container>
        <div className="row">
          <div className="col mb-5">
            <h1 id="page-top" className="display-4 font-weight-normal">
              Example Analysis: Modelling Replaceable Equipment in a System
            </h1>
          </div>
        </div>

        <div className="doc-page-layout">
          <JumpLinks items={systemExampleSections} label="Jump to section" />
          <div className="doc-page-content">

            {/* Overview */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2">
              <Col id="system-example-overview" className="amrc-text doc-section-heading">
                <p>
                  This is a suggested walkthrough you can recreate in the editor. The aim is to show
                  how system modelling complements activity modelling when equipment changes over
                  time. In this example, imagine a packaging cell with a controller cabinet, a vision
                  station, and a tool mount that can host different pieces of equipment through the
                  life of the cell.
                </p>
                <p>
                  The point of the exercise is not simply to draw the structure. It is to make later
                  activities testable against that structure so you can see whether inspection,
                  replacement, or commissioning work refers to equipment that is actually present at
                  the time shown on the diagram.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: example overview diagram" />
              </Col>
            </Row>

            {/* Step 1 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-example-step-1" className="doc-section-heading">
                  Step 1: Define the system
                </h4>
                <p>
                  Create a system called <strong>Packaging Cell A</strong> and give it a lifespan that
                  represents the period you want to analyse. This creates the parent entity for the
                  rest of the structure.
                </p>
                <p>
                  At this stage it is helpful to decide the level of detail you need. If decisions are
                  made against the whole cell, model the whole cell as a system. If the decisions are
                  really about one skidded subsystem or one cabinet, create that as the system instead.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: creating Packaging Cell A" />
              </Col>
            </Row>

            {/* Step 2 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-example-step-2" className="doc-section-heading">
                  Step 2: Define the slots
                </h4>
                <p>
                  Add system components such as <strong>Main Controller Slot</strong>,
                  <strong> Vision Camera Mount</strong>, and <strong>Tool Head Position</strong>. Each
                  one should be installed into <strong>Packaging Cell A</strong> and given bounds that
                  describe when that slot exists in the model.
                </p>
                <p>
                  This is the structural part of the model. The component is not the device installed
                  there. It is the named place in the system where a device may be installed. That
                  distinction is what allows you to replace equipment later without losing the slot
                  identity.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: defining system component slots" />
              </Col>
            </Row>

            {/* Step 3 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-example-step-3" className="doc-section-heading">
                  Step 3: Install equipment over time
                </h4>
                <p>
                  Create ordinary individuals for the equipment itself, for example
                  <strong> PLC Unit 01</strong>, <strong>Camera Unit 01</strong>, and later
                  <strong> Camera Unit 02</strong>. Reopen those individuals and add installation rows
                  that place them into the relevant component slots for the correct periods.
                </p>
                <p>
                  A useful pattern is to model a replacement explicitly. Let <strong>Camera Unit 01</strong>
                  {" "}end its installation when it is removed, and let <strong>Camera Unit 02</strong>
                  {" "}start when it is fitted. The editor will reject overlapping occupancy of the same
                  slot, which makes the changeover visible and unambiguous.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: installation periods for equipment" />
              </Col>
            </Row>

            {/* Step 4 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-example-step-4" className="doc-section-heading">
                  Step 4: Model activities against the installed equipment
                </h4>
                <p>
                  Now create activities such as <strong>Commission Cell</strong>, <strong>Inspect
                  Vision Station</strong>, <strong>Replace Camera</strong>, and <strong>Validate Tool
                  Setup</strong>. Add the relevant installed individuals as participants.
                </p>
                <p>
                  The key check happens here. If <strong>Inspect Vision Station</strong> is dated after
                  <strong> Camera Unit 01</strong> has been removed and before <strong>Camera Unit 02</strong>
                  {" "}is installed, the editor will flag that participant as outside the installation
                  window. That tells you the activity model and the installation model disagree.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: activity validation against installations" />
              </Col>
            </Row>

            {/* Step 5 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-example-step-5" className="doc-section-heading">
                  Step 5: Use the affected-items warnings
                </h4>
                <p>
                  The final step is to deliberately test the warnings. Shorten the system lifespan or
                  one of the component slot lifespans and observe the affected-items dialog. The
                  editor will list what would be trimmed or removed: dependent components, installation
                  periods, and activity participations.
                </p>
                <p>
                  This warning is valuable because it shows how much downstream meaning is attached to
                  the structural model. Once activities depend on installed equipment, changing the
                  structure is no longer a cosmetic change. It changes which records remain valid.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: affected-items warning dialog" />
              </Col>
            </Row>

            {/* Variations */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-example-variations" className="doc-section-heading">
                  Suggested variations
                </h4>
                <p>
                  The same approach can be applied to many other scenarios. Good candidates for future
                  worked examples are an air-handling unit with replaceable filters, a power cabinet
                  with swapped modules, or a maintenance bay where tools and fixtures occupy specific
                  stations across different jobs.
                </p>
                <p>
                  If you want this page to become a fuller worked example later, the next step would
                  be to add a dedicated example file to the editor&apos;s examples menu and reference it
                  from this walkthrough in the same way the crane example is handled for activity
                  modelling.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: suggested variation diagram" />
              </Col>
            </Row>

            <div className="d-flex flex-wrap gap-2 mt-4">
              <Link className="btn btn-outline-secondary" href="/system-intro">
                Read the introduction
              </Link>
              <Link className="btn btn-outline-secondary" href="/intro">
                Compare with activity modelling
              </Link>
              <Link className="btn btn-outline-secondary" href="/editor">
                Try the editor
              </Link>
            </div>
            <p className="doc-back-to-top mt-5">
              <a href="#page-top">Back to top</a>
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}