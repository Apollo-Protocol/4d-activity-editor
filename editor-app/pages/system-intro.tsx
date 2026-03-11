import Head from "next/head";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { Col, Container, Row } from "react-bootstrap";
import JumpLinks, { JumpLinkItem } from "@/components/JumpLinks";
// @ts-ignore
import ModalImage from "react-modal-image";

export async function getStaticProps() {
  const imagesDir = path.join(process.cwd(), 'public', 'system-intro');
  let files: string[] = [];
  try {
    files = fs.readdirSync(imagesDir);
  } catch (e) {
    // ignore
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

const systemIntroSections: JumpLinkItem[] = [
  { id: "system-overview", label: "Overview" },
  { id: "system-step-1", label: "Step 1: Create the system" },
  { id: "system-step-2", label: "Step 2: Add system components" },
  { id: "system-step-3", label: "Step 3: Fuse individuals" },
  { id: "system-step-4", label: "Step 4: Check activities against entities" },
  { id: "system-validations", label: "Validations and safeguards" },
];

const ImageComponent = ({
  alt,
  src,
  maxWidth,
  imageMap,
}: {
  alt: string;
  src?: string;
  maxWidth?: string;
  imageMap?: Record<string, string>;
}) => {
  const filenameBase = alt.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const finalExt = (imageMap && imageMap[filenameBase]) ?? "png";
  const generatedSrc = src ?? `/system-intro/${filenameBase}.${finalExt}`;
  return (
    <div style={{ width: "100%", maxWidth: maxWidth ?? "300px", margin: "0 auto" }}>
      <ModalImage 
        small={generatedSrc}
        large={generatedSrc}
        alt={alt}
        className="img-fluid mb-3 mt-3 border rounded shadow-sm w-100 zoom-cursor-img"
        imageBackgroundColor="#fff"
      />
    </div>
  );
};

const ValidationImagePlaceholder = ({ title }: { title: string }) => {
  return (
    <div className="border rounded shadow-sm bg-light h-100 d-flex align-items-center justify-content-center text-center p-3">
      <div>
        <div className="fw-semibold">{title}</div>
        <div className="small text-muted mt-2">Add screenshot when available</div>
      </div>
    </div>
  );
};

export default function Page({ imageMap }: { imageMap: Record<string, string> }) {
  const validationGalleryItems: Array<{ title: string; alt?: string; src?: string }> = [
    {
      title: "System component needs a parent system",
      alt: "system component parent required",
    },
    {
      title: "System component must belong to a system",
      alt: "system component must belong to system",
    },
    {
      title: "Installation rows must fit slot and entity bounds",
      alt: "installation bounds validation",
    },
    {
      title: "Affected-items warning before trimming or removal",
      alt: "affected items warning",
    },
  ];

  return (
    <>
      <Head>
        <title>System and Component Modelling | Activity Diagram Editor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="favicon.ico" />
      </Head>
      <Container>
        <div className="row">
          <div className="col mb-2 mb-lg-5">
            <h1 id="page-top" className="display-4 font-weight-normal">
              Introduction to System and Component Modelling
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
                  parent asset or assembly. A <strong>System Component</strong> defines a named slot or
                  role within that system. An <strong>Individual</strong> can then be
                  fused with one or more system-component slots across specific time ranges
                  (these fusions are called <em>installations</em> in the editor).
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
                <ImageComponent
                  alt="system overview diagram"
                />
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
                <ImageComponent
                  alt="creating a system entity"
                  maxWidth="300px"
                />
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
                  <strong> Component Of System</strong> field to select its parent system.
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
                <ImageComponent
                  alt="adding a system component"
                  maxWidth="300px"
                />
              </Col>
            </Row>

            {/* Step 3 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-step-3" className="doc-section-heading">
                  Step 3: Fuse individuals into component slots
                </h4>
                <p>
                  Installation periods are applied to ordinary individuals, not to systems or system
                  components. An installation represents the fusion of an individual with a
                  system-component slot for a specific time range. Once an individual exists,
                  reopen it in edit mode and use the
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
                <ImageComponent
                  alt="installation period modal"
                />
              </Col>
            </Row>

            {/* Step 4 */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-step-4" className="doc-section-heading">
                  Step 4: Check activities against entities
                </h4>
                <p>
                  Activities still use participants in the usual way, but the participant list is
                  organised by systems, system components, and individuals. Only entities whose
                  lifespan overlaps the activity time window appear as valid options. For
                  individuals with installation periods, those periods are checked as an additional
                  constraint before the participation is accepted.
                </p>
                <p>
                  This is the point where system modelling becomes useful rather than decorative.
                  The activity model and the entity model start checking one another, so the
                  participant options reflect the structure and time bounds already captured in the
                  diagram.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent
                  alt="activity validation against entities"
                  maxWidth="300px"
                />
              </Col>
            </Row>

            {/* Validations */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col id="system-validations" className="amrc-text doc-section-heading">
                <h4>Validations and safeguards</h4>
                <p>
                  The system and entity workflow includes several checks to prevent invalid or
                  inconsistent states:
                </p>
                <ul>
                  <li>A system component cannot be saved without a parent system.</li>
                  <li>A system component can only be a component of an entity that is itself a system.</li>
                  <li>Installation rows must include a valid system component and a non-negative beginning.</li>
                  <li>Each installation ending must be after its beginning.</li>
                  <li>Installation periods must stay within both the system-component bounds and the installed individual&apos;s own bounds.</li>
                  <li>Two rows for the same individual cannot overlap in the same system-component slot.</li>
                  <li>Two different individuals cannot overlap in the same component slot at the same time.</li>
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
              <Col className="col-md align-self-start">
                <Row className="g-3 mt-1">
                  {validationGalleryItems.map((item, index) => {
                    const isFirstRow = index < 2;
                    return (
                      <Col key={item.title} className={isFirstRow ? "col-6" : "col-12"}>
                        <div className="h-100 d-flex flex-column">
                          {item.alt ? (
                            <ImageComponent
                              alt={item.alt}
                              src={item.src}
                              maxWidth="100%"
                            />
                          ) : (
                            <ValidationImagePlaceholder title={item.title} />
                          )}
                          <div className="small text-muted text-center px-2 mt-auto">{item.title}</div>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
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
