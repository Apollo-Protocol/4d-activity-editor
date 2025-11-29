import Footer from "@/components/Footer";
import { Html, Head, Main, NextScript } from "next/document";
import { Navbar } from "react-bootstrap";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@100;200;300;400;500;600;700&display=swap"
          rel="stylesheet"
        ></link>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-multiselect/1.1.2/css/bootstrap-multiselect.css"
          type="text/css"
        />
      </Head>
      <body>
        <div
          id="page-container"
          style={{ position: "relative", minHeight: "100vh" }}
        >
          <div id="content-wrap" style={{ paddingBottom: "2rem" }}>
            <Main />
            <NextScript />
          </div>
        </div>
      </body>
    </Html>
  );
}
