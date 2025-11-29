import "bootstrap/dist/css/bootstrap.css";
import "@/styles/globals.css";
import "@/styles/sortableList.css";
import type { AppProps } from "next/app";
import Navbar from "@/components/NavBar";
import Footer from "@/components/Footer";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <Navbar />
      <main
        style={{
          flex: 1,
          marginTop: "1.5rem",
          paddingBottom: "10rem", // Space for fixed footer
        }}
      >
        <Component {...pageProps} />
      </main>
      <Footer />
    </div>
  );
}
