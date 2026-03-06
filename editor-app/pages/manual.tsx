import Head from "next/head";
import Link from "next/link";
import { Col, Container, Row } from "react-bootstrap";
import JumpLinks, { JumpLinkItem } from "@/components/JumpLinks";

const manualSections: JumpLinkItem[] = [
  { id: "overview", label: "Overview" },
  { id: "entities", label: "Adding Entities" },
  { id: "activities", label: "Adding Activities" },
  { id: "participations", label: "Adding Participations" },
  { id: "editing", label: "Type Editing" },
  { id: "activity-legend", label: "Activity Legend" },
  { id: "entity-legend", label: "Entity Legend" },
  { id: "highlight-activity", label: "Highlighting Activity" },
  { id: "edit-activity", label: "Editing Activity" },
  { id: "zoom", label: "Zoom" },
  { id: "search-entity", label: "Search Entity" },
  { id: "undo-redo", label: "Undo & Redo" },
  { id: "hide-entities", label: "Hide Entities" },
  { id: "sort-drag", label: "Sorting by Dragging" },
  { id: "activity-color", label: "Picking Activity Color" },
  { id: "settings", label: "Settings", children: [
    { id: "settings-layout", label: "Layout" },
    { id: "settings-configuration", label: "Configuration" },
  ] },
  { id: "saving-loading", label: "Saving and Loading", children: [
    { id: "saving-turtle", label: "Turtle Files" },
    { id: "loading-example", label: "Loading an example" },
    { id: "export-formats", label: "Exporting other Formats" }
  ] },
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
        <title>Editor Guide | Activity Diagram Editor</title>
        <meta name="description" content="Comprehensive guide to the Activity Diagram Editor" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="favicon.ico" />
      </Head>
      <Container>
        <div className="row">
          <div className="col mb-5">
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
                <Placeholder alt="Screenshot: editor overview" />
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
                  toolbar.  Enter a unique name and, optionally, select a
                  predefined type from the dropdown.  Press
                  &ldquo;Add&rdquo; and the entity appears as a new row on
                  the diagram.
                </p>
                <p>
                  You can add as many entities as your model requires.  Each
                  entity is given a default colour based on its type, and its
                  row can later be repositioned by dragging
                  (see <a href="#sort-drag">Sorting by Dragging</a> below).  When an entity is no longer
                  needed, right-click its row header or use the entity menu
                  to remove it from the model.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: add entity panel" />
              </Col>
            </Row>

            {/* Adding Activities */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="activities" className="doc-section-heading">Adding Activities</h4>
                <p>
                  Activities are the temporal events that make up your model.
                  They are drawn as coloured blocks on the time axis.  To
                  create a new activity, use the <strong>Add Activity</strong>
                  {" "}control in the toolbar.  You will be prompted to provide
                  a name, choose a colour, and set the start and end times.
                </p>
                <p>
                  The activity immediately appears on the diagram spanning the
                  defined time window.  Activities can overlap in time when
                  they happen concurrently.  After creation, you can edit the
                  name, change the time boundaries, or reassign the colour
                  from the activity&apos;s context menu or the editing panel
                  (see <a href="#edit-activity">Editing Activity</a>).
                </p>
                <p>
                  You can also assign an activity a <strong>type</strong>,
                  which groups it in the Activity Legend and makes the diagram
                  easier to read when many activities are present.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: add activity panel" />
              </Col>
            </Row>

            {/* Adding Participations */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="participations" className="doc-section-heading">Adding Participations</h4>
                <p>
                  A participation links an entity to an activity, recording
                  that the entity is involved during that activity&apos;s time
                  window.  It is shown as a shaded region at the intersection
                  of the entity&apos;s row and the activity&apos;s time span.
                </p>
                <p>
                  To add a participation, open the <strong>Set
                  Participation</strong> control.  Select the target entity
                  and the target activity from the provided dropdowns and
                  confirm.  The intersection cell on the diagram fills in
                  immediately.  Each entity can participate in many
                  activities and each activity can have many participating
                  entities.
                </p>
                <p>
                  To remove a participation, select the existing
                  participation and click &ldquo;Remove&rdquo;.  This only
                  unlinks the entity from the activity; neither is deleted.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: add participation" />
              </Col>
            </Row>

            {/* Type Editing */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="editing" className="doc-section-heading">Type Editing</h4>
                <p>
                  Every entity and activity can be assigned a semantic
                  <strong> type</strong>.  Types act as classifier labels that
                  flow through to legends, colour coding and downstream data
                  queries.  The <strong>Set&nbsp;Config</strong> panel lets
                  you manage the available type definitions: create new types
                  with a name and colour, rename existing ones, or delete
                  types that are no longer required.
                </p>
                <p>
                  To change an entity&apos;s or activity&apos;s type, open
                  its editing panel and choose a different type from the
                  dropdown.  All diagram colours and legend entries update
                  automatically.  Consistent type usage ensures that the model
                  can be queried or filtered reliably once exported.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: type editing panel" />
              </Col>
            </Row>

            {/* Activity Legend */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="activity-legend" className="doc-section-heading">Activity Legend</h4>
                <p>
                  The Activity Legend sits alongside the diagram and groups all
                  activities hierarchically by their type.  Each entry shows
                  the activity name, its assigned colour and type category.
                  Clicking an entry in the legend highlights the
                  corresponding activity on the diagram, making it easy to
                  locate a specific event in a complex model.
                </p>
                <p>
                  As you add or remove activities, the legend updates live.
                  Use it to get a quick overview of which activity types are
                  present and how many events fall under each category.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: activity legend" />
              </Col>
            </Row>

            {/* Entity Legend */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="entity-legend" className="doc-section-heading">Entity Legend</h4>
                <p>
                  The Entity Legend classifies every entity on the diagram by
                  its type.  It provides a quick reference showing which
                  entities are personnel, systems, tools or any other custom
                  type you have defined.  Each legend row displays the entity
                  name, its colour swatch and type label.
                </p>
                <p>
                  Clicking an entity in the legend scrolls the diagram to
                  bring that entity&apos;s row into view, which is
                  particularly useful on large models with many rows.  The
                  legend respects any hidden entities
                  (see <a href="#hide-entities">Hide Entities</a> below),
                  so filtered-out rows do not appear in the list.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: entity legend" />
              </Col>
            </Row>

            {/* Highlighting Activity */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="highlight-activity" className="doc-section-heading">Highlighting Activity</h4>
                <p>
                  Clicking an activity block on the diagram enters
                  <strong> highlight mode</strong>.  The selected activity is
                  rendered at full opacity while every other element dims,
                  visually isolating the activity and all of its
                  participations.  This makes it straightforward to see exactly
                  which entities are involved and how the activity sits in
                  relation to the overall timeline.
                </p>
                <p>
                  Clicking the same activity again, or clicking empty space on
                  the diagram, exits highlight mode and restores all elements
                  to their normal appearance.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: highlighted activity" />
              </Col>
            </Row>

            {/* Editing Activity */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="edit-activity" className="doc-section-heading">Editing Activity</h4>
                <p>
                  To modify an existing activity, select it and open the
                  <strong> Set Activity</strong> panel.  From here you can
                  change the activity name, adjust the start and end times to
                  reposition it on the timeline, reassign it to a different
                  type, or update its colour.  All changes are reflected on
                  the diagram immediately.
                </p>
                <p>
                  You can also delete an activity entirely from this panel.
                  Deleting an activity removes all of its participations at
                  the same time, so entities that were linked to it are
                  unaffected but no longer shown as participants.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: edit activity panel" />
              </Col>
            </Row>

            {/* Zoom */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="zoom" className="doc-section-heading">Zoom</h4>
                <p>
                  Complex diagrams spanning long timelines benefit from the
                  built-in zoom controls.  Use the <strong>+</strong>
                  {" "}and <strong>&minus;</strong> buttons on the toolbar
                  (or scroll the mouse wheel while holding <kbd>Ctrl</kbd>)
                  to scale the diagram in or out.  Zooming adjusts the
                  spacing of the time axis, keeping entity rows the same
                  height so labels remain readable.
                </p>
                <p>
                  A &ldquo;Fit to view&rdquo; option resets the zoom level so
                  that the entire diagram is visible within the browser
                  viewport in one go.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: zoom controls" />
              </Col>
            </Row>

            {/* Search Entity */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="search-entity" className="doc-section-heading">Search Entity</h4>
                <p>
                  When a model contains dozens of entities, scrolling through
                  all the rows can be slow.  The <strong>Search
                  Entity</strong> tool in the toolbar opens a compact popover
                  with a text input.  As you type, the list filters down to
                  entities whose names match.  Clicking a result scrolls the
                  diagram to centre on that entity&apos;s row and briefly
                  flashes it to draw your attention.
                </p>
                <p>
                  From the search results you can also rename an entity
                  inline &mdash; click the pencil icon next to a result,
                  type the new name and confirm.  The diagram updates
                  instantly.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: search entity popover" />
              </Col>
            </Row>

            {/* Undo & Redo */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="undo-redo" className="doc-section-heading">Undo &amp; Redo</h4>
                <p>
                  Every change you make to the model &mdash; adding,
                  editing or deleting entities, activities and
                  participations &mdash; is recorded in an internal history
                  stack.  Press the <strong>Undo</strong> button (or
                  {" "}<kbd>Ctrl&nbsp;+&nbsp;Z</kbd>) to reverse the most
                  recent change.  Press <strong>Redo</strong>
                  {" "}(<kbd>Ctrl&nbsp;+&nbsp;Y</kbd>) to reapply an undone
                  change.
                </p>
                <p>
                  The undo history persists as long as the editor session is
                  open, so you can step back through many changes.  Once a
                  new change is made after an undo, the redo stack for the
                  previous forward path is cleared.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: undo / redo buttons" />
              </Col>
            </Row>

            {/* Hide Entities */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="hide-entities" className="doc-section-heading">Hide Entities</h4>
                <p>
                  Large diagrams can become visually cluttered.  The
                  <strong> Hide Entities</strong> feature lets you temporarily
                  remove specific entity rows from the visible diagram
                  without deleting them from the model.  Open the hide panel,
                  select which entities to hide, and the diagram redraws
                  without those rows.
                </p>
                <p>
                  Hidden entities still exist in the underlying data.  You
                  can reveal them again at any time by toggling their
                  visibility back on.  This is useful when you want to focus
                  on a subset of participants for a presentation or review.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: hide entities panel" />
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
                <Placeholder alt="Screenshot: drag-and-drop sorting" />
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
                <Placeholder alt="Screenshot: activity colour picker" />
              </Col>
            </Row>

            {/* Settings */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="settings" className="doc-section-heading">Settings</h4>
                <p>
                  The <strong>Settings</strong> panel exposes global
                  configuration options that affect the entire diagram.
                  Changes are applied immediately and are included when you
                  export.  The panel is split into two tabs:
                  <a href="#settings-layout"> Layout</a> and
                  <a href="#settings-configuration"> Configuration</a>.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: settings panel overview" />
              </Col>
            </Row>

            {/* Settings — Layout */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h5 id="settings-layout" className="doc-section-heading">Layout</h5>
                <p>
                  The Layout tab controls the physical dimensions and spacing
                  of the diagram.  Key options include:
                </p>
                <ul>
                  <li>
                    <strong>Row height</strong> &mdash; the vertical size of
                    each entity row.  Reducing row height lets more entities
                    fit on screen; increasing it gives more room for labels.
                  </li>
                  <li>
                    <strong>Margins</strong> &mdash; the top, bottom, left
                    and right padding around the diagram canvas.  Tighter
                    margins make exports more compact.
                  </li>
                  <li>
                    <strong>Time-axis spacing</strong> &mdash; the horizontal
                    distance between time ticks.  Wider spacing spreads
                    activities out, making overlaps easier to read; narrower
                    spacing compresses long timelines into a smaller width.
                  </li>
                  <li>
                    <strong>Label font size</strong> &mdash; controls the
                    text size of entity and activity labels on the diagram.
                  </li>
                </ul>
                <p>
                  Experimenting with these values is recommended when
                  preparing a diagram for sharing or printing, as the
                  optimal balance depends on the number of entities and the
                  length of the timeline.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: settings layout tab" />
              </Col>
            </Row>

            {/* Settings — Configuration */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h5 id="settings-configuration" className="doc-section-heading">Configuration</h5>
                <p>
                  The Configuration tab holds behavioural and display
                  toggles that do not affect dimensions:
                </p>
                <ul>
                  <li>
                    <strong>Time grid</strong> &mdash; show or hide the
                    vertical grid lines that align with time ticks.
                  </li>
                  <li>
                    <strong>Participation labels</strong> &mdash; toggle
                    whether participation cells display a text label or
                    remain blank.
                  </li>
                  <li>
                    <strong>Default activity colour</strong> &mdash; set the
                    colour that new activities receive when no explicit
                    colour is chosen.
                  </li>
                  <li>
                    <strong>Diagram title</strong> &mdash; an optional
                    heading rendered at the top of the diagram and included
                    in SVG / JSON exports.
                  </li>
                </ul>
                <p>
                  These options let you adapt the editor to different
                  presentation contexts without changing the underlying
                  model data.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <Placeholder alt="Screenshot: settings configuration tab" />
              </Col>
            </Row>

            {/* Saving and Loading Diagrams */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="saving-loading" className="doc-section-heading text-primary">Saving and Loading Diagrams</h4>
                
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
                <Placeholder alt="Screenshot: Save TTL, Load TTL, and Reference Types only toggle" />
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
                </p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
                <Placeholder alt="Screenshot: Load example dropdown menu" />
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
                <Placeholder alt="Screenshot: Export SVG and Export JSON buttons" />
              </Col>
            </Row>

            <p className="doc-back-to-top mt-5"><a href="#page-top">Back to top</a></p>
          </div>
        </div>
      </Container>
    </>
  );
}