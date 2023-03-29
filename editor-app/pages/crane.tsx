import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { Col, Container, Row } from "react-bootstrap";
import styles from "@/styles/Home.module.css";

export default function Page() {
  return (
    <>
      <Head>
        <title>Analysing a crane lift</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Container>
        <Row className="justify-content-center row-cols-1 row-cols-lg-2">
          <Col>
            <h1>Analysing a crane lift</h1>
            <p>This document walks through the process of analysing the
            data required to perform an industrial activity, in this
            case a lift with an overhead crane. The purpose of this
            analysis is to illustrate the application of this
            methodology published by CIS.</p>

            <p>This analysis only performs Stage 1 of the methodology,
            that of identifying all participants involved in the
            activity in question and identifying the decisions for which
            we require information.</p>

            <h2>Top-level approach</h2>
            <p>At the top level, the methodology is about identifying
            information that is required, and deciding how to make sure
            that information is provided at an appropriate quality. It
            is important that the first step performed objectively,
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

            <h2>Lifecycle Activity Model</h2>
            <p className="amrc-fixme">[BM] I am still unclear about what
            this is and why it is useful. Possibly this crane lift
            example is too small for this to apply?</p>
            <p className="amrc-fixme">Does this consist basically of
            building a class library of activity types? (For the crane
            lift we only have one activity of each type...)</p>

            <h2>Analysing the activities</h2>
            <p>The first step in analysing a particular activity is to
            identify the steps involved and the points where decisions
            are required. In this case we started with an existing
            Method Statement document specifying how to perform the lift
            and generated a diagram showing the steps involved, the
            objects (human, mechanical and documentary) listed in the
            RAMS as being involved in the lift, and which steps required
            which participants.</p>

            <h3>Representing a step on the diagram</h3>
            <p>Take the first step in the process as documented, and
            represent it on the diagram. Horizontal boxes represent
            physical objects involved in the process: people, machines,
            documents, anything at all in the real world that might
            affect the outcome of the activity. Vertical boxes represent
            activities, or steps in activities; these are arranged in a
            timeline. Filled in sections where an activity and a
            physical object overlap indicate that the object is directly
            involved in this step of the activity.

            <br/><img src="/crane/rams-briefing.svg"/></p>

            <p>To create this step on the diagram, first the &lsquo;Add
            Individual&rsquo; button needs to be used to create the two
            people involved.

            <br/><img src="/crane/add-individual.png"/>

            <br/>An &lsquo;individual&rsquo; represents any object
            involved in the activity; in this case we are representing a
            person, but an individual could also represent a machine or
            a document or anything else. Each individual has a name and
            a type, which in this case is &lsquo;Person&rsquo;.</p>

            <p>Next we need to create the activity using the &lsquo;Add
            Activity&rsquo; button.

            <br/><img src="/crane/add-activity.png"/>

            <br/>An activity also has a name and a type, but there are
            no pre-defined activity types. Use the &lsquo;Add Type&rsquo; button to
            create a suitable activity type first. An activity needs a
            starting and ending time; these are on a nominal scale, the
            units don&apos;t represent real time. An activity also needs
            participants, which can be selected from the existing
            individuals.</p>

            <p><img src="/crane/rams-briefing.svg"/></p>

            <h3>Adding more steps</h3>
            <p>Continue adding the rest of the steps in the process as
            documented. Create new physical objects as needed and add
            them to the activity steps they are involved in.

            <br/><img src="/crane/rams-review.svg"/>
            <br/><img src="/crane/rams-walk-route.svg"/>
            <br/><img src="/crane/rams-complete.svg"/>
            </p>

            <h3>Break down the individual steps.</h3>
            <p>It is then necessary to further analyse each step,
            breaking it down further if necessary and identifying the
            decision points. It is important at this stage to also
            identify any additional physical objects participating in
            the activity which have been missed; this is easier to do as
            you &lsquo;drill down&rsquo; into the detail of the activity.</p>

            <p>Here is one of the steps from the lift above, represented
            on a separate diagram. 
    
            <br/><img src="/crane/sub-inspect-inspect.svg"/>

            <br/>Looking into the activity at this level of detail has
            identified more participants in the activity: there are
            safety inspection tags on the equipment which must be
            checked, and a quarantine area where unsafe equipment is
            kept for inspection or disposal.</p>

            <p className="amrc-fixme">This screenshot shows activities
            that may be skipped (the quarantine steps) and entirely
            omits the loops where we select new equipment and inspect
            again.</p>

            <p>To create a sub-task breakdown like this, start by
            clicking on an activity in the top-level diagram and
            choosing &lsquo;Open sub-tasks&rsquo;. This will open a new
            diagram view showing sub-tasks of the chosen task. The
            navigation at the top shows which activity you are breaking
            down at the moment and allows you to go back up the tree.

            <br/><img src="/crane/sub-task-nav.png"/>

            <br/>Now start creating activities as before. 
            
            <br/><img src="/crane/sub-inspect-first.svg"/>

            <br/>Create new individuals as needed; these will also show
            up on the top-level view.

            <br/><img src="/crane/sub-inspect-quarantine.svg"/>

            <br/><img src="/crane/sub-inspect-inspect.svg"/></p>

            <p>Once the sub-task has been analysed, it is helpful to go
            back to the top-level view and add the new individuals
            identified as participants in the top-level activity. <span
            className="amrc-fixme">Should the editor do this
            automatically?</span>

            <br/><img src="/crane/sub-inspect-top.svg"/></p>

            <h2>Identifying information required for decisions</h2>
            <p>Having identified the decision points in the activity, we
            now need to identify the information required to make these
            decisions, and track the objects involved back in time to
            find where this information was created. Sometimes this may
            involve going a long way back. For example, part of deciding
            whether the crane is safe to use involves checking the
            safety tag put on by the insurance safety inspector; this
            means we need to track the history of the crane back at
            least as far as the last inspection. Deciding whether the
            crane is capable of performing the lift requires the crane&apos;s
            working limits, which were supplied to us at the time the
            crane was bought.</p>

            <h2>Deciding where to stop</h2>
            <p>One of the important questions to ask here is &lsquo;when
            do we stop analysing&rsquo;. The answer is &lsquo;when you
            have identified all the information you need for your
            original activity&rsquo;, but the only way to really be sure
            you have identified everything is to go at least one step
            further than you need, so that you can see that the new
            information you are identifying does not bear on the
            original activity. For the purposes of our analysis, we are
            going to say that information about the actual inspection
            represented by the safety tag is out of scope, and the only
            information required by the safety check step is whether a
            valid tag is present or not.</p>

          </Col>
        </Row>
      </Container>
    </>
  );
}
