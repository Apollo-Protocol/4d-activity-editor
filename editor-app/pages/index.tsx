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
    <div className="container has-bg-img">
      <div className="position-relative overflow-hidden p-3 p-md-5 m-md-3 text-center bg-light">
      <div className="col-md-5 p-lg-5 mx-auto my-5">
        <h1 className="display-4 font-weight-normal">Activity Model Development Tool</h1>
        <p className="lead font-weight-normal">Learn and practice planning in a new way. Helping you discover all the information you need for complete decision making and resource planning.</p>
        <a className="btn btn-outline-secondary" href="/editor">Go To Editor</a>
      </div>
      <div className="product-device box-shadow d-none d-md-block"></div>
      <div className="product-device product-device-2 box-shadow d-none d-md-block"></div>
    </div>
    </div>

    <div className="container">
  <div className="row">
    <div className="col">
    <div className="bg-light mr-md-3 pt-3 px-3 pt-md-5 px-md-5 text-center overflow-hidden">
        <div className="my-3 p-3">
          <h2 className="display-5">Another headline</h2>
          <p className="lead">And an even wittier subheading.</p>
        </div>
        <div className="bg-white box-shadow mx-auto"></div>
      </div>
      </div>
    <div className="col">
    <div className="bg-light mr-md-3 pt-3 px-3 pt-md-5 px-md-5 text-center overflow-hidden">
        <div className="my-3 p-3">
          <h2 className="display-5">Another headline</h2>
          <p className="lead">And an even wittier subheading.</p>
        </div>
        <div className="bg-white box-shadow mx-auto"></div>
      </div>
      </div>
    <div className="w-100"></div>
    <div className="col">Column</div>
    <div className="col">Column</div>
  </div>
</div>

    </>
  );
}
