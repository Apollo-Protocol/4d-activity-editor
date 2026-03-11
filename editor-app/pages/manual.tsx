import Head from "next/head";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { Col, Container, Row } from "react-bootstrap";
import JumpLinks, { JumpLinkItem } from "@/components/JumpLinks";
// @ts-ignore
import ModalImage from "react-modal-image";

export async function getStaticProps() {
  const imagesDir = path.join(process.cwd(), "public", "manual");
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

const manualSections: JumpLinkItem[] = [
  { id: "overview", label: "Overview" },
  { id: "terminology", label: "Terminology" },
  { id: "entities", label: "Adding Entities" },
  { id: "activities", label: "Adding Activities" },
  { id: "participations", label: "Adding Participations" },
  { id: "editing", label: "Type Editing" },
  { id: "activity-legend", label: "Activity Legend" },
  { id: "entity-legend", label: "Entity Legend" },
  { id: "highlight-activity", label: "Highlighting Activity" },
  { id: "edit-activity", label: "Editing Activity" },
  { id: "sub-tasks", label: "Breaking Down Activities" },
  { id: "zoom", label: "Zoom" },
  { id: "search-entity", label: "Search Entity" },
  { id: "undo-redo", label: "Undo & Redo" },
  { id: "hide-entities", label: "Hide Entities" },
  { id: "sort-drag", label: "Sorting by Dragging" },
  { id: "activity-color", label: "Picking Activity Color" },
  { id: "settings", label: "Settings", children: [
    { id: "settings-presentation", label: "Presentation Styles" },
    { id: "settings-layout", label: "Layout & Configuration" },
  ] },
  { id: "saving-loading", label: "Saving and Loading", children: [
    { id: "session-auto-saving", label: "Session Auto-Saving" },
    { id: "saving-turtle", label: "Turtle Files" },
    { id: "loading-example", label: "Loading an example" },
    { id: "export-formats", label: "Exporting other Formats" }
  ] },
];

const ImageComponent = ({ alt, src, maxWidth, imageMap }: { alt: string, src?: string, maxWidth?: string, imageMap?: Record<string, string> }) => {
  const filenameBase = alt.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const extension = (imageMap && imageMap[filenameBase]) ?? "png";
  const finalExt = extension;
  const generatedSrc = src || `/manual/${filenameBase}.${finalExt}`;
  const resolvedMaxWidth = maxWidth
    ?? (finalExt === "gif"
      ? "460px"
      : (filenameBase.startsWith("terminology_") || filenameBase.startsWith("settings_"))
        ? "380px"
        : "300px");
  return (
    <div style={{ width: "100%", maxWidth: resolvedMaxWidth, margin: "0 auto" }}>
      <ModalImage
        small={generatedSrc}
        large={generatedSrc}
        alt={alt}
        className="img-fluid mb-5 mt-3 border rounded shadow-sm w-100 zoom-cursor-img"
        imageBackgroundColor="#fff"
      />
    </div>
  );
};

export default function Page({ imageMap }: { imageMap: Record<string, string> }) {
  return (
    <>
      <Head>
        <title>Editor Guide | Activity Diagram Editor</title>
        <meta name="description" content="Comprehensive guide to the Activity Diagram Editor" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="favicon.ico" />
      </Head>
      <Container>
        <div className="row">
          <div className="col mb-2 mb-lg-5">
            <h1 id="page-top" className="display-4 font-weight-normal">Editor Guide</h1>
          </div>
        </div>

        <div className="doc-page-layout">
          <JumpLinks items={manualSections} label="Jump to section" />
          <div className="doc-page-content">

            {/* Overview */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2">
              <Col id="overview" className="amrc-text doc-section-heading">
                <p>
                  The Activity Diagram Editor is a browser-based tool for
                  creating, viewing and editing 4D activity diagrams.
                  These diagrams plot activities against time along the
                  horizontal axis and participating entities along the
                  vertical axis, showing at a glance which entities are
                  involved in which activities and when.
                </p>
                <p>
                  This guide walks through every feature of the editor,
                  from creating your first entity all the way to
                  customising the diagram layout and exporting results.
                  Each section below explains a single capability with
                  step-by-step instructions.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent src="/manual/overview.png" alt="editor overview" maxWidth="530px" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Terminology */}
            <Row className="row-cols-1 mt-5">
              <Col>
                <h4 id="terminology" className="doc-section-heading">Terminology</h4>
                <p>
                  The editor is built on a 4-dimensional modelling approach where everything
                  that exists occupies both space and time. The following terms are used
                  throughout this guide and in the editor itself:
                </p>

                <Row className="g-3 align-items-start mb-2">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt>Individual</dt>
                      <dd className="mb-0">
                        Something that persists through space and time, such as a person, a piece of
                        equipment, an organisation, or a document. On the diagram each individual is
                        drawn as a horizontal band running left to right for the duration of its
                        existence.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology individual" imageMap={imageMap} />
                  </Col>
                </Row>

                <Row className="g-3 align-items-start mb-2">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt>Activity</dt>
                      <dd className="mb-0">
                        A bounded period during which entities come together to achieve
                        something. On the diagram an activity is rendered as an outline rectangle
                        spanning the time window and the participating entity rows.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology activity" imageMap={imageMap} />
                  </Col>
                </Row>

                <Row className="g-3 align-items-start mb-2">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt>Participation</dt>
                      <dd className="mb-0">
                        The link between an entity and an activity for a defined period.
                        On the diagram a participation is shown as a filled block at the
                        intersection of the entity&apos;s row and the activity&apos;s time span.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology participation" imageMap={imageMap} />
                  </Col>
                </Row>

                <Row className="g-3 align-items-start mb-2">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt>System</dt>
                      <dd className="mb-0">
                        A structured assembly of system components. A system is drawn as a large
                        outline rectangle whose interior contains its entities.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology system" imageMap={imageMap} />
                  </Col>
                </Row>

                <Row className="g-3 align-items-start mb-2">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt>System Component</dt>
                      <dd className="mb-0">
                        A persistent role or slot within a system. It represents a named position
                        that may be filled by different individuals over time; the role persists
                        even when temporarily unfilled. A system component is a <em>component of</em>
                        {" "}its parent system.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology system component" imageMap={imageMap} />
                  </Col>
                </Row>

                <Row className="g-3 align-items-start mb-3">
                  <Col lg={6}>
                    <dl className="mb-0">
                      <dt>Installation</dt>
                      <dd className="mb-0">
                        The fusion of an individual with a system-component slot for a specific
                        time range. Installations allow the same slot to be occupied by different
                        individuals at different times.
                      </dd>
                    </dl>
                  </Col>
                  <Col lg={6} className="text-center">
                    <ImageComponent alt="terminology installation" imageMap={imageMap} />
                  </Col>
                </Row>

                <Row>
                  <Col lg={6}>
                    <dl>
                      <dt>State</dt>
                      <dd>
                        A qualitative property of an entity that changes over time (e.g.
                        Open/Closed, Running/Stopped). States are rendered as distinctly shaded
                        segments within an entity&apos;s band.
                      </dd>

                      <dt>Event</dt>
                      <dd>
                        An entity with minimal or zero temporal extent, representing an
                        instantaneous or near-instantaneous occurrence rather than a
                        persisting state.
                      </dd>

                      <dt>Temporal Boundaries</dt>
                      <dd>
                        Every entity has a beginning and an ending. A flat vertical edge means
                        the bound is known; an open chevron means it is unknown. Both ends are
                        set independently.
                      </dd>

                      <dt>Space Axis (Y-Axis)</dt>
                      <dd>
                        The vertical axis of the diagram. It does not represent physical location;
                        it gives visual room to distinct entities. Vertical nesting encodes
                        part-whole relationships: if A is part of B, A&apos;s band sits within
                        B&apos;s extent on the diagram.
                      </dd>

                      <dt>Time Axis (X-Axis)</dt>
                      <dd>
                        The horizontal axis, always running left to right in temporal sequence.
                        It can be linear (uniform scale) or non-linear (compressed/stretched
                        regions) depending on what needs emphasis.
                      </dd>
                    </dl>
                  </Col>
                </Row>
              </Col>
            </Row>

            {/* Adding Entities */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="entities" className="doc-section-heading">Adding Entities</h4>
                <p>
                  Entities represent the physical or conceptual objects that
                  participate in activities.  They appear as labelled rows on
                  the vertical (space) axis of the diagram.  To add a new
                  entity, open the <strong>Add Entity</strong> panel in the
                  toolbar. Select an entity type, enter a name, set the beginning and ending times,
                  and optionally select a type from the dropdown.  Press
                  &ldquo;Add&rdquo; and the entity appears as a new row on
                  the diagram.
                </p>
                <p>
                  The &lsquo;Type&rsquo; field can be used to categorise
                  entities, to assist with the analysis; there are three
                  built-in types, and more can be added with the
                  &lsquo;Add Type&rsquo; button.  To start with there is no
                  harm in leaving all individuals as the default
                  &lsquo;Resource&rsquo; type.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="add entity panel" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Adding Activities */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="activities" className="doc-section-heading">Adding Activities</h4>
                <p>
                  Activities are the temporal events that make up your model.
                  They are drawn as coloured blocks on the time axis. Now that you have some entities, we can create the activities they are involved in.
                </p>
                <p>
                  To create a new activity, use the <strong>Add Activity</strong> control in the toolbar. 
                  An activity needs a name, and happens over a particular period of time. 
                  The &lsquo;Beginning&rsquo; and &lsquo;Ending&rsquo; fields specify when this activity starts and finishes. 
                  The time scale doesn&apos;t mean anything in particular.
                </p>
                <p>
                  The &lsquo;Participants&rsquo; field at the bottom specifies which entities are involved in this activity. 
                  You can only add entities that already exist; if you need a new entity to participate, save the activity, 
                  create the entity first, and then come back to edit the activity to add them.
                </p>
                <p>
                  The activity immediately appears on the diagram spanning the
                  defined time window.  Activities can overlap in time when
                  they happen concurrently.  After creation, you can edit the
                  name, change the time boundaries, or reassign the colour
                  from the editing panel
                  (see <a href="#edit-activity">Editing Activity</a>).
                </p>
                <p>
                  The &lsquo;Type&rsquo; field, as with entities, can be
                  used to categorise activities, or can be left at the
                  default &lsquo;Task&rsquo; type.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="add activity panel" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Adding Participations */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="participations" className="doc-section-heading">Adding Participations</h4>
                <p>
                  A participation links an entity to an activity, recording
                  that the entity is involved during that activity&apos;s time
                  window.  It is shown as a filled block at the intersection
                  of the entity&apos;s row and the activity&apos;s time span. Clicking on a &lsquo;participant&rsquo;, 
                  which is the shaded box indicating that an entity participates in an activity, brings up a new box.
                </p>
                <p>
                  This allows you to specify that this entity performs a particular role in the activity. 
                  So, for example, if Bob is hammering in a nail, then Bob might be assigned &lsquo;the person hammering in the nail&rsquo;, 
                  and the nail might be &lsquo;the nail being hammered in&rsquo;. For such a simple example this seems silly, but when you are trying to build 
                  a specification for the different types of activity you need to model, this level of detail becomes more important.
                </p>
                <p>
                  To add a participation initially, open the activity editor (click
                  the arrow icon next to the activity in the Activity Legend,
                  or see <a href="#edit-activity">Editing Activity</a>).
                  The editor groups and shows a list of all entities; tick the
                  ones that should participate and they are added
                  immediately.  Each entity can participate in many
                  activities and each activity can have many participating
                  entities.
                </p>
                <p>
                  To remove a participation, untick the entity in the
                  same activity editor.  This only unlinks the entity from
                  the activity; neither is deleted.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="add participation" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Type Editing */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="editing" className="doc-section-heading">Type Editing</h4>
                <p>
                  Every entity and activity can be assigned a semantic
                  <strong> type</strong>.  Types act as classifier labels that
                  flow through to colour coding and downstream data queries.
                  When adding or editing an entity or activity, the type
                  dropdown lets you select from the existing types or create
                  a new one inline with the &lsquo;Add Type&rsquo; button.
                  You can also rename a type directly inside the dropdown.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="type editing panel" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Activity Legend */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="activity-legend" className="doc-section-heading">Activity Legend</h4>
                <p>
                  The Activity Legend sits alongside the diagram and lists all
                  activities.  Each entry shows the activity name and its
                  assigned colour.  If an activity has sub-tasks, the count
                  is shown next to the name.  When there are more than five
                  activities, a search box appears at the top of the legend
                  for quick filtering.
                </p>
                <p>
                  Each legend entry has two action buttons: the target icon
                  highlights the activity on the diagram
                  (see <a href="#highlight-activity">Highlighting Activity</a>),
                  and the arrow icon opens the activity editor
                  (see <a href="#edit-activity">Editing Activity</a>).
                  As you add or remove activities, the legend updates live.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="activity legend" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Entity Legend */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="entity-legend" className="doc-section-heading">Entity Legend</h4>
                <p>
                  The Entity Legend is a static reference panel that explains
                  the symbols used on the diagram.  It shows five indicators:
                </p>
                <ul>
                  <li><strong>System</strong> (filled square) - a structured assembly</li>
                  <li><strong>System Component</strong> (diamond) - a slot within a system</li>
                  <li><strong>Individual</strong> (circle) - a standalone entity</li>
                  <li><strong>Installation Period</strong> (hatched rectangle) - the time range an individual is fused with a component</li>
                  <li><strong>Currently Installed</strong> (dashed rectangle) - a currently active installation</li>
                </ul>
                <p>
                  The Entity Legend is for reference only; it is not
                  interactive.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="entity legend" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Highlighting Activity */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="highlight-activity" className="doc-section-heading">Highlighting Activity</h4>
                <p>
                  To highlight an activity, click the target icon next to the
                  activity&apos;s entry in the Activity Legend.  The selected
                  activity is rendered at full opacity while every other
                  element dims, visually isolating the activity and all of
                  its participations.  This makes it straightforward to see
                  exactly which entities are involved and how the activity
                  sits in relation to the overall timeline.
                </p>
                <p>
                  To remove the highlight, click the same target icon again.
                  Note that clicking directly on an activity block on the
                  diagram opens the activity editor rather than highlighting
                  it.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="highlighted activity" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Editing Activity */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="edit-activity" className="doc-section-heading">Editing Activity / Changing Properties</h4>
                <p>
                  Clicking on an entity or an activity will bring up the dialog used to create it 
                  so that its properties can be changed. You can also click the arrow icon in the Activity Legend.
                  This opens the activity editor where you can change the
                  name, adjust the start and end times, reassign the type,
                  update the colour, and manage which entities participate.
                  All changes are reflected on the diagram immediately.
                </p>
                <p>
                  The editor also provides a <strong>Copy</strong> button to
                  duplicate the activity and a <strong>Delete</strong> button
                  to remove it. Entities and activities can be deleted entirely at any point. 
                  A copied activity will need to have its beginning or ending changed; otherwise, it will entirely overlap the activity it was copied from.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="edit activity panel" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Sub-Tasks */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="sub-tasks" className="doc-section-heading">Breaking Down Activities</h4>
                <p>
                  One of the aims of the methodology this diagram editor supports is to 
                  break activities down into their sub-tasks. By doing this, it helps identify 
                  participants (and information requirements) that may have been initially overlooked.
                </p>
                <p>
                  To break an activity down into sub-tasks, click on the activity to bring up the 
                  &lsquo;Edit Activity&rsquo; dialog and then click the <strong>Sub-tasks</strong> button.
                </p>
                <p>
                  This will open a new diagram representing the sub-tasks for that specific parent activity. The breadcrumb navigation 
                  at the top of the diagram shows you where you are, and allows you to easily jump back up to the parent or directly to the top-level diagram.
                </p>
                <p>
                  You can also reorganize your tasks as your diagram evolves. If a sub-task grows in scope, you can <strong>promote</strong> it to be a top-level task instead, or you can assign a sub-task to an entirely different parent activity to restructure your model.
                </p>
                <p>
                  Be aware that when saving a diagram, the starts and ends of sub-activities will be bound and moved 
                  to sit within their parent activity. This ensures the activity data makes sense in the output file. 
                  (We are actively exploring the best way to handle this; one of the purposes of this project is to promote discussion of these questions).
                </p>
              </Col>
              <Col className="col-md text-center align-self-center d-flex flex-column gap-3">
                <ImageComponent alt="edit activity dialog subtasks button" imageMap={imageMap} />
                <ImageComponent alt="subtasks diagram view" maxWidth="460px" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Zoom */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="zoom" className="doc-section-heading">Zoom</h4>
                <p>
                  Three small buttons appear in the top-right corner of the
                  diagram area: a pointer, a zoom icon, and a search icon.
                  To zoom, click the zoom button to enter zoom mode.  You
                  can then use the mouse wheel or pinch gestures to scale
                  the diagram in or out, and click-drag to pan.  To return
                  to normal interaction, click the pointer button.
                </p>
                <p>
                  The zoom range runs from <span className="badge bg-secondary font-monospace" style={{ fontSize: '0.9em' }}>0.5&times;</span> to <span className="badge bg-secondary font-monospace" style={{ fontSize: '0.9em' }}>4&times;</span> magnification.
                  Zooming adjusts the spacing of the time axis, keeping
                  entity rows the same height so labels remain readable.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="zoom controls" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Search Entity */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="search-entity" className="doc-section-heading">Search Entity</h4>
                <p>
                  When a model contains dozens of entities, scrolling through
                  all the rows can be slow.  Click the search icon in the
                  top-right corner of the diagram to open a compact popover
                  with a text input.  As you type, the list filters down to
                  entities whose names match.  Clicking a result scrolls the
                  diagram to centre on that entity&apos;s row and briefly
                  flashes it to draw your attention.
                </p>
                <p>
                  To ensure a clear view of your workspace, the search popover (as well as all dialog modals in the editor) is entirely draggable. You can click and hold the top handle of the search wrapper or the header of any modal to move it out of the way of your active diagram elements.
                </p>
                <p>
                  From the search results you can also rename an entity
                  inline: click the pencil icon next to a result, type the
                  new name and confirm.  The diagram updates instantly.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="search entity popover" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Undo & Redo */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="undo-redo" className="doc-section-heading">Undo &amp; Redo and Starting Again</h4>
                <p>
                  Every change you make to the model (adding, editing or
                  deleting entities, activities and participations) is
                  recorded in an internal history stack.  There is an 
                  <strong> Undo</strong> button on the right-hand side; 
                  this will undo the most recent change you have made. 
                  Press <strong>Redo</strong> to reapply an undone
                  change.
                </p>
                <p>
                  The undo history is fairly short (it keeps up to 50 steps); 
                  the button disappears when you can&apos;t undo any more changes. 
                  Once a new change is made after an undo, the redo stack for the
                  previous forward path is cleared.
                </p>
                <p>
                  The <strong>Clear diagram</strong> button will start again with a completely clean diagram.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="undo / redo buttons" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Hide Entities */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="hide-entities" className="doc-section-heading">Hide Entities</h4>
                <p>
                  Large diagrams can become visually cluttered.  If any
                  entities do not participate in an activity, a
                  <strong> Hide Entities</strong> button appears in the
                  toolbar.  Clicking it hides all non-participating entity
                  rows from the diagram, allowing you to focus on the active
                  parts of the model.  Click the button again (now labelled
                  <strong> Show Entities</strong>) to reveal them.
                </p>
                <p>
                  Hidden entities still exist in the underlying data.
                  Entities that are part of a system hierarchy (for example
                  a component of a system) will not be
                  hidden even if they have no direct participation, because
                  the parent-child relationship keeps them visible.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="hide entities panel" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Sorting by Dragging */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="sort-drag" className="doc-section-heading">Sorting by Dragging</h4>
                <p>
                  The order of entity rows on the vertical axis is fully
                  customisable.  In the entity list panel, grab the drag
                  handle on any row and move it up or down to reposition it.
                  The diagram re-renders in real time as you drag, so you can
                  see the effect immediately.
                </p>
                <p>
                  This manual sorting is helpful when you want logically
                  related entities (e.g. all personnel, or all equipment in
                  one system) to appear next to each other on the diagram
                  for clarity.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="drag-and-drop sorting" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Picking Activity Color */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="activity-color" className="doc-section-heading">Picking Activity Color</h4>
                <p>
                  Each activity can have an individual colour to help
                  distinguish it visually on the diagram.  When adding or
                  editing an activity you will see a colour picker control.
                  Click it to open a palette and choose a new colour, or type
                  a hex code directly.
                </p>
                <p>
                  Colour choices propagate to the activity block, its
                  participation shading and the Activity Legend all at once.
                  Using distinct colours for different activity types creates
                  a clear, colour-coded timeline that is easy to read even in
                  complex models.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="activity colour picker" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Settings */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="settings" className="doc-section-heading">Changing The Display (Settings)</h4>
                <p>
                  The <strong>Settings</strong> button lets you change how the diagram is displayed. 
                  The options are mostly fairly self-explanatory, affecting global configuration options that dictate the visual layout.
                  Changes are applied when you press <strong>Save</strong>.
                  The dialog is split into two tabs:
                  <a href="#settings-presentation"> Presentation Styles</a> and
                  <a href="#settings-layout"> Layout &amp; Configuration</a>.
                </p>
                <p>
                  At the bottom of the dialog you will also find a <strong>Reset Defaults</strong> button, along with 
                  <strong> Save Settings</strong> to save your settings to a local file, and 
                  <strong> Load Settings</strong> to load a settings file in again.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="settings panel overview" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Settings Presentation Styles */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h5 id="settings-presentation" className="doc-section-heading">Presentation Styles</h5>
                <p>
                  The Presentation Styles tab controls the visual appearance
                  of diagram elements.  It is split into three sections:
                </p>
                <ul>
                  <li>
                    <strong>Activities</strong> - fill colour list, border
                    colour list, opacity, opacity on hover, border width,
                    and border dash array.
                  </li>
                  <li>
                    <strong>Participations</strong> - fill colour, border
                    colour, opacity, opacity on hover, border width, and
                    border dash array.
                  </li>
                  <li>
                    <strong>Individuals</strong> - fill colour, fill hover
                    colour, border colour, border width, font size, and max
                    label characters.
                  </li>
                </ul>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="settings Presentation Styles tab" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Settings Layout & Configuration */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h5 id="settings-layout" className="doc-section-heading">Layout &amp; Configuration</h5>
                <p>
                  The Layout &amp; Configuration tab controls dimensions,
                  spacing and behavioural options:
                </p>
                <ul>
                  <li>
                    <strong>Zoom &amp; Timeline:</strong>
                    <ul>
                      <li><small>Time Axis:</small> The horizontal scale/magnification of the timeline.</li>
                      <li><small>Minimum Timeline Span:</small> The lowest number of time units the diagram will display by default, ensuring very short models still have breathing room.</li>
                      <li><small>Timeline Buffer (%):</small> The percentage of padding added to the start and end of the bounds so elements do not sit flush against the edges of the screen.</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Individual Layout:</strong>
                    <ul>
                      <li><small>Height:</small> The vertical thickness of the individual rows on the diagram.</li>
                      <li><small>Gap:</small> The empty vertical space between adjacent individual rows.</li>
                      <li><small>Text Area:</small> The width of the left-hand column reserved for entity names/labels.</li>
                      <li><small>System Highlight Open-End Padding:</small> Extra visual space applied when an entity&apos;s beginning or ending time is unknown (open chevron).</li>
                    </ul>
                  </li>
                  <li>
                    <strong>System Layout:</strong>
                    <ul>
                      <li><small>Container Inset:</small> The vertical padding inside a System border containing its internal components.</li>
                      <li><small>Horizontal Inset:</small> The horizontal padding inside a System&apos;s time boundaries.</li>
                      <li><small>Component Gap:</small> The vertical gap specifically between System Components.</li>
                      <li><small>Component Height Factor:</small> How much taller a System Component row is relative to a standard individual row.</li>
                      <li><small>Min Host Height Factor:</small> The minimum vertical height of a parent system relative to a single individual row.</li>
                      <li><small>Host Height Growth Per Component:</small> How much extra vertical space is added to the system enclosure for each component installed inside it.</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Labels:</strong> Global toggles to enable or hide labels for individuals and activities entirely.
                  </li>
                </ul>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="settings Layout and Configuration tab" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Saving and Loading Diagrams */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="saving-loading" className="doc-section-heading text-primary">Saving and Loading Diagrams</h4>

                <h5 id="session-auto-saving" className="doc-section-heading mt-4">Session Auto-Saving</h5>
                <p>
                  Any changes made to your diagram and settings during your session are automatically saved in the background. You can safely navigate through other pages of the website, and your diagram will persist when you return to the editor. However, these changes will be lost when you completely close the browser tab or window unless you explicitly save them.
                </p>

                {/* Turtle Files */}
                <h5 id="saving-turtle" className="doc-section-heading mt-4">Saving and Loading Turtle Files</h5>
                <p>
                  Diagrams can be saved to your local computer in a format called &lsquo;Turtle&rsquo;. (This is a
                  format used by the RDF data modelling community.) The &lsquo;Save TTL&rsquo; and &lsquo;Load TTL&rsquo;
                  buttons can be used for this.
                </p>
                <p>
                  The &lsquo;Reference Types only&rsquo; switch arranges for save and load to ignore any individuals or
                  activities present in the diagram or in the file being loaded. Instead, the buttons will just
                  save or load types you have defined (types of individual, activity or participant). This
                  makes it possible to start building up libraries of types which can be reused across
                  diagrams.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
                <ImageComponent alt="ttl config" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Loading an example */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h5 id="loading-example" className="doc-section-heading">Loading an example</h5>
                <p>
                  Some examples are provided to make it easier to get started. These can be accessed
                  from the &lsquo;Load example&rsquo; dropdown.
                </p>
                <p>
                  The &lsquo;boil an egg&rsquo; example is relatively simple, if perhaps analysed to a rather excessive
                  level of detail. The &lsquo;crane lift&rsquo; example is the full diagram from <Link href="crane">the example analysis</Link>.
                  The &lsquo;packaging cell&rsquo; example provides a complete system hierarchy showing equipment swap-outs 
                  over time, which accompanies <Link href="system-example">the system and component analysis</Link>.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
                <ImageComponent alt="Load example dropdown menu" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Exporting other File Formats */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h5 id="export-formats" className="doc-section-heading">Exporting other File Formats</h5>
                <p>
                  The editor can export your diagram as an SVG, for inclusion as an image in documents.
                  There are various tools available which will convert the SVG into other picture formats if
                  you need that.
                </p>
                <p>
                  The editor will also export the data backing the diagram as JSON-LD; this may be easier
                  to process from other tools than the Turtle file format. Currently the JSON produced is
                  not very friendly to process with tools that don&apos;t understand RDF; this may be changed
                  in the future. For now don&apos;t rely on the JSON schema, but ensure the JSON is processed
                  as JSON-LD.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
                <ImageComponent alt="export svg and json buttons" imageMap={imageMap} />
              </Col>
            </Row>

                        <p className="doc-back-to-top mt-5"><a href="#page-top">Back to top</a></p>
          </div>
        </div>
      </Container>
    </>
  );
}
