import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { Button, Col, Container, Row } from "react-bootstrap";
import { ButtonRow, LinkButton } from "@/components/Util";
import styles from "@/styles/Home.module.css";

export default function Home() {
  return (
    <>
    <Head>
      <title>Activity Diagram Editor</title>
      <meta name="description" content="HDQM activity diagram editor" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="favicon.ico" />
    </Head>
    <Container>
    <div className="container ">
      <div className="position-relative overflow-hidden p-3 p-md-5 m-md-3 text-center">
      <div className="col-md-6 p-lg-5 mx-auto my-5">
        <h1 className="display-4 font-weight-normal">Activity Model Development Tool</h1>
        <p className="lead font-weight-normal">Learn and practice planning in a new way. Helping you discover all the information you need for complete decision making and resource planning.</p>
        <Link className="btn btn-outline-secondary" href="editor">Go to Activity Diagram Editor</Link>
      </div>
      <div className="product-device box-shadow d-none d-md-block"></div>
      <div className="product-device product-device-2 box-shadow d-none d-md-block"></div>
    </div>
    </div>

    <div className="container">
  <div className="row pt-5">
    <div className="col-md">
    <div className="empty-state-card empty-state-surface mr-md-3 pt-3 px-3 pt-md-5 px-md-5 text-center overflow-hidden h-100">
        <div className="my-3 p-3">
          <h2 className="display-5">Why</h2>
          <p className="lead">Knowing what information is needed to support any
            business activity is not easy. Especially engineering activities such as product assembly and management of assets across their life.
            It is crucial that relevant information requirements can be discovered by following a standardised and thorough approach.</p>
            <Link className="btn btn-outline-secondary" href="intro">Learn more</Link>
        </div>
        <div className="empty-state-card-accent box-shadow mx-auto"></div>
      </div>
      </div>
    <div className="col-md">
    <div className="empty-state-card empty-state-surface mr-md-3 pt-3 px-3 pt-md-5 px-md-5 text-center overflow-hidden h-100">
        <div className="my-3 p-3">
          <h2 className="display-5">How</h2>
          <p className="lead">By creating 4D activity diagrams, you are provided with the means to document the information
          required consistently. The information output of which can be analysed as logical diagrams or machine-readable data for
          expanded data integration. <br></br>Well constructed activity models can aid business process improvement, 
          information quality management, performance measurement and planning.  </p>
          <Link className="btn btn-outline-secondary" href="crane">See an example</Link>
        </div>
        <div className="empty-state-card-accent box-shadow mx-auto"></div>
      </div>
      </div>
    <div className="w-100"></div>

    <div className="container">
  <div className="row">
    <div className="col-sm">
    </div>
    <div className="col-6 border-bottom pb-3 mb-3">
    </div>
    <div className="col-sm">
    </div>
  </div>
</div>

    <div className="col-md text-center align-self-center my-4 my-md-0 d-flex justify-content-center">
      <picture className="content-image-surface" style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <img 
          src="dynamic_systems.svg" 
          className="img-fluid border rounded shadow-sm w-100 themed-content-image" 
          alt="System component validaton showing camera installations passing checks"
          style={{ maxWidth: "90%" }}
        />
      </picture>
    </div>
    <div className="col-md">
    <div className="my-3 p-3">
          <h2 className="display-5">Dynamic Systems</h2>
          <p className="lead">Real-world equipment changes over time. Your activity models can reflect that history by organizing individuals into parent systems and defining their installation windows. </p>
          <p>Configure components to validate whether sub-assemblies, maintenance parts, or temporary structures were actually present when the modeled activity occurred.</p>
          <Link className="btn btn-outline-secondary" href="system-intro">Learn about components</Link>
        </div>
    </div>

    <div className="w-100"></div>

    <div className="container">
  <div className="row">
    <div className="col-sm">
    </div>
    <div className="col-6 border-bottom pb-3 mb-3 mt-4">
    </div>
    <div className="col-sm">
    </div>
  </div>
</div>

    <div className="col-md">
    <div className="my-3 p-3">
          <h2 className="display-5">A Tool for the Future</h2>
          <p className="lead">For those of you who wish to know more. The editor is built upon the principles of 4-Dimensionalism. By design
          the user interface hides the theory and complexity, whilst providing you the benefits of such a 
          comprehensive approach.   </p>
          <p>Methodologies such as these will prove essential for the adoption and use of integrated information management.</p>
          <Link className="btn btn-outline-secondary" href="management">Find out more</Link>
        </div>
    </div>
    <div className="col text-center align-self-center">
      <picture className="content-image-surface">
        <img src="CraneLift-20230329b.png" className="img-fluid themed-content-image" alt="
                A space-time diagram has two axes, Time horizontally and
                Space vertically. Resources are displayed as horizontal
                bars spaced along the Space axis. Activities are displayed
                as boxes spanning the resources they use and their
                temporal extent on the Time axis. Where a resource
                participates in an activity the overlapping area is
                shaded.
                "></img>
      </picture>
    </div>
  </div>
</div>

</Container>
    </>
  );
}
