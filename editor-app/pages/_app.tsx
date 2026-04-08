import "bootstrap/dist/css/bootstrap.css";
import "@/styles/globals.css";
import "@/styles/sortableList.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import Navbar from "@/components/NavBar";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import AppearanceModal from "@/modals/AppearanceModal";
import { ThemeProvider } from "next-themes";
import { useRouter } from "next/router";
import { applyTypographyProfile, getStoredTypographyProfile } from "@/utils/appearance";

type ScrollPosition = {
  x: number;
  y: number;
};

const SCROLL_STORAGE_KEY = "app-scroll-positions";

function stripHash(url: string) {
  return url.split("#", 1)[0];
}

function readScrollPositions() {
  try {
    const stored = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Record<string, ScrollPosition>) : {};
  } catch {
    return {};
  }
}

function writeScrollPositions(positions: Record<string, ScrollPosition>) {
  try {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage failures and keep navigation functional.
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const router = useRouter();

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

  useEffect(() => {
    if (!router.isReady || typeof window === "undefined") {
      return;
    }

    const saveCurrentPosition = () => {
      const currentKey = stripHash(window.location.pathname + window.location.search);
      const positions = readScrollPositions();
      positions[currentKey] = {
        x: window.scrollX,
        y: window.scrollY,
      };
      writeScrollPositions(positions);
    };

    const restorePosition = (url: string, fallback?: ScrollPosition) => {
      const targetKey = stripHash(url);
      const positions = readScrollPositions();
      const position = positions[targetKey] ?? fallback;

      if (!position) {
        return;
      }

      positions[targetKey] = position;
      writeScrollPositions(positions);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo(position.x, position.y);
        });
      });
    };

    let pendingPosition: ScrollPosition | undefined;

    const handleRouteChangeStart = () => {
      pendingPosition = {
        x: window.scrollX,
        y: window.scrollY,
      };
      saveCurrentPosition();
    };

    const handleRouteChangeComplete = (url: string) => {
      restorePosition(url, pendingPosition);
      pendingPosition = undefined;
    };

    window.history.scrollRestoration = "manual";
    restorePosition(stripHash(window.location.pathname + window.location.search));

    router.events.on("routeChangeStart", handleRouteChangeStart);
    router.events.on("routeChangeComplete", handleRouteChangeComplete);
    window.addEventListener("beforeunload", saveCurrentPosition);

    return () => {
      router.events.off("routeChangeStart", handleRouteChangeStart);
      router.events.off("routeChangeComplete", handleRouteChangeComplete);
      window.removeEventListener("beforeunload", saveCurrentPosition);
    };
  }, [router]);

  return (
    <ThemeProvider attribute="data-bs-theme">
      <div
        className="app-shell"
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
            paddingTop: "100px",
          }}
        >
          <Breadcrumbs />
          <Component {...pageProps} />
        </main>
        <AppearanceModal show={showAppearanceModal} setShow={setShowAppearanceModal} />
        <Footer />
      </div>
    </ThemeProvider>
  );
}
