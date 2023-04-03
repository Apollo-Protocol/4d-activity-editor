import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { Col, Container, Row } from "react-bootstrap";
import styles from "@/styles/Home.module.css";
// @ts-ignore
import ModalImage from "react-modal-image";

export default function Page() {
  return (
    <>
      <Head>
        <title>Analysing a crane lift</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Container>
      <div className="row">
    <div className="col mb-5">
    <h1 className="display-4 font-weight-norma text-center">Analysing a Crane Lift</h1>
    </div>
  </div>
        <Row className="justify-content-center row-cols-1 row-cols-lg-2">
          <Col>
            <p><picture><img className="w-100" src="/crane/crane-lift.jpeg" alt=""/></picture></p>

            <p>This document walks through the process of analysing the
            data required to perform an industrial activity, in this
            case a lift with an overhead crane. The purpose of this
            analysis is to illustrate the application of the
            activity analysis method.</p>

            <p>This analysis performs Step 2 of the {}<Link
            href="/intro">information requirements methodology</Link>,
            that of identifying all participants involved in the
            activity in question and breaking down the steps in the
            activity until decision points can be identified.</p>

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

            <h2>Step 1: Lifecycle Activity Model</h2>

            <p> Everything has a lifecycle; comprising at least a start 
            and an end.  Activities are no different.  If we wish to 
            support decisions with information throughout the lifecycle 
            of a set of business activities we need to have some 
            representation of what these activities are.</p>
            
            <p>If done diligently the activity models can be used directly
            to develop information models that match the intended 
            activities. As part of a continuous approach to improvement, 
            the activity models can support busniess performance analysis 
            and can be updated to better reflect ongoing activities.</p>

            <p>In some industries there will be existing libraries of
            activity models (or process models) which can be used or
            adapted for this purpose. However, in most cases these will
            not exist. In this situation it is probably easier to start
            by analysing a few of your existing processes, and build up
            a library of common activity types as you go. The diagram
            editor option to import and export reference data (activity,
            resource and participant types) may be helpful here.</p>

            <h2>Step 2: Analysing the Activities</h2>

            <p>The first step in analysing a particular activity is to
            identify the steps involved and the points where decisions
            are required. In this case we started with an existing
            Method Statement document specifying how to perform the lift
            and generated a diagram showing the steps involved, the
            objects (human, mechanical and documentary) listed in the
            Method Statement as being involved in the lift, and which
            steps required which participants.</p>

            <h3>Representing a step on the diagram</h3>

            <p>Take the first step in the process as documented, and {}
            <Link href="/manual#creating-a-diagram">represent it on the
            diagram</Link>. Horizontal boxes represent physical objects
            involved in the process: people, machines, documents,
            anything at all in the real world that might affect the
            outcome of the activity. Vertical boxes represent
            activities, or steps in activities; these are arranged in a
            timeline. Filled in sections where an activity and a
            physical object overlap indicate that the object is directly
            involved in this step of the activity.
            </p>

            <picture><ModalImage small="/crane/rams-briefing.svg" large="/crane/rams-briefing.svg" imageBackgroundColor="#fff" alt="" /></picture>
            <br/>

            <p>There are two people involved in this activity; they have
            both been give the type &lsquo;Person&rsquo;. The activity
            itself has been given the type &lsquo;Briefing&rsquo;; if we
            were carrying our analysis on to further activities it would
            be useful to be able to identify all the
            &lsquo;Briefing&rsquo; steps across all analysed activities,
            for example to require that a suitable record must be
            kept.</p>

            <h3>Adding more steps</h3>

            <p>Continue adding the rest of the steps in the process as
            documented. Create new physical objects as needed and add
            them to the activity steps they are involved in.
            </p>

            <picture><ModalImage small="/crane/rams-review.svg" large="/crane/rams-review.svg" imageBackgroundColor="#fff" alt="" /></picture>
            <br/><picture><ModalImage small="/crane/rams-walk-route.svg" large="/crane/rams-walk-route.svg" imageBackgroundColor="#fff" alt="" /></picture>
            <br/><picture><ModalImage small="/crane/rams-complete.svg" large="/crane/rams-complete.svg" imageBackgroundColor="#fff" alt="" /></picture>
            <br/>

            <p>The analysis at this point is very much following the
            process documentation as given in the original Method
            Statement document. This means that we have not yet tried to
            identify any activity participants not originally part of
            the process documentation. To do this we need to start
            breaking down the steps further, and looking in more detail
            at what each step involves.</p>

            <h3>Break down the individual steps</h3>

            <p>It is then necessary to further analyse each step,
            breaking it down further if necessary and identifying the
            decision points. It is important at this stage to also
            identify any additional physical objects participating in
            the activity which have been missed; this is easier to do as
            you &lsquo;drill down&rsquo; into the detail of the activity.</p>

            <p>Here is one of the steps from the lift above, represented
            on a separate diagram.</p>

            <picture><ModalImage small="/crane/sub-inspect-inspect.svg" large="/crane/sub-inspect-inspect.svg" imageBackgroundColor="#fff" alt="" /></picture>
            <br/>

            <p>Looking into the activity at this level of detail has
            identified more participants in the activity: there are
            safety inspection tags on the equipment which must be
            checked, and a quarantine area where unsafe equipment is
            kept for inspection or disposal.</p>

            <p>In this diagram there are steps which may be omitted (if
            the equpment is safe it will not be quarantined) and steps
            which may be repeated (if we quarantine unsafe equipment we
            need to choose another set and re-inspect). There are also
            situations (an unsafe crane) where the entire activity will
            need to be abandoned. Currently it is not clear how best to
            model these situations; work is ongoing.</p>

            <p>To create a sub-task breakdown like this, <Link
            href="/manual#breaking-down-activities">open the sub-tasks
            of one of the existing steps</Link>. This will open a new
            diagram view showing sub-tasks of the chosen task. Now start
            creating activities as before.</p>

            <picture><ModalImage small="/crane/sub-inspect-first.svg" large="/crane/sub-inspect-first.svg" imageBackgroundColor="#fff" alt="" /></picture>
            <br/>

            <p>Create new individuals as needed; these will also show
            up on the top-level view.</p>

            <picture><ModalImage small="/crane/sub-inspect-quarantine.svg" large="/crane/sub-inspect-quarantine.svg" imageBackgroundColor="#fff" alt="" /></picture>
            <br/><picture><ModalImage small="/crane/sub-inspect-inspect.svg" large="/crane/sub-inspect-inspect.svg" imageBackgroundColor="#fff" alt="" /></picture>
            <br/>

            <p>Once the sub-task has been analysed, it is helpful to go
            back to the top-level view and add the new individuals
            identified as participants in the top-level activity.</p>

            <picture><ModalImage small="/crane/sub-inspect-top.svg" large="/crane/sub-inspect-top.svg" imageBackgroundColor="#fff" alt="" /></picture>
            <br/>

            <p>This can be loaded as an example in the Editor.</p>

            <p>The completed diagram can be loaded into the editor from
            the examples menu.</p>

            <h2>Step 3: Identifying Decisions</h2>

            <p>This step has not been carried out in detail, as it is
            out of the scope of the activity diagram editor as such.
            Currently this step would need to be performed manually, by
            making lists of the activities identified and the decisions
            involved. Our hope is that in the future tooling can be
            developed to make this stage of the analysis easier.</p>

            <h3>Identifying decision points</h3>

            <p>Decisions are normally made at the start or end of
            activities. A decision in the middle of an activity normally
            indicates that there are sub-tasks that need further
            analysis. So, given our breakdown of the steps in the
            activity, we can look at each step and ask:</p>

            <ul>
             <li>Do we need to make a decision at the start or end of
             this task?</li>
             <li>What information do we require to make those decisions?</li>
             <li>Where does that information come from?</li>
            </ul>

            <p>For even a relatively simple process this can result in a
            lot of information requirements, but without performing the
            analysis we have no way of knowing whether these
            requirements can be met consistently.</p>

            <h3>Finding the source of the information</h3>

            <p>Having identified the decision points in the activity,
            and the information required to make these decisions, we now
            need to track the objects involved back in time to find
            where this information was created.</p>

            <p>Sometimes this may involve going a long way back. For
            example, part of deciding whether the crane is safe to use
            involves checking the safety tag put on by the insurance
            safety inspector; this means we need to track the history of
            the crane back at least as far as the last inspection.
            Deciding whether the crane is capable of performing the lift
            requires the crane&apos;s working limits, which were
            supplied to us at the time the crane was bought.</p>

            <picture><ModalImage small="/crane/life-crane.svg" large="/crane/life-crane.svg" imageBackgroundColor="#fff" alt="" /></picture>
            <br/>

            <h3>Deciding where to stop</h3>

            <p>One of the important questions to ask here is &lsquo;when
            do we stop analysing&rsquo;. The answer is &lsquo;when you
            have identified all the information you need for your
            original activity&rsquo;, but the only way to really be sure
            you have identified everything is to go at least one step
            further than you need, so that you can see that the new
            information you are identifying does not bear on the
            original activity.</p>

            <p>For the purposes of our analysis, we are going to say
            that information about the actual inspection represented by
            the safety tag is out of scope, and the only information
            required by the safety check step is whether a valid tag is
            present or not. However, it is important to recognise that
            information quality management is a process, and we may need
            to revisit decisions like this later.</p>
          </Col>
        </Row>
      </Container>
    </>
  );
}
