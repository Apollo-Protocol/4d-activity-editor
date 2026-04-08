import Head from "next/head";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { Col, Container, Row } from "react-bootstrap";
import JumpLinks, { JumpLinkItem } from "@/components/JumpLinks";
import { publicPath } from "@/utils/publicPath";
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
  {
    id: "creation-editing",
    label: "Creation and Editing Diagrams",
    children: [
      {
        id: "entities",
        label: "Adding Entities",
        children: [
          { id: "editing", label: "Type Editing" },
          { id: "begins-ends-participant", label: "Begins / Ends With Participant" },
          { id: "installations", label: "Managing Installations" },
        ],
      },
      {
        id: "activities",
        label: "Adding Activities",
        children: [
          { id: "participations", label: "Adding Participations" },
          { id: "activity-color", label: "Picking Activity Color" },
        ],
      },
      { id: "sub-tasks", label: "Breaking Down Activities" },
      {
        id: "affected-items",
        label: "Affected Items Warnings",
        children: [
          { id: "trim-remove-keep", label: "Trim, Remove and Keep" },
        ],
      },
    ],
  },
  {
    id: "file-management",
    label: "File Management and Exporting",
    children: [
      { id: "session-auto-saving", label: "Session Auto-Saving" },
      { id: "saving-turtle", label: "Turtle Files" },
      { id: "loading-example", label: "Loading an Example" },
      { id: "export-formats", label: "Exporting other Formats" },
    ],
  },
  {
    id: "interface-reference",
    label: "Interface Reference",
    children: [
      {
        id: "navigation",
        label: "Navigation",
        children: [
          { id: "navigation-settings", label: "Settings" },
        ],
      },
      { id: "modal-behaviour", label: "Modal Behaviour" },
      {
        id: "lefthand-toolbar",
        label: "Lefthand Toolbar",
        children: [
          {
            id: "entity-legend",
            label: "Entity Legend",
            children: [
              { id: "system-collapse", label: "System Collapse" },
            ],
          },
          {
            id: "activity-legend",
            label: "Activity Legend",
            children: [
              { id: "highlight-activity", label: "Highlighting Activity" },
              { id: "edit-activity", label: "Editing Activity" },
            ],
          },
        ],
      },
      {
        id: "top-right-toolbar",
        label: "Top Right Toolbar",
        children: [
          { id: "zoom", label: "Zoom" },
          { id: "search-entity", label: "Search Entity" },
          { id: "minimap", label: "Minimap" },
        ],
      },
      {
        id: "bottom-toolbar",
        label: "Bottom Toolbar",
        children: [
          { id: "undo-redo", label: "Undo, Redo and Clear Diagram" },
          { id: "hide-entities", label: "Hide Entities" },
          { id: "sort-drag", label: "Sorting by Dragging" },
          {
            id: "diagram-settings",
            label: "Diagram Settings",
            children: [
              { id: "settings-presentation", label: "Presentation Styles" },
              { id: "settings-layout", label: "Layout & Configuration" },
            ],
          },
        ],
      },
    ],
  },
];

const getManualImageFilenameBase = (alt: string) =>
  alt.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const ImageComponent = ({ alt, src, maxWidth, imageMap }: { alt: string, src?: string, maxWidth?: string, imageMap?: Record<string, string> }) => {
  const filenameBase = getManualImageFilenameBase(alt);
  const modalAlt = filenameBase
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const extension = (imageMap && imageMap[filenameBase]) ?? "png";
  const finalExt = extension;
  const generatedSrc = publicPath(src || `/manual/${filenameBase}.${finalExt}`);
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
        alt={modalAlt}
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
                <p className="lead">
                  The Activity Diagram Editor is a browser-based tool for
                  creating, viewing and editing 4D activity diagrams.
                  These diagrams plot activities against time along the
                  horizontal axis and participating entities along the
                  vertical axis, showing at a glance which entities are
                  involved in which activities and when.
                </p>
                <p className="lead">
                  This guide walks through every feature of the editor,
                  from creating your first entity all the way to
                  customising the diagram layout and exporting results.
                  Each section below explains a single capability with
                  step-by-step instructions.</p>
                  <p className="lead mt-3">
                    Before starting, you may also want to review the core concepts.
                  </p>
                  <Link href="/terminology" className="btn btn-outline-secondary mb-3">
                    View Terminology Guide
                  </Link>
                </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent src="/manual/overview.png" alt="editor overview" maxWidth="530px" imageMap={imageMap} />
              </Col>
            </Row>

            <Row className="mt-5 pt-2">
              <Col>
                <h2 id="creation-editing" className="border-bottom pb-2 mb-4 doc-section-heading">Creation and Editing Diagrams</h2>
              </Col>
            </Row>

            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-3">
              <Col>
                <h3 id="entities" className="doc-section-heading">Adding Entities</h3>
                <p>
                  Entities represent the physical or conceptual objects that participate in activities.
                  To add one, open the <strong>Add Entity</strong> panel, set a name and time bounds,
                  optionally choose a type, then press Add.
                </p>
                <p>
                  Entities appear as rows on the vertical axis. You can categorize them using types
                  to support downstream analysis and consistent modeling.
                </p>
                <p>
                  The entity type is set once and cannot be changed after creation. 
                  Each type determines which additional controls are available in the entity editor (for example, system components show a “Component Of” dropdown, and individuals show the Installations panel).
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="add entity panel" imageMap={imageMap} />
              </Col>
            </Row>

            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-3">
              <Col>
                <h4 id="editing" className="doc-section-heading">Type Editing</h4>
                <p>
                  Entity and activity types can be created, selected and renamed directly from the
                  type controls. These types help keep your model semantically consistent.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="type editing panel" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Begins / Ends With Participant */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="begins-ends-participant" className="doc-section-heading">Begins / Ends With Participant</h4>
                <p>
                  When editing an <strong>Individual</strong>, two toggle
                  switches appear next to the time-bound fields:
                  <strong> Begins With Participant</strong> and
                  <strong> Ends With Participant</strong>.
                </p>
                <p>
                  Enabling either toggle locks the corresponding bound so
                  that it automatically tracks the earliest (or latest)
                  participation time of that individual. This is useful when
                  an entity&apos;s existence in the model should be defined
                  purely by the activities it takes part in, rather than by
                  an independently set time range.
                </p>
                <p>
                  While a toggle is active, the matching time-bound input is
                  disabled and updates itself whenever participations change.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="begins ends with participant" maxWidth="440px" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Managing Installations */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="installations" className="doc-section-heading">Managing Installations</h4>
                <p>
                  When editing an <strong>Individual</strong>, an
                  <strong> Installations</strong> card shows the current
                  installation count and a button to open the Installations
                  modal. An installation fuses an individual into a system
                  component slot for a specified time range.
                </p>
                <p>
                  Inside the modal, each row contains:
                </p>
                <ul>
                  <li><strong>System Component</strong> - a dropdown listing every component, labelled with its parent system and bounds.</li>
                  <li><strong>From / Until</strong> - numeric fields for the installation start and end times.</li>
                  <li><strong>Availability</strong> - beneath the component dropdown, an indicator shows which time ranges in the selected slot are already occupied and which are available.</li>
                </ul>
                <p>
                  Use <strong>Add Another</strong> to create additional rows.
                  The editor enforces several rules: installations must stay
                  within both the individual&apos;s and the component&apos;s
                  bounds, the ending must be after the beginning, and two
                  different individuals cannot occupy the same slot at the
                  same time.
                </p>
                <p>
                  For a worked example of creating installations, see
                  the <Link href="/system-example">System Component Example</Link>.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="installations modal" maxWidth="440px" imageMap={imageMap} />
              </Col>
            </Row>

            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="activities" className="doc-section-heading">Adding Activities</h3>
                <p>
                  Activities are the temporal blocks in your model. Use <strong>Add Activity </strong>
                  to set name, start/end time, and participants. Activities can overlap and are
                  shown as colored blocks on the timeline.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="add activity panel" imageMap={imageMap} />
              </Col>
            </Row>

            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-3">
              <Col>
                <h4 id="participations" className="doc-section-heading">Adding Participations</h4>
                <p>
                  Participations link entities to activities. In the activity editor, tick entities
                  to include them, and untick to remove the link. This updates the diagram instantly.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="add participation" imageMap={imageMap} />
              </Col>
            </Row>

            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-3">
              <Col>
                <h4 id="activity-color" className="doc-section-heading">Picking Activity Color</h4>
                <p>
                  You can choose an activity color during creation or editing. The selected color is
                  reflected on the activity block, participation shading, and activity legend.
                </p>
                <p>
                  Color priority works like this: if an activity has its own
                  custom color, that custom value is used first. If no custom
                  activity color is set, the editor uses the current
                  <strong> Activity Fills</strong> palette from Diagram
                  Settings based on the activity&apos;s position.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="activity colour picker" imageMap={imageMap} />
              </Col>
            </Row>

            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="sub-tasks" className="doc-section-heading">Breaking Down Activities</h3>
                <p>
                  Use sub-tasks to decompose larger activities into detailed steps. Open an activity,
                  then use <strong>Sub-tasks</strong> to create and navigate a child diagram.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="edit activity dialog subtasks button" imageMap={imageMap} />
              </Col>
            </Row>

            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-3">
              <Col>
                <p>
                  This helps uncover missing participants and decision points. Breadcrumbs at the top
                  make it easy to return to parent or top-level diagrams.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="subtasks diagram view" maxWidth="460px" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Affected-Items Warnings */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="affected-items" className="doc-section-heading">Affected Items Warnings</h3>
                <p>
                  If an edit or delete would affect related items, the editor
                  opens an affected-items dialog before anything is applied.
                  The dialog only lists the items touched by that change, so
                  you can review the knock-on effects before saving.
                </p>
                <p>
                  The core sections are the same for <strong>Individuals</strong>,
                  <strong> Systems</strong>, and <strong>System Components</strong>:
                  bounds changes, installation periods, and participations in
                  activities. When the edited entity is a <strong>System</strong>,
                  the dialog can also list affected System Components inside
                  that system.
                </p>
                <p>
                  Required deletions are shown with disabled checkboxes.
                  Optional items have interactive checkboxes so you can accept
                  the proposed result or switch the outcome before saving.
                  Activity-level annotations show whether an activity will be
                  removed entirely, trimmed to the remaining participants, or
                  left unchanged.
                </p>
                <p>
                  Activity headers can also show note markers. A
                  '<strong style={{ color: '#dc3545' }}>#</strong>' marker means the activity itself will be
                  removed because no participants remain. A
                  '<strong>*</strong>' marker means the activity itself will be
                  trimmed to the remaining participation bounds.
                </p>
                <p>
                  The footer legend and any notes are conditional. Each legend
                  item only appears when that action is present in the current
                  modal, and the notes section only appears when there is an
                  extra outcome to explain.
                </p>
              </Col>
              <Col className="col-md text-center align-self-start">
                <ImageComponent alt="cascade warning modal" maxWidth="440px" imageMap={imageMap} />
              </Col>
            </Row>

            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="trim-remove-keep" className="doc-section-heading">Trim, Remove and Keep</h4>
                <p>
                  Both warning dialogs use three colour-coded action badges
                  to communicate the outcome for each item:
                </p>
                <ul>
                  <li>
                    <span className="badge" style={{ backgroundColor: '#dc3545', color: '#fff' }}>Removed</span>{' '}
                    - the item has no overlap with the new bounds and
                    will be deleted.
                  </li>
                  <li>
                    <span className="badge" style={{ backgroundColor: '#ffc107', color: '#000' }}>Trimmed to Fit</span>{' '}
                    - the item partially overlaps and will be shortened
                    to stay within the new bounds.
                  </li>
                  <li>
                    <span className="badge" style={{ backgroundColor: '#0d6efd', color: '#fff' }}>Kept</span>{' '}
                    - the installed participation itself is removed due
                    to no overlap, but the participation returns to the parent
                    entity instead of being deleted outright.
                  </li>
                </ul>
                <p>
                  You can click a <strong>Trimmed</strong> badge to upgrade
                  it to <strong>Removed</strong> if you would rather delete
                  the item outright. Conversely, unchecking a toggled badge
                  reverts it to trim. This gives you fine-grained control
                  over exactly which items survive the edit.
                </p>
                <p>
                  Once you are happy with the selections, use the action
                  button to apply the change. For edits this is
                  <strong> Apply</strong>; for deletions it uses a delete
                  label that includes the entity name. The affected
                  installations, participations and activities are updated
                  (or removed) in a single step, and the resulting change is
                  recorded as one entry in the <a href="#undo-redo">undo history</a>.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="trim remove keep badges" maxWidth="440px" imageMap={imageMap} />
              </Col>
            </Row>

            
<Row className="mt-5 pt-2">
  <Col>
    <h2 id="file-management" className="border-bottom pb-2 mb-4 doc-section-heading">File Management and Exporting</h2>
  </Col>
</Row>

<Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-3">
              <Col>
                <h3 id="session-auto-saving" className="doc-section-heading">Session Auto-Saving</h3>
                <p>
                  Any changes made to your diagram and settings during your session are automatically saved in the background. You can safely navigate through other pages of the website, and your diagram will persist when you return to the editor. However, these changes will be lost when you completely close the browser tab or window unless you explicitly save them.
                </p>

                {/* Turtle Files */}
                <h3 id="saving-turtle" className="doc-section-heading mt-4">Turtle Files</h3>
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
                <h3 id="loading-example" className="doc-section-heading">Loading an example</h3>
                <p>
                  Some examples are provided to make it easier to get started. These can be accessed
                  from the &lsquo;Load example&rsquo; dropdown.
                </p>
                <p>
                  The &lsquo;boil an egg&rsquo; example is relatively simple, if perhaps analysed to a rather excessive
                  level of detail. The &lsquo;crane lift&rsquo; example is the full diagram from <Link href="crane">the example analysis</Link>.
                  The &lsquo;packaging cell&rsquo; example provides a complete system hierarchy showing equipment swap-outs 
                  over time, which accompanies <Link href="system-example">the system and system component analysis</Link>.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center mt-4 mt-lg-0">
                <ImageComponent alt="Load example dropdown menu" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Exporting other File Formats */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="export-formats" className="doc-section-heading">Exporting other File Formats</h3>
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

            <div className="doc-page-divider"></div>
            <Row className="mt-5">
              <Col>
                <h2 id="interface-reference" className="border-bottom pb-2 mb-3 doc-section-heading">Interface Reference</h2>
              </Col>
            </Row>

            {/* Navigation */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-3">
              <Col>
                <h3 id="navigation" className="doc-section-heading">Navigation</h3>
                <p>
                  The fixed top navigation bar provides quick access to every
                  part of the application.  From left to right it contains:
                </p>
                <ul>
                  <li>
                    <strong>Home</strong> - returns to the landing page.
                  </li>
                  <li>
                    <strong>Editor</strong> - opens the interactive
                    diagram editor.
                  </li>
                  <li>
                    <strong>Activity Modelling</strong> (dropdown) -
                    links to the <em>Introduction</em>, the
                    <em> Example Analysis</em> (crane lift walkthrough) and
                    <em> Integrated Information Management</em>.
                  </li>
                  <li>
                    <strong>Guide</strong> (dropdown) - links to this
                    <em> Editor Guide</em> and the <em>Terminology </em>
                    reference. Below a divider, a <strong>System &amp; System
                    Components</strong> sub-section links to the system
                    modelling <em>Introduction</em> and <em>Example
                    Analysis</em>.
                  </li>
                  <li>
                    <strong>Settings</strong> (button) - opens the
                    settings modal described below.
                  </li>
                </ul>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent
                  alt="Top Navigation Bar"
                  src="/manual/navigation_bar_desktop.png"
                  maxWidth="530px"
                  imageMap={imageMap}
                />
              </Col>
            </Row>

            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-4">
              <Col>
                <p>
                  On small screens the navbar collapses to a hamburger menu.
                  Dropdown items and the active-page highlight work the same
                  way in the collapsed view.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent
                  alt="Collapsed Mobile Navigation"
                  src="/manual/navigation_bar_mobile.png"
                  maxWidth="360px"
                  imageMap={imageMap}
                />
              </Col>
            </Row>

            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-4">
              <Col>
                <h4 id="navigation-settings" className="doc-section-heading mt-4">Settings</h4>
                <p>
                  The <strong>Settings</strong> button in the navbar opens the
                  editor-wide appearance modal. This is where you configure
                  the application chrome rather than the diagram itself.
                </p>
                <ul>
                  <li><strong>Theme</strong> - choose Light, Dark, or System.</li>
                  <li><strong>Accent</strong> - use the default profile or switch to one of the preset accent colours for links, highlights, and buttons.</li>
                  <li><strong>Typography</strong> - choose the default Roboto-based profile or the Apollo Forum profile with Jost, Merriweather, and Source Sans 3.</li>
                  <li><strong>Modal Animation</strong> - choose Default, Meep Meep, or Sketch for dialog transitions.</li>
                </ul>
                <p>
                  These settings are stored in local storage, so the editor
                  restores them the next time you open the app.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent
                  alt="Appearance Settings Modal"
                  src="/manual/navigation_settings_modal.png"
                  maxWidth="460px"
                  imageMap={imageMap}
                />
              </Col>
            </Row>

            {/* Modal Behaviour */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="modal-behaviour" className="doc-section-heading">Modal Behaviour</h3>
                <p>
                  All dialog modals in the editor including the
                  entity editor, activity editor, warnings, settings, and the
                  search popover are <strong>draggable</strong>.
                  Click and hold the header bar of any modal and drag it to
                  a new position so it does not obscure the part of the
                  diagram you are working on.
                </p>
                <p>
                  Modal animation is configured from the
                  <a href="#navigation-settings"> Settings</a> subsection above,
                  and the selected style is applied consistently across the
                  editor.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent
                  alt="Draggable Modal Behaviour"
                  src="/manual/modal_behaviour_draggable.gif"
                  maxWidth="440px"
                  imageMap={imageMap}
                />
              </Col>
            </Row>

            {/* Entity Legend */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="entity-legend" className="doc-section-heading">Entity Legend</h3>
                <p>
                  The Entity Legend is a static reference panel that explains
                  the symbols used on the diagram.  It shows six indicators:
                </p>
                <ul>
                  <li><strong>System</strong> (filled square) - a structured assembly</li>
                  <li><strong>System Component</strong> (diamond) - a slot within a system</li>
                  <li><strong>Individual</strong> (circle) - a standalone entity</li>
                  <li><strong>Installation Period</strong> (hatched rectangle) - the time range an individual is fused with a component</li>
                  <li><strong>System Collapsed</strong> (square with cut corners) - a system that is currently collapsed to hide its components</li>
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

            {/* System Collapse */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="system-collapse" className="doc-section-heading">System Collapse</h4>
                <p>
                  When a system contains one or more system components, you
                  can <strong>right-click</strong> the system&apos;s row on
                  the diagram to collapse it. Collapsing hides all of the
                  system&apos;s components and replaces them with a single
                  compact row showing the system name. Right-click again to expand.
                </p>
              
                <p>
                  Collapsed systems are fully supported across the editor:
                  search results and minimap clicks correctly highlight the
                  parent system row, and the SVG export reflects the
                  current collapsed/expanded state including a
                  &ldquo;System&nbsp;Collapsed&rdquo; entry in the legend.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="system collapse" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Activity Legend */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="activity-legend" className="doc-section-heading">Activity Legend</h3>
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
                <ImageComponent alt="activity legend" imageMap={imageMap} maxWidth="200px" />
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

            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="edit-activity" className="doc-section-heading">Editing Activity</h4>
                <p>
                  Click the arrow icon next to any activity in the Activity Legend (or click the
                  activity block) to open the activity editor. You can update name, time bounds,
                  type, color, and participating entities.
                </p>
                <p>
                  The editor also supports copying and deleting activities. Changes apply to the
                  diagram immediately, so you can iterate quickly.
                </p>
                <p>
                  When time bounds edits have cascade effects, the editor
                  shows an <a href="#affected-items">affected-items warning</a> before
                  applying the change. For example, tightening a system
                  timeline can trim installation endings, trim participation
                  timing, and in some cases remove an activity that no
                  longer has valid participation - and the warning
                  dialog lets you review and adjust every one of these
                  outcomes before confirming.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="Edit Activity Panel" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Zoom */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="zoom" className="doc-section-heading">Zoom</h3>
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
                <p>
                  To reset the zoom back to the normal level, right-click on the zoom icon.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="Zoom Controls" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Search Entity */}
            
<Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="search-entity" className="doc-section-heading">Search Entity</h3>
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

            {/* Minimap */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="minimap" className="doc-section-heading">Minimap</h3>
                <p>
                  The minimap provides a birds-eye overview of the entire
                  diagram. Toggle it with the minimap button in the top-right
                  toolbar. It is hidden by default and appears as a floating
                  panel that can be dragged to any position. Use the
                  <strong> &minus;</strong>, <strong>reset</strong> and
                  <strong> +</strong> controls on the minimap header to
                  resize it.
                </p>
                
                <p>
                  Hovering over the minimap activates a <strong>magnifier
                  lens</strong> that shows a zoomed-in view of the area
                  under your cursor. The lens automatically repositions
                  itself to stay within the minimap panel. Clicking on an
                  entity in the minimap scrolls the main diagram to that
                  entity and briefly highlights it.
                </p>
                <p>
                  The blue viewport rectangle shows which portion of the
                  diagram is currently visible. Drag it to pan the main
                  diagram view.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="minimap" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Undo, Redo and Clear Diagram */}
            <section className="manual-undo-redo-grid mt-5">
              <div className="manual-undo-redo-copy manual-undo-redo-copy-intro">
                <h3 id="undo-redo" className="doc-section-heading">Undo, Redo and Clear Diagram</h3>
                <p>
                  Every change you make to the model (adding, editing or
                  deleting entities, activities and participations) is
                  recorded in an internal history stack.  There is an
                  <strong> Undo</strong> button on the right-hand side;
                  this will undo the most recent change you have made.
                  Press <strong>Redo</strong> to reapply an undone
                  change.
                </p>
              </div>
              <div className="manual-undo-redo-visual manual-undo-redo-visual-buttons">
                <ImageComponent alt="undo / redo buttons" imageMap={imageMap} />
              </div>
              <div className="manual-undo-redo-copy manual-undo-redo-copy-history">
                <p>
                  <strong>Right-click</strong> either the Undo or Redo
                  button to open a history table that shows every recorded
                  change. The table spells out both the original edit and
                  the exact action available in that row, so each entry clearly
                  describes what changed and what Undo or Redo will do next.
                  Use the <strong> Undo to Here </strong>
                  or <strong>Redo to Here</strong> action button in the row to jump
                  directly to that point in history, skipping multiple steps at once.
                </p>
                <p>
                  Each row shows the action label (<strong>Will Undo</strong> or
                  <strong> Will Redo</strong>), the <strong>Category</strong>, the
                  <strong> Recorded Change</strong>, and the row&apos;s
                  <strong> Position</strong> in the current stack.
                </p>
                <p>
                  The undo history keeps up to 50 steps;
                  the button disappears when you can&apos;t undo any more changes.
                  Once a new change is made after an undo, the redo stack for the
                  previous forward path is cleared.
                </p>
              </div>
              <div className="manual-undo-redo-visual manual-undo-redo-visual-history">
                <ImageComponent alt="undo redo modal" imageMap={imageMap} maxWidth="440px" />
              </div>
              <div className="manual-undo-redo-copy manual-undo-redo-copy-clear">
                <p>
                  The <strong>Clear diagram</strong> button will start again with a completely clean diagram.
                  Clearing is now part of the undo history, so you can use
                  <strong> Undo</strong> to restore the diagram immediately after a clear,
                  or <strong>Redo</strong> to apply the clear again.
                </p>
              </div>
              <div className="manual-undo-redo-visual manual-undo-redo-visual-clear">
                <ImageComponent
                  src="/manual/new-diagram.gif"
                  alt="clear diagram result"
                  imageMap={imageMap}
                  maxWidth="420px"
                />
              </div>
            </section>

            {/* Hide Entities */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="hide-entities" className="doc-section-heading">Hide Entities</h3>
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
                <h3 id="sort-drag" className="doc-section-heading">Sorting by Dragging</h3>
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

            {/* Diagram Settings */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h3 id="diagram-settings" className="doc-section-heading">Diagram Settings</h3>
                <p>
                  The <strong>Settings</strong> button controls how the diagram itself is displayed.
                  These options affect layout, dimensions, labels, colours, and other presentation
                  choices used when the diagram is drawn.
                </p>
                <p>
                  Changes are applied when you press <strong>Save</strong>. At the bottom of the
                  dialog you can also <strong>Reset Defaults</strong>, <strong>Save Settings</strong>
                  to a local file, or <strong>Load Settings</strong> from a file you saved earlier.
                </p>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="settings panel overview" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Settings Presentation Styles */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="settings-presentation" className="doc-section-heading">Presentation Styles</h4>
                <p>
                  The Presentation Styles tab controls the visual appearance
                  of diagram elements. At the top of this tab there is a
                  shared <strong>Color Editor</strong> that lets you update
                  all color fields without showing a separate color picker
                  for each setting.
                </p>
                <ul>
                  <li>
                    Use <strong>Field</strong> to choose which color property
                    to edit. Options are grouped by type (Individuals,
                    Activities, Participations, and Axis).
                  </li>
                  <li>
                    For activity color lists, use <strong>Color Slot </strong>
                    to select a list entry, then use the <strong>Add </strong>
                    and <strong>Remove</strong> buttons to manage slots.
                  </li>
                  <li>
                    Use <strong>Custom Color</strong> to pick via the color
                    picker button or type a hex value directly (for example,
                    <code>#981f92</code>).
                  </li>
                </ul>
                <p>
                  Below the Color Editor, the rest of the tab is split into
                  three sections:
                </p>
                <ul>
                  <li>
                    <strong>Activities:</strong>
                    <ul>
                      <li><small>Opacity:</small> Base transparency of activity blocks.</li>
                      <li><small>Opacity on Hover:</small> Transparency used when hovering an activity.</li>
                      <li><small>Border Width:</small> Stroke thickness around activity blocks.</li>
                      <li><small>Border DashArray:</small> Dash pattern used for activity borders (for example <code>5,3</code>).</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Participations:</strong>
                    <ul>
                      <li><small>Opacity:</small> Base transparency for participation overlays.</li>
                      <li><small>Opacity on Hover:</small> Transparency used when hovering participations.</li>
                      <li><small>Border Width:</small> Stroke thickness around participation shapes.</li>
                      <li><small>Border DashArray:</small> Dash pattern used for participation borders.</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Individuals:</strong>
                    <ul>
                      <li><small>Border Width:</small> Stroke thickness around individual rows.</li>
                      <li><small>Font Size:</small> Size of individual name labels.</li>
                      <li><small>Max Label Characters:</small> Maximum number of visible characters before label truncation.</li>
                    </ul>
                  </li>
                </ul>
              </Col>
              <Col className="col-md text-center align-self-center">
                <ImageComponent alt="settings Presentation Styles tab" maxWidth="460px" imageMap={imageMap} />
              </Col>
            </Row>

            {/* Settings Layout & Configuration */}
            <Row className="justify-content-center row-cols-1 row-cols-lg-2 mt-5">
              <Col>
                <h4 id="settings-layout" className="doc-section-heading">Layout &amp; Configuration</h4>
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
                <ImageComponent alt="settings Layout and Configuration tab" maxWidth="460px" imageMap={imageMap} />
              </Col>
            </Row>


                        <p className="doc-back-to-top mt-5"><a href="#page-top">Back to top</a></p>
          </div>
        </div>
      </Container>
    </>
  );
}
