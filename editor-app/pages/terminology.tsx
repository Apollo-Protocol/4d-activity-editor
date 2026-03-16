import Head from "next/head";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { Col, Container, Row } from "react-bootstrap";
// @ts-ignore
import ModalImage from "react-modal-image";
import JumpLinks from "../components/JumpLinks";

const terminologySections = [
  { id: "individual", label: "Individual" },
  { id: "activity", label: "Activity" },
  { id: "participation", label: "Participation" },
  { id: "system", label: "System" },
  { id: "system-component", label: "System Component" },
  { id: "installation", label: "Installation" },
  { id: "state", label: "State" },
  { id: "event", label: "Event" },
  { id: "temporal-boundaries", label: "Temporal Boundaries" },
  { id: "space-axis", label: "Space Axis (Y-Axis)" },
  { id: "time-axis", label: "Time Axis (X-Axis)" }
];

export async function getStaticProps() {
  const imagesDir = path.join(process.cwd(), "public", "manual");
  let files: string[] = [];
  try {
    files = fs.readdirSync(imagesDir);
  } catch (e) {}

  const imageMap: Record<string, string> = {};
  files.forEach((file) => {
    const parsed = path.parse(file);
    if (parsed.ext) {
      imageMap[parsed.name] = parsed.ext.replace(".", "");
    }
  });

  return { props: { imageMap } };
}

export default function Terminology({ imageMap }: { imageMap: Record<string, string> }) {
  const ImageComponent = ({ src, alt, maxWidth }: { src?: string; alt: string; maxWidth?: string }) => {
    const filenameBase = alt.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const modalAlt = filenameBase
      .split(/[_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    const finalExt = imageMap[filenameBase] || 'png';
    const finalSrc = src || `/manual/${filenameBase}.${finalExt}`;
    const resolvedMaxWidth = maxWidth ?? (finalExt === "gif" ? "460px" : (filenameBase.startsWith("terminology_") || filenameBase.startsWith("settings_") ? "380px" : "300px"));

    return (
      <div style={{ width: "100%", maxWidth: resolvedMaxWidth, margin: "0 auto" }}>
        <ModalImage
          small={finalSrc}
          large={finalSrc}
          alt={modalAlt}
          className="img-fluid mb-5 mt-3 border rounded shadow-sm w-100 zoom-cursor-img"
          imageBackgroundColor="#fff"
        />
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Terminology | Activity Diagram Editor</title>
      </Head>

      <Container>
        <div className="row">
          <div className="col mb-2 mb-lg-5">
            <h1 id="page-top" className="display-4 font-weight-normal">Terminology</h1>
          </div>
        </div>

        <div className="doc-page-layout">
          <JumpLinks items={terminologySections} />
          <div className="doc-page-content">
            <Row className="g-3 mb-3 align-items-start">
                <Col lg={6}>
                <p className="lead">
                  The editor is built on a 4-dimensionalism modelling approach where every element is a chunk of space and time. Understanding the following concepts is essential for interpreting the diagram&apos;s layout and accurately mapping your data to the visual canvas.
                </p>
                <p className="lead mb-4">
                  Below is a reference guide to the core terms used throughout the editor.
                </p>
                <Link href="/manual" className="btn btn-outline-secondary mb-4">Back to User Guide</Link>
              </Col>
              <Col lg={6} className="text-center">
                <ImageComponent alt="terminology overview" maxWidth="530px" />
              </Col>
            </Row>
                
                

                <Row className="g-3 align-items-start mb-2">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt id='individual' className='doc-section-heading'>Individual</dt>
                      <dd className="mb-0">
                        Something that persists through space and time, such as a person, a piece of
                        equipment, an organisation, or a document. On the diagram each individual is
                        drawn as a horizontal band running left to right for the duration of its
                        existence.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology individual" />
                  </Col>
                </Row>

                <Row className="g-3 align-items-start mb-2">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt id='activity' className='doc-section-heading'>Activity</dt>
                      <dd className="mb-0">
                        A bounded period during which entities come together to achieve
                        something. On the diagram an activity is rendered as an outline rectangle
                        spanning the time window and the participating entity rows.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology activity" />
                  </Col>
                </Row>

                <Row className="g-3 align-items-start mb-2">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt id='participation' className='doc-section-heading'>Participation</dt>
                      <dd className="mb-0">
                        The link between an entity and an activity for a defined period.
                        On the diagram a participation is shown as a filled block at the
                        intersection of the entity&apos;s row and the activity&apos;s time span.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology participation" />
                  </Col>
                </Row>

                <Row className="g-3 align-items-start mb-2">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt id='system' className='doc-section-heading'>System</dt>
                      <dd className="mb-0">
                        A structured assembly of system components. A system is drawn as a large
                        outline rectangle whose interior contains its entities.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology system" />
                  </Col>
                </Row>

                <Row className="g-3 align-items-start mb-2">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt id='system-component' className='doc-section-heading'>System Component</dt>
                      <dd className="mb-0">
                        A persistent role or slot within a system. It represents a named position
                        that may be filled by different individuals over time; the role persists
                        even when temporarily unfilled. A system component is a <em>component of</em>
                        {" "}its parent system.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology system component" />
                  </Col>
                </Row>

                <Row className="g-3 align-items-start mb-3">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt id='installation' className='doc-section-heading'>Installation</dt>
                      <dd className="mb-0">
                        The fusion of an individual with a system-component slot for a specific
                        time range. Installations allow the same slot to be occupied by different
                        individuals at different times.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology installation" />
                  </Col>
                </Row>

                <Row>
                  <Col lg={6}>
                    <dl>
                      <dt id='state' className='doc-section-heading'>State</dt>
                      <dd>
                        A qualitative property of an entity that changes over time (e.g.
                        Open/Closed, Running/Stopped). States are rendered as distinctly shaded
                        segments within an entity&apos;s band.
                      </dd>

                      <dt id='event' className='doc-section-heading'>Event</dt>
                      <dd>
                        An entity with minimal or zero temporal extent, representing an
                        instantaneous or near-instantaneous occurrence rather than a
                        persisting state.
                      </dd>

                      <dt id='temporal-boundaries' className='doc-section-heading'>Temporal Boundaries</dt>
                      <dd>
                        Every entity has a beginning and an ending. A flat vertical edge means
                        the bound is known; an open chevron means it is unknown. Both ends are
                        set independently.
                      </dd>

                      <dt id='space-axis' className='doc-section-heading'>Space Axis (Y-Axis)</dt>
                      <dd>
                        The vertical axis of the diagram. It does not represent physical location;
                        it gives visual room to distinct entities. Vertical nesting encodes
                        part-whole relationships: if A is part of B, A&apos;s band sits within
                        B&apos;s extent on the diagram.
                      </dd>

                      <dt id='time-axis' className='doc-section-heading'>Time Axis (X-Axis)</dt>
                      <dd>
                        The horizontal axis, always running left to right in temporal sequence.
                        It can be linear (uniform scale) or non-linear (compressed/stretched
                        regions) depending on what needs emphasis.
                      </dd>
                    </dl>
                  </Col>
                </Row>

            {/* Adding Entities */}

            <p className="doc-back-to-top mt-5"><a href="#page-top">Back to top</a></p>
          </div>
        </div>
      </Container>
    </>
  );
}
