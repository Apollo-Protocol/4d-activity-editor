import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { Col, Container, Row } from "react-bootstrap";
import { ButtonRow, LinkButton } from "@/components/Util";

import styles from "@/styles/Home.module.css";

import flowchart from "@/public/methodology.png";
import example from "@/public/example-diagram.png";

export default function Page() {
  return (
    <>
      <Head>
        <title>Activity modelling introduction</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Container>
        <Row className="justify-content-center row-cols-1 row-cols-lg-2">
          <Col className="amrc-text">
            <h1>Activity Modelling Introduction</h1>

            <p>Activity happens all the time: the wind blows, seasons
            pass and the sun’s fusion radiates photons and other
            subatomic particles throughout the solar system.  Human
            activity is also part of the range of activities.  Keeping
            track of intended and actual activities is hard, especially
            when it is the participants in those activities that set
            their context and determine what the result is.  A
            participant can be anything material that is involved
            intentionally or by virtue of its interaction with other
            participants (e.g. the environment itself or the floor of a
            building in which activity of interest is taking place).
            Whether a participant is significant-enough to warrant
            inclusion in a model is ultimately a decision, a decision
            based on whether there is a need for information records of
            it.  For business activity lifecycles, the only need for
            information is to support activities in those, or other,
            business decisions.  This page introduces a basic
            methodology to analysing activities and their participants
            to enable activity models to be developed to support
            subsequent information system development.</p>
          </Col>
          <Col>
            <Image src={flowchart} alt="XXX" className="img-fluid"/>
            <p className="amrc-fixme">When we have a finalised image it
            needs writing up as alt text.</p>
          </Col>
        </Row>
        <Row className="justify-content-center row-cols-1 row-cols-lg-2">
          <Col>
            <h2>Step 1: Develop an initial lifecycle activity model</h2>

            <p className="amrc-fixme">An activity lifecycle is a
            decomposition of the activities that</p>

            <h2>Step 2: Identify participants in each activity</h2>

            <p>Why are participants important?  Firstly, they are the
            only things involved in activities.  If something else is
            involved, then it is also a participant.  Secondly, these
            participants each have lifecycles of their own.  For
            example, a nut used on a production line will have been
            manufactured and sourced independently of a torque wrench
            used to tighten it.  Each item modelled has an identity that
            can be used to create and query for records at any point in
            its lifefcycle (at least, if we arrange for the data records
            to be managed in a way that allows for this).</p>

            <h2>Step 3: Identify decisions relating to those activities</h2>

            <p>Identifying the decisions that require information should
            be an easy task once Steps 1 & 2 have been completed.  If
            not, further iterations of those steps will be needed.
            Decisions (human &/or data-based) tend to be needed at the
            start &/or end of activities.</p>

            <h2>Step 4: Proceed to information requirements capture</h2>

            <p>Once the activity lifecycle has been captured with the
            participants it is now ready for information requirements
            capture to support the decisions.  This is a modelling step
            that a future version of the Activity Modeller may support.
            Data from the Activity Modeller is a record of the typical
            (or actual, representative) activity lifecycle and can be
            used for the ongoing information requirements and
            information management implementation steps beyond Step
            4.</p>
          </Col>
          <Col>
            <Image src={example} alt="
              A space-time diagram has two axes, Time horizontally and
              Space vertically. Resources are displayed as horizontal
              bars spaced along the Space axis. Activities are displayed
              as boxes spanning the resources they use and their
              temporal extent on the Time axis. Where a resource
              participates in an activity the overlapping area is
              shaded.
            " className="img-fluid"/>
          </Col>
        </Row>
        <ButtonRow>
          <LinkButton href="/crane">See an example</LinkButton>
          <LinkButton href="/editor">Try the editor</LinkButton>
        </ButtonRow>
      </Container>
    </>
  );
}
