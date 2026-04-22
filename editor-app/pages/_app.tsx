import "bootstrap/dist/css/bootstrap.css";
import "@/styles/globals.css";
import "@/styles/sortableList.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Navbar from "@/components/NavBar";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import AppearanceModal from "@/modals/AppearanceModal";
import { ThemeProvider } from "next-themes";
import { applyTypographyProfile, getStoredTypographyProfile } from "@/utils/appearance";

function stripHash(url: string) {
  return url.split("#", 1)[0];
}

export default function App({ Component, pageProps }: AppProps) {
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const isEditor = router.pathname === "/editor";
    if (!isEditor) {
      setNavHidden(false);
      return;
    }

    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    let ignoreUntil = 0;
    let isHidden = false;

    const handleScroll = () => {
      if (window.innerWidth > 1599.98) {
        setNavHidden(false);
        isHidden = false;
        return;
      }
      const y = window.scrollY;
      const now = Date.now();

      if (now < ignoreUntil) {
        lastY = y;
        return;
      }

      if (y > lastY + 5 && y > 60) {
        if (!isHidden) {
          isHidden = true;
          setNavHidden(true);
          ignoreUntil = now + 400;
        }
      } else if (y < lastY - 5) {
        if (isHidden) {
          isHidden = false;
          setNavHidden(false);
          ignoreUntil = now + 400;
        }
      }
      lastY = y;
    };

    const handleResize = () => {
      if (window.innerWidth > 1599.98) {
        setNavHidden(false);
        isHidden = false;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      setNavHidden(false);
    };
  }, [router.pathname]);

  useEffect(() => {
    const stored = localStorage.getItem("app-accent-color");
    if (stored && /^#([0-9a-fA-F]{3}){1,2}$/.test(stored)) {
      document.documentElement.style.setProperty("--bs-primary", stored);
      document.documentElement.style.setProperty("--app-accent", stored);
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(stored);
      if (m) {
        const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
        document.documentElement.style.setProperty(
          "--app-accent-rgb",
          `${r}, ${g}, ${b}`
        );
        // Detect grey accent: compute HSL saturation
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2 / 255;
        const sat = max === min ? 0 : (max - min) / (l > 0.5 ? 510 - max - min : max + min);
        if (sat < 0.15) {
          document.documentElement.classList.add("app-grey-accent");
        } else {
          document.documentElement.classList.remove("app-grey-accent");
        }
      }
    }

    const navStyle = localStorage.getItem("app-nav-style");
    if (navStyle === "custom") {
      document.documentElement.classList.add("app-custom-theme");
      document.documentElement.style.setProperty("--app-nav-link-light-hover", "var(--app-accent, #007fff)");
      document.documentElement.style.setProperty("--app-nav-link-light-underline", "var(--app-accent, #007fff)");
      document.documentElement.style.setProperty("--app-nav-dropdown-item-light-hover-color", "var(--app-accent, #007fff)");
      document.documentElement.style.setProperty("--app-nav-dropdown-item-light-hover-bg", "rgba(var(--app-accent-rgb, 0, 127, 255), 0.12)");
      document.documentElement.style.setProperty("--app-jump-link-hover", "var(--app-accent, #007fff)");
      document.documentElement.style.setProperty("--app-jump-link-active", "var(--app-accent, #007fff)");
      document.documentElement.style.setProperty("--app-jump-link-hover-bg", "rgba(var(--app-accent-rgb, 0, 127, 255), 0.06)");
      document.documentElement.style.setProperty("--app-jump-link-active-bg", "rgba(var(--app-accent-rgb, 0, 127, 255), 0.08)");
    } else {
      document.documentElement.classList.remove("app-custom-theme");
      document.documentElement.style.setProperty("--app-nav-link-light-hover", "#909091");
      document.documentElement.style.setProperty("--app-nav-link-light-underline", "#909091");
      document.documentElement.style.setProperty("--app-nav-dropdown-item-light-hover-color", "#495057");
      document.documentElement.style.setProperty("--app-nav-dropdown-item-light-hover-bg", "#f8f9fa");
    }

    applyTypographyProfile(getStoredTypographyProfile());
  }, []);

  return (
    <ThemeProvider attribute="data-bs-theme">
      <div
        className={`app-shell${navHidden ? " nav-scroll-hidden" : ""}`}
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          backgroundColor: "var(--bs-body-bg)",
          color: "var(--bs-body-color)",
        }}
      >
        <Navbar openAppearanceModal={() => setShowAppearanceModal(true)} />
        <main
          className="app-main"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "1.5rem",
            paddingTop: navHidden ? "0" : "100px",
            transition: "padding-top 0.3s ease",
          }}
        >
          <Breadcrumbs />
          <Component {...pageProps} />
        </main>
        <div id="app-overlay-root" />
        <AppearanceModal show={showAppearanceModal} setShow={setShowAppearanceModal} />
        <Footer />
      </div>
    </ThemeProvider>
  );
}
