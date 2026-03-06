import Head from "next/head";
import Link from "next/link";
import { Col, Container, Row } from "react-bootstrap";
import JumpLinks, { JumpLinkItem } from "@/components/JumpLinks";

const systemIntroSections: JumpLinkItem[] = [
  { id: "system-overview", label: "Overview" },
  { id: "system-step-1", label: "Step 1: Create the system" },
  { id: "system-step-2", label: "Step 2: Add system components" },
  { id: "system-step-3", label: "Step 3: Install individuals" },
  { id: "system-step-4", label: "Step 4: Check activities" },
  { id: "system-validations", label: "Validations and safeguards" },
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
        <title>System and Installation Modelling | Activity Diagram Editor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="favicon.ico" />
      </Head>
      <Container>
        <div className="row">
          <div className="col mb-5">
            <h1 id="page-top" className="display-4 font-weight-normal">
              Introduction to System and Installation Modelling
            </h1>
          </div>
        </div>

        <div className="doc-page-layout">
          <JumpLinks items={systemIntroSections} label="Jump to section" />
          <div className="doc-page-content">

            {/* Overview */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2">
              <Col id="system-overview" className="amrc-text doc-section-heading">
                <p>
                  The editor can describe not only activities and participants, but also the
                  structure of a system and the periods during which replaceable objects occupy
                  named system-component slots. This is useful when the same physical location or
                  role in a system is filled by different items over time, or when you need to
                  validate that an activity only uses an installed object while it is actually in
                  place.
                </p>
                <p>
                  There are three entity categories involved. A <strong>System</strong> defines a
                  parent asset or assembly. A <strong>System Component</strong> defines a slot or
                  bounded place within that system. An <strong>Individual</strong> can then be
                  installed into one or more system-component slots across specific time ranges.
                  That lets the editor represent both structure and change over time in the same
                  diagram.
                </p>
                <p>
                  This sits alongside the <Link href="/manual">editor guide</Link> and the
                  <Link href="/intro"> activity-modelling introduction</Link>. The difference is
                  that this guidance is focused on how the system structure is created, how
                  installation periods are managed, and how the editor validates those periods when
                  you create or change activities.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: system overview diagram" />
              </Col>
            </Row>

            {/* Step 1 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-step-1" className="doc-section-heading">
                  Step 1: Create the system
                </h4>
                <p>
                  Start by creating an entity and setting its category to <strong>System</strong>.
                  This creates the top-level container for the part of the asset or assembly you are
                  modelling. Give it a name, type, and a beginning and ending that represent the
                  period during which that system exists in the model.
                </p>
                <p>
                  The system lifespan matters because dependent system components and installation
                  periods are checked against it. If the system is shortened later, the editor can
                  warn that nested components, installations, and activity participations will need
                  to be trimmed or removed.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: creating a system entity" />
              </Col>
            </Row>

            {/* Step 2 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-step-2" className="doc-section-heading">
                  Step 2: Add system components
                </h4>
                <p>
                  A system component represents a named slot within a system. Create another entity,
                  change its category to <strong>System Component</strong>, and use the
                  <strong> Install To System</strong> field to select its parent system.
                </p>
                <p>
                  The editor requires a parent system before a system component can be saved. It also
                  checks that the selected parent really is a system, and it shows the parent bounds
                  while you are configuring the component. Multiple system components are allowed to
                  share the same slot range when that is useful for modelling alternatives or layered
                  structures.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: adding a system component" />
              </Col>
            </Row>

            {/* Step 3 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-step-3" className="doc-section-heading">
                  Step 3: Install individuals
                </h4>
                <p>
                  Installation periods are applied to ordinary individuals, not to systems or system
                  components. Once an individual exists, reopen it in edit mode and use the
                  <strong> Add Installation</strong> button. Each row records a target system
                  component, a start time, and an end time.
                </p>
                <p>
                  You can add multiple installation periods for the same individual, which makes it
                  possible to model replacement, movement between slots, or repeated use of the same
                  slot over time. The installation modal also shows occupied and available ranges for
                  the selected slot so the row can be checked before saving.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: installation period modal" />
              </Col>
            </Row>

            {/* Step 4 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-step-4" className="doc-section-heading">
                  Step 4: Check activities against installations
                </h4>
                <p>
                  Activities still use participants in the usual way, but an individual can only be
                  selected as a valid participant when the activity sits inside one of that
                  individual&apos;s installation windows. If an activity falls outside the installed
                  period, the editor raises a validation error instead of accepting the participation.
                </p>
                <p>
                  This is the point where system modelling becomes useful rather than decorative. The
                  activity model and the installation model start checking one another, so the
                  recorded activity only uses equipment while it is actually installed in the slot you
                  have modelled.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: activity validation against installation" />
              </Col>
            </Row>

            {/* Validations */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col id="system-validations" className="amrc-text doc-section-heading">
                <h4>Validations and safeguards</h4>
                <p>
                  The system and installation workflow includes several checks to prevent invalid or
                  inconsistent states:
                </p>
                <ul>
                  <li>A system component cannot be saved without a parent system.</li>
                  <li>A system component can only be installed into an entity that is itself a system.</li>
                  <li>Installation rows must include a valid system component and a non-negative beginning.</li>
                  <li>Each installation ending must be after its beginning.</li>
                  <li>Installation periods must stay within both the system-component bounds and the installed individual&apos;s own bounds.</li>
                  <li>Two rows for the same individual cannot overlap in the same system-component slot.</li>
                  <li>Two different individuals cannot overlap in the same component slot at the same time.</li>
                  <li>An activity participant is rejected when the activity is outside the individual&apos;s installation window.</li>
                </ul>
                <p>
                  The editor also sanitizes installation periods after individual updates. If a target
                  component no longer exists, or if the valid overlap between the individual, the
                  component, and the parent system disappears, the affected installation period is
                  removed automatically.
                </p>
                <p>
                  When you shorten a system or a system component, the editor opens an affected-items
                  warning before saving. That warning shows which nested components, installation
                  periods, and activity participations would be trimmed or removed so you can decide
                  whether to resolve or delete the affected records.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: validation warnings dialog" />
              </Col>
            </Row>

            <div className="d-flex flex-wrap gap-2 mt-4">
              <Link className="btn btn-outline-secondary" href="/system-example">
                See a worked example
              </Link>
              <Link className="btn btn-outline-secondary" href="/manual">
                Read the editor guide
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