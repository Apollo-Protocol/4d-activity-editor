import Head from "next/head";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { Col, Container, Row } from "react-bootstrap";
import JumpLinks, { JumpLinkItem } from "@/components/JumpLinks";
// @ts-ignore
import ModalImage from "react-modal-image";

export async function getStaticProps() {
  const imagesDir = path.join(process.cwd(), 'public', 'system-example');
  let files: string[] = [];
  try {
    files = fs.readdirSync(imagesDir);
  } catch (e) {
    // ignore if directory doesn't exist
  }
  const imageMap: Record<string, string> = {};
  files.forEach(file => {
    const parsed = path.parse(file);
    if (parsed.ext) {
      imageMap[parsed.name] = parsed.ext.replace('.', '');
    }
  });

  return {
    props: {
      imageMap
    }
  };
}

const systemExampleSections: JumpLinkItem[] = [
  { id: "system-example-overview", label: "Overview" },
  { id: "system-example-step-1", label: "Step 1: Define the system" },
  { id: "system-example-step-2", label: "Step 2: Define the slots" },
  { id: "system-example-step-3", label: "Step 3: Fuse equipment" },
  { id: "system-example-step-4", label: "Step 4: Model activities" },
  { id: "system-example-warnings", label: "Use the affected-items warnings" },
  { id: "system-example-full", label: "Load the full example" },
];

const ImageComponent = ({
  alt,
  src,
  ext,
  imageMap,
}: {
  alt: string;
  src?: string;
  ext?: string;
  imageMap?: Record<string, string>;
}) => {
  const filenameBase = alt.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const modalAlt = filenameBase
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  
  // Auto-detect extension from imageMap if available, else fallback to 'ext' prop or 'png'
  const finalExt = ext ?? (imageMap && imageMap[filenameBase]) ?? "png";
  
  const generatedSrc = src ?? `/system-example/${filenameBase}.${finalExt}`;
  return (
    <div style={{ width: "100%", margin: "0 auto" }}>
      <ModalImage
        small={generatedSrc}
        large={generatedSrc}
        alt={modalAlt}
        className="img-fluid mb-1 mt-3 border rounded shadow-sm w-100 zoom-cursor-img"
        imageBackgroundColor="#fff"
      />
    </div>
  );
};

export default function Page({ imageMap }: { imageMap: Record<string, string> }) {
  return (
    <>
      <Head>
        <title>System Component Example Analysis | Activity Diagram Editor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="favicon.ico" />
      </Head>
      <Container>
        <div className="row">
          <div className="col mb-2 mb-lg-5">
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
                <p className="lead">
                  This is a suggested walkthrough you can recreate in the editor. The aim is to show
                  how system modelling complements activity modelling when equipment changes over
                  time. In this example, imagine a packaging cell with a controller cabinet, a vision
                  station, and a tool mount that can host different pieces of equipment through the
                  life of the cell.
                </p>
                <p className="lead">
                  The point of the exercise is not simply to draw the structure. It is to make later
                  activities testable against that structure so you can see whether inspection,
                  replacement, or commissioning work refers to equipment that is actually present at
                  the time shown on the diagram.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent imageMap={imageMap} alt="example overview diagram" />
                <p className="text-muted small mt-1 mb-0 text-center">
                  Image courtesy of <a href="https://motioncontrolsrobotics.com/resources/case-study/two-packaging-lines-one-palletizing-station/" target="_blank" rel="noopener noreferrer">Motion Controls Robotics</a>
                </p>
              </Col>
            </Row>

            {/* Step 1 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h2 id="system-example-step-1" className="doc-section-heading">
                  Step 1: Define the system
                </h2>
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
                <ImageComponent imageMap={imageMap} alt="creating Packaging Cell A" />
              </Col>
            </Row>

            {/* Step 2 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h2 id="system-example-step-2" className="doc-section-heading">
                  Step 2: Define the slots
                </h2>
                <p>
                  Add system components such as <strong>Main Controller Slot</strong>,
                  <strong> Vision Camera Mount</strong>, and <strong>Tool Head Position</strong>. Each
                  one should be made a component of <strong>Packaging Cell A</strong> and given bounds that
                  describe when that slot exists in the model.
                </p>
                <p>
                  This is the structural part of the model. The component is not the device
                  occupying that position. It is the named place in the system where a device may be
                  fused. That distinction is what allows you to replace equipment later without
                  losing the slot identity.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent imageMap={imageMap} alt="defining system component slots" />
              </Col>
            </Row>

            {/* Step 3 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h2 id="system-example-step-3" className="doc-section-heading">
                  Step 3: Fuse equipment into component slots over time
                </h2>
                <p>
                  Create ordinary individuals for the equipment itself, for example
                  <strong> PLC Unit 01</strong>, <strong>Camera Unit 01</strong>, and later
                  <strong> Camera Unit 02</strong>. Reopen those individuals and add installation rows
                  (the editor calls these fusions &ldquo;installations&rdquo;)
                  that place them into the relevant component slots for the correct periods. For
                  this worked example, install <strong>Camera Unit 01</strong> into
                  <strong> Vision Camera Mount</strong> from <strong>0 to 5</strong>, then install
                  <strong> Camera Unit 02</strong> into the same mount from <strong>6 to 10</strong>.
                  Install <strong>PLC Unit 01</strong> into <strong>Main Controller Slot</strong>
                  from <strong>0 to infinity</strong>.
                </p>
                <p>
                  This gives you one clearly bounded replacement and one continuously installed item
                  for comparison. The editor will reject overlapping occupancy of the same slot, so
                  the camera handover stays explicit, while the always-installed PLC gives you a
                  participant that should stay valid across the full test period.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent imageMap={imageMap} alt="installation periods for equipment" />
              </Col>
            </Row>

            {/* Step 4 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h2 id="system-example-step-4" className="doc-section-heading">
                  Step 4: Model activities against the installed equipment
                </h2>
                <p>
                  This step is where the structure model starts doing useful checking. Create four
                  test activities. Because you define the start and end times and select participants
                  within the same form, you can immediately see whether the relevant installations
                  are available to pick for those specific time ranges.
                </p>
                <p>
                  For this example, try creating <strong>Inspect Vision Station A</strong> from
                  <strong> 1 to 4</strong>. In the participant list, the installation for <strong>Camera Unit 01 </strong>
                   should appear because it is installed from <strong>0 to 5</strong>. Then try creating
                  <strong> Camera Gap Check</strong> from <strong>5 to 6</strong>. For that activity,
                  neither camera installation will appear, because the activity falls into the handover gap
                  between the two installations. Next, try <strong>Inspect Vision Station B </strong>
                  from <strong>7 to 9</strong>, where the installation for <strong>Camera Unit 02</strong> should appear
                  because it is installed from <strong>6 to 10</strong>. Finally, try
                  <strong> PLC Check</strong> from <strong>2 to 8</strong>. The installation for <strong>PLC Unit 01 </strong>
                  should appear because it is installed in <strong>Main Controller Slot</strong> from
                  <strong> 0 to infinity</strong>. The practical test is simply whether the right
                  installation is available to choose.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent imageMap={imageMap} alt="activity validation against installations" />
              </Col>
            </Row>

            {/* Affected-items warnings */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h2 id="system-example-warnings" className="doc-section-heading">
                  Use the affected-items warnings
                </h2>
                <p>
                  After saving the activities above, reopen <strong>Camera Unit 01</strong> and shorten its bounds
                  so they no longer cover the full period from <strong>0 to 5</strong>. For example,
                  change it to <strong>2 to 3</strong> and save the edit.
                </p>
                <p>
                  That should produce a review dialog. The editor will list downstream items that
                  would be trimmed or removed, such as the installation of <strong>Camera Unit 01</strong>
                  into <strong>Vision Camera Mount</strong> and any activities that depend on it. In
                  practice, an activity like <strong>Inspect Vision Station A</strong> may be trimmed
                  if only part of its time range still overlaps, while an activity with no remaining
                  overlap would be removed. This is useful because it makes the consequences of
                  changing entity bounds explicit before the edit is applied.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent imageMap={imageMap} alt="affected-items warning dialog" />
              </Col>
            </Row>

            {/* Full Example */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h2 id="system-example-full" className="doc-section-heading">
                  Load the full example
                </h2>
                <p>
                  You can load the complete packaging cell setup directly in the editor by choosing
                  <strong> Packaging Cell</strong> from the examples menu. This will let you explore
                  the system hierarchy, individuals, and the validation checks in real time.
                </p>
                <p>
                  The same structural approach can be applied to many other scenarios where equipment
                  changes over time, such as an air-handling unit with replaceable filters, a power
                  cabinet with swapped modules, or a maintenance bay where tools and fixtures occupy
                  specific stations across different jobs.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center"></Col>
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
