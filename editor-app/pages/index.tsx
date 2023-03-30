import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { Button, Col, Container, Row } from "react-bootstrap";
import { ButtonRow, LinkButton } from "@/components/Util";
import styles from "@/styles/Home.module.css";

import example1 from "@/public/example-diagram1.png";

export default function Home() {
  return (
    <>
      <Head>
        <title>Activity Diagram Editor</title>
        <meta
          name="description"
          content="An editor to draw activity diagrams compatible with the HQDM model framework."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Container>
      <h1>Activity Model Development Tool</h1>
        <Row className="justify-content-center row-cols-1 row-cols-lg-2">
          <Col className="amrc-text">
            <p>Knowing what information is needed to support any
            business activity is not easy.  Engineering activities, like
            production assembly and test for complex systems, can be
            hard to optimise and integrate without the right information
            to support them.  Doing this without the tools and data to
            enable such integrated operations is limited for all but the
            simplest of activities.</p>
            
            <p>Analysis of these activities to reveal the decisions required,
            both human and programmed, throughout provides a means to
            identify the information needed to support them.  Typically this
            will be at the start and end of an organised activity.</p>

            <p>The resulting activity models provide a means of
            documenting the information required (as data) consistently,
            in a machine-readable manner by using a suitable information 
            model to support data integration.  The models created using 
            this application can be exported using such a model.  Well 
            constructed activity models can aid business process improvement,
            information quality managemement, performance measurement and 
            planning.</p>
          </Col>
          <Col>
            <Image src={example1} alt="Screengrab of activity diagram 
            generated using the activity editor for an engineering application." 
              className="img-fluid"/>
            <p className="amrc-fixme">Example activity diagram</p>
          </Col>
        </Row>
        <ButtonRow>
          <LinkButton href="/crane">See an example</LinkButton>
          <LinkButton href="/intro">Learn about activity modelling</LinkButton>
          <LinkButton href="/editor">Go to the editor</LinkButton>
          <LinkButton href="/management">Build on activity models</LinkButton>
        </ButtonRow>
      </Container>
    </>
  );
}
