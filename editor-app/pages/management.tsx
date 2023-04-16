import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { Col, Container, Row } from "react-bootstrap";
import styles from "@/styles/Home.module.css";

export default function Page() {
  return (
    <>
      <Head>
        <title>Integrated information management</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="favicon.ico" />
      </Head>
      <Container>
      <div className="row">
    <div className="col mb-5">
    <h1 className="display-4 font-weight-normal">Integrated Information Management</h1>
    </div>
  </div>

        <Row className="row-cols-1 row-cols-lg-2">
          <Col className="col-md amrc-text">

            <p>Running a business, or other organisation, of any size 
            means making decisions, all the time, at all levels. For any 
            decision to be a good decision, whether the it is made 
            by a person or by a machine, information is essential; the 
            correct information must be available at the time it is needed
            and of a suitable quality to enable the decision to be made 
            properly.</p>
            <p>This page gives an overview of what&apos;s involved in ensuring 
            that information is fit for the collective decisions in an 
            integrated and well managed managed enterprise. Further information can also be found at: </p>
            <p><Link href="https://www.theiet.org/impact-society/factfiles/built-environment-factfiles/the-apollo-protocol-unifying-digital-twins-across-sectors/">Apollo Protocol</Link></p>
          </Col>
          <Col className="col-md text-center">
            <picture><img src="7CirclesMedium2.png" className="w-100 mt-3" alt="A layered view of what's needed
            for integrated information management"></img></picture>
            <p className="amrc-fixme">Elements of integrated information 
            management</p>
          </Col>
        </Row>
        <Row className="row-cols-1 row-cols-lg-2 mt-5">
          <Col className="amrc-text">
            <h4>Integration Data Models</h4>
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
            unstructured human documents. Most organisations don&apos;t 
            realise how reliant they are on unstructured information 
            and the inherent knowledge of people with experience of the 
            activities, no matter how critical.</p>

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

            <p>The path out of this mess is through a mature approach to
            information quality management involving an integration data
            model. This is a data model constructed to be fit to
            consistently represent any and all information required by the 
            business rather than to make any particular business process 
            easier to implement. Ideally the model needs to be fit to 
            represent any data the business may need in the future, too, 
            otherwise the modelling will need to be redone (at
            unnecessary expense); this is a very open-ended requirement
            to meet, and requires a different approach to data modelling
            from that traditionally taken.</p>
          </Col>
          <Col className="amrc-text">
            <h4>4D Data Modelling</h4>
            <p>One of the more difficult aspects of creating an
            integrated information management framework is reconciling
            the different data models used by the different systems we
            intend to integrate. Systems developed in isolation from
            each other invariably end up modelling the same real-world
            objects and activities in different ways, because each
            system is only looking at the aspect of the situation that
            is useful for that system&apos;s particular purpose.</p>

            <p>Inconsistent data is not fit for integrated use and implies
            ambiguity in what is being represented. Without a way of 
            addressing the consistency challenge data will be semantically
            and structurally ambiguous.</p>

            <p>The intention of the 4D approach to data modelling is to
            provide an overall framework within which to develop models
            (technically through the use of a 
            <i> top-level ontology (TLO)</i>)
            which matches as closely to the physical reality as possible. 
            The reason for this is that where you have separate systems
            modelling the same real-world things using different data
            models the only common point of reference between the
            different systems is the real-world things they are
            modelling. If you build your integration data model within a
            framework which represents things as they are in the real
            world, rather than as is convenient for a particular
            business process, then you are effectively guaranteed at the
            start that anything in the real world will be representable
            in your model.  Two models created independently for the same 
            activity should be recognisably similar (this is not the case 
            without a TLO).</p>

            <p>Developing such a framework from scratch is a difficult
            and highly technical process (the real world is a
            complicated place). However, an understanding of the
            technical foundations is not necessary in order to use the
            results. This activity modeller uses a top-level framework
            called HQDM (High Quality Data Models) developed by Matthew 
            West.</p>

            <p>Recent work to develop an Information Management Framework 
            comprising a Foundation Data Model that incorporates the 
            necessary commitments of a TLO was summarised at&nbsp;
            <Link href="https://gateway.newton.ac.uk/event/tgmw80/programme">
              this</Link>&nbsp;event.</p>

            <p>Please get in touch, and contribute to the open source 
            resources, if you are interested in adopting or getting 
            involved in this work.</p>
          </Col>
        </Row>
      </Container>
    </>
  );
}
