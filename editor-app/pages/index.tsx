import Head from "next/head";
import Link from "next/link";
import { Button, Col, Container, Row } from "react-bootstrap";
import { ButtonRow, LinkButton } from "@/components/Util";
import styles from "@/styles/Home.module.css";

export default function Home() {
  return (
    <>
      <Head>
        <title>Activity Diagram Editor</title>
        <meta
          name="description"
          content="An editor to draw High Quality Data Model activity diagrams"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Container>
        <Row>
          <Col className="amrc-text">
            <h1>Activity Model Development Tool</h1>
            <p>Knowing what information is needed to support any
            business activity is not easy.  Engineering activities, like
            production assembly and test for complex systems, can be
            hard to optimise and integrate without the right information
            to support them.  Doing this without the tools and data to
            enable such integrated operations is limited for all but the
            simplest of activities.</p>
            <p>Analysis of these activities to reveal the decisions,
            human and programmed, throughout provides a means to
            identify the information needed to support them.  The
            resulting activity models also provide a means of
            documenting the information required (as data) consistently,
            in a machine-readable manner, that can be mapped to an
            integrated information environment. </p>
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
