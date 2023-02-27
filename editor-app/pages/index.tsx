import Head from "next/head";
import { Col, Container, Row } from "react-bootstrap";
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
          <Col>
            <h1>The homepage</h1>
            <p>
              To add a new page, just add a file in the pages folder and a route
              is automatically created.
            </p>
            <p>
              Dont use any html anchors or anything that would cause the browser
              to load a page directly. This would cause the app to reload.
              Instead, use the NextJs Link component. See example in the NavBar
              component. In the NavBar I have wrapped React-Bootstrap components
              that contain links with NextJs Links. Notice I have had to specify
              as=&quot;span&quot; on the Bootstrap links to prevent a hydration
              error.
            </p>
            <p>
              Use the React-Boostrap layout pretty much everywhere. Thats the
              Container, Row and Col JSX elements. Checkout the getting-started
              page for more.
            </p>
            <p>Here are some styling options:</p>
            <p style={{ color: "red" }}>This p has some inline style</p>
            <p className={styles.helloModules}>
              This p is styled through a module import. See how we import the
              css module. Use one per page or component.
            </p>
            <p id="helloGlobal">
              This p is styled through a the global css. Probably dont use this
              one unless you need it to be global.
            </p>
            <p>
              Use components from{" "}
              <a href="https://react-bootstrap.github.io/components/alerts/">
                React Boostrap
              </a>
              . You might not need many, but you will buttons, carousels, cards
              etc there.
            </p>
          </Col>
        </Row>
      </Container>
    </>
  );
}
