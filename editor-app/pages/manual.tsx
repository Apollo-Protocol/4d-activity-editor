import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { Col, Container, Row } from "react-bootstrap";
import styles from "@/styles/Home.module.css";

export default function Page() {
  return (
    <>
      <Head>
        <title>Using the diagram editor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Container>
        <Row className="justify-content-center row-cols-1 row-cols-lg-2">
          <Col>
            <h1>Using the diagram editor</h1>

            <p>The diagram editor is a tool for modelling activities and
            the resources needed to carry out those activities. In this
            respect it is not very different from existing project
            planning tools such as Gantt charts. The emphasis, however,
            is more on breaking down activities to the point where all
            relevant resources have been recorded, including resources
            that would not normally be considered by traditional project
            planning methods.</p>

            <h2>How the diagrams work</h2>

            <p><img src="/manual/boil-egg-basic.svg"/></p>

            <p>The axes of the diagram are labelled 'space' and 'time',
            but this should be taken rather broadly. The 'time' axis
            shows activities happening one after another; the 'space'
            axis shows the resources and individuals involved in the
            activities.</p>

            <p>The grey horizontal bars indicate the lifetimes of the
            individuals. The arrow ends show that the lifetimes extend
            beyond the limits of the activity we are modelling at the
            moment; so, for instance, I use a pan to boil an egg, but
            the pan exists before and after that.</p>

            <p>The coloured boxes indicate activities; sub-tasks of the
            activity we are analysing at the moment. The filled-in boxes
            where an activity overlaps an individual show where an
            individual participates in a particular task.</p>

            <h2>Creating a diagram</h2>

            <p><img src="/manual/new-diagram.png"/></p>

            <h3>Creating individuals</h3>

            <p>The first thing to do when creating a new diagram is to
            add some individuals. These represent the resources involved
            in the activities: people, machines, tools, materials,
            anything which is needed for the activity to be carried out.</p>

            <p>Create a new individual by clicking the 'Add Individual'
            button.</p>

            <p><img src="/manual/add-individual.png"/></p>

            <p>The new individual needs a name, at minimum. The 'Type'
            field can be used to categorise individuals, to assist with
            the analysis; there are three built-in types, and more can
            be added with the 'Add Type' button. To start with there is
            no harm in leaving all individuals as the default 'Resource'
            type.</p>

            <p>The 'Begins with participant' and 'Ends with participant'
            switches are used for individuals that are created or
            destroyed as part of the activity.</p>

            <p><img src="/manual/created-individuals.png"/></p>

            <h3>Creating activities</h3>

            <p>Now we have some individuals, we can create the
            activities they are involved in. Create a new activity by
            clicking the 'Add Activity' button.</p>

            <p><img src="/manual/add-activity.png"/></p>

            <p>An activity again needs a name. The 'Type' field, as with
            individuals, can be used to categorise activities, or can be
            left at the default 'Task' type.</p>

            <p>An activity happens over a particular period of time. The
            'Beginning' and 'Ending' fields specify when this activity
            starts and finishes. The time scale doesn't mean anything in
            particular.</p>

            <p>The 'Participants' field at the bottom specifies which
            individuals are involved in this activity. You can only add
            individuals that already exist; if you need a new
            individual, save the activity and come back in to it when
            you've created the individual.</p>

            <p><img src="/manual/created-activity.png"/></p>

            <h2>Changing a diagram</h2>

            <h3>Changing properties</h3>

            <p>Clicking on an individual or an activity will bring up
            the dialog used to create it so that its properties can be
            changed. Individuals and activities can be deleted, and
            activities can be copied. A copied activity will need to
            have its beginning or ending changed, as otherwise it will
            entirely overlap the activity it was copied from.</p>

            <p>Clicking on a 'participant', which is the shaded box
            indicating that an individual participates in an activity,
            brings up a new box:</p>

            <p><img src="/manual/edit-participant.png"/></p>

            <p>This allows you to specify that this individual performs
            a particular role in the activity. So, for example, if Bob
            is hammering in a nail, then Bob might be 'the person
            hammering in the nail', and the nail might be 'the nail
            being hammered in'. For such a simple example this seems
            silly, but when you are trying to build a specification for
            the different types of activity you need to model this level
            of detail becomes more important.</p>

            <h3>Undo, and starting again</h3>

            <p>There is an 'Undo' button on the right-hand side; this
            will undo the most recent change you have made. The undo
            history is fairly short; the button disappears when you
            can't undo any more.</p>

            <p>The 'Clear diagram' button will start again with a clean
            diagram.</p>

            <h3>Changing the display</h3>

            <p>The 'Settings' button lets you change how the diagram is
            displayed. The options are mostly fairly
            self-explanatory.</p>

            <p>There are buttons in the 'Settings' dialog to save your
            settings to a file and to load a settings file in again.
            Note that if you refresh the page, or go away to a different
            page and come back, that your settings will reset to the
            defaults.</p>

            <h2>Breaking down activities</h2>

            <p>One of the aims of the methodology this diagram editor is
            intended to support is to break activities down into their
            sub-tasks with the aim of identifying participants (about
            which we may need information) which have been
            overlooked.</p>

            <p>To break an activity down into sub-tasks, click on the
            activity to bring up the 'Edit Activity' dialog and then
            click the 'Sub-tasks' button.</p>

            <p><img src="/manual/sub-tasks.png"/></p>

            <p>This will open a new diagram representing the sub-tasks
            of the activity you had open. The navigation at the top of
            the diagram shows you where you are, and allows you to go
            back up to the parent activity.</p>

            <p><img src="/manual/sub-activities.png"/></p>

            <p>Be aware that when saving a diagram the starts and ends
            of sub-activities will be moved to sit within their parent
            activity. This is currently necessary to make the activity
            data make sense in the output file. We are still working on
            the best way to handle this; one of the purposes of this
            project is to promote discussion of these questions.</p>

            <h2>Saving and loading diagrams</h2>

            <h3>Saving and loading Turtle files</h3>

            <p>Diagrams can be saved to your local computer in a format
            called 'Turtle'. (This is a format used by the RDF data
            modelling community.) The 'Save TTL' and 'Load TTL' buttons
            can be used for this.</p>

            <p><img src="/manual/save-load-ttl.png"/></p>

            <p>The 'Reference Types only' switch arranges for save and
            load to ignore any individuals or activities present in the
            diagram or in the file being loaded. Instead, the buttons
            will just save or load types you have defined (types of
            individual, activity or participant). This makes it possible
            to start building up libraries of types which can be reused
            across diagrams.</p>

            <h3>Loading an example</h3>

            <p>Some examples are provided to make it easier to get
            started. These can be accessed from the 'Load example'
            dropdown.</p>

            <p><img src="/manual/load-example.png"/></p>

            <p>The 'boil an egg' example is relatively simple, if
            perhaps analysed to a rather excessive level of detail. The
            'crane lift' example is the full diagram from <Link
            href="/crane">the example analysis</Link>.</p>

            <h3>Exporting other file formats</h3>

            <p>The editor can export your diagram as an SVG, for
            inclusion as an image in documents. There are various tools
            available which will convert the SVG into other picture
            formats if you need that.</p>

            <p>The editor will also export the data backing the diagram
            as JSON-LD; this may be easier to process from other tools
            than the Turtle file format. Currently the JSON produced is
            not very friendly to process with tools that don't
            understand RDF; this may be changed in the future. For now
            don't rely on the JSON schema, but ensure the JSON is
            processed as JSON-LD.</p>

          </Col>
        </Row>
      </Container>
    </>
  );
}
