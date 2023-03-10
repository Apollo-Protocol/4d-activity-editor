import Head from "next/head";
import Link from "next/link";
import { Col, Container, Row } from "react-bootstrap";
import styles from "@/styles/Home.module.css";

export default function Page() {
  return (
    <>
      <Head>
        <title>Integrated information management</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Container>
        <Row className="justify-content-center">
          <Col className="amrc-text">
            <h1>Integrated information management</h1>

            <p>Running a business of any size means making decisions,
            all the time, at all levels. For any decision to be made
            correctly, whether the decision is made by a person or by a
            machine, information is essential; the correct information
            must be available at the time it is needed and of a suitable
            quality to enable the decision to be made properly.</p>
          </Col>
        </Row>
        <Row className="row-cols-1 row-cols-lg-2">
          <Col className="amrc-text">
            <h2>Integration data models</h2>
            <p>An integrated information management framework aims to
            ensure that this requirement for suitable information is
            met, while keeping the costs of managing the required
            information under control. In almost any business there are
            multiple systems for managing information: a purchasing
            system, an HR system, a sales system, and then systems for
            managing the business of the business, such as a PLM system
            or a stock control system or otherwise as appropriate. There
            are also nearly always a large number of human systems and
            processes, often consisting of manually transferring data
            from one of these systems to another, or into or out of
            unstructured human documents.</p>

            <p>Without taking an integrated approach to information
            management these translation processes will always continue
            to exist. As the business grows and gets more complex more
            systems will be introduced; these will require yet more
            manual processes to transfer data into and out of the other
            systems. It is possible to automate the data transfer
            process, but without an integrated data modelling approach
            each individual translation process must be analysed and
            implemented explicitly; this rapidly becomes very costly to
            produce and especially to maintain.</p>

            <p>More importantly, because each information system has
            only a narrow focus, information can be lost which will be
            needed later by other systems or processes. This means that
            when that information is required later on it will need to
            be rediscovered or recreated, or a decision will have to be
            made on the basis of incomplete information. This also
            implies unnecessary cost, whether to produce the required
            information again or as a result of making bad decisions due
            to unavailable information.</p>

            <p>The path out of this mess is through an integration data
            model. This is a data model constructed to be fit to
            represent any and all data required by the business rather
            than to make any particular business process easier to
            implement. Ideally the model needs to be fit to represent
            any data the business may need in the future, too, otherwise
            the integration modelling will need to be redone (at
            unnecessary expense); this is a very open-ended requirement
            to meet, and requires a different approach to data modelling
            from that traditionally taken.</p>
          </Col>
          <Col className="amrc-text">
            <h2>4D data modelling</h2>
            <p>One of the more difficult aspects of creating an
            integrated information management framework is reconciling
            the different data models used by the different systems we
            intend to integrate. Systems developed in isolation from
            each other invariably end up modelling the same real-world
            objects and activities in different ways, because each
            system is only looking at the aspect of the situation that
            is useful for that system&apos;s particular purpose.</p>
            <p className="amrc-fixme">We need an example here of two
            systems modelling the same object in incompatible ways. The
            telephone directory example from HQDM doesn&apos;t really seem to
            fit...</p>

            <p>The intention of the 4D approach to data modelling is to
            provide an overall framework within which to develop models
            (technically called a <i>top-level ontology</i>) which
            matches as closely to the physical reality as possible. The
            reason for this is that where you have separate systems
            modelling the same real-world things using different data
            models the only common point of reference between the
            different systems is the real-world things they are
            modelling. If you build your integration data model within a
            framework which represents things as they are in the real
            world, rather than as is convenient for a particular
            business process, then you are effectively guaranteed at the
            start that anything in the real world will be representable
            in your model.</p>

            <p>Developing such a framework from scratch is a difficult
            and highly technical process (the real world is a
            complicated place). However, an understanding of the
            technical foundations is not necessary in order to use the
            results. This activity modeller uses a top-level framework
            called HDQM (High Quality Data Models) developed in the
            early 2000s by Matthew West.</p>

            <p className="amrc-fixme">I feel we need a paragraph about
            the FDM here: &lsquo;a framework is being constructed which you
            can use when it&apos;s ready&rsquo;...?</p>
          </Col>
        </Row>
      </Container>
    </>
  );
}
