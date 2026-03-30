import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import DraggableModalDialog, { shouldSuppressModalHide } from "@/components/DraggableModalDialog";
import { useTheme } from "next-themes";
import {
  applyTypographyProfile,
  getStoredTypographyProfile,
  TypographyProfileKey,
} from "@/utils/appearance";

const APPEARANCE_THEME_KEY = "app-theme";
const APPEARANCE_NAV_STYLE_KEY = "app-nav-style";
const DEFAULT_ACCENT = "#007fff";
const DEFAULT_THEME = "light" as const;
const DEFAULT_NAV_LINK_COLOR = "#909091";
const DEFAULT_JUMP_LINK_COLOR = "#007fff";

const THEME_COLORS = [
  { name: "Dark Tangerine", value: "#f29f11" },
  { name: "Endeavour", value: "#007fff" },
  { name: "Dark Gray Blue", value: "#909091" },
];

const THEME_OPTIONS = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
] as const;

const TYPOGRAPHY_OPTIONS: Array<{
  key: TypographyProfileKey;
  label: string;
  heading: string;
  subheading: string;
  body: string;
  description: string;
}> = [
  {
    key: "default",
    label: "Default",
    heading: "Roboto",
    subheading: "Roboto",
    body: "Roboto",
    description: "Uses the standard editor type style across headings, labels, and body text.",
  },
  {
    key: "apollo",
    label: "Apollo Forum",
    heading: "Jost Medium",
    subheading: "Merriweather Regular",
    body: "Source Sans 3 Variable",
    description: "Applies an editorial mix: Jost for headings, Merriweather for subheadings, and Source Sans 3 for body copy.",
  },
];

function isValidHex(hex: string) {
  return /^#([0-9a-fA-F]{3}){1,2}$/.test(hex);
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

/** Returns true when a hex colour is grey-ish (low saturation). */
function isGreyish(hex: string): boolean {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return false;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  const sat = max === min ? 0 : (max - min) / (l > 0.5 ? 510 - max - min : max + min);
  return sat < 0.15;
}

/** Pick a visible selection ring colour: if the accent is grey use a blue indicator. */
function selectionBorderColor(accent: string): string {
  return isGreyish(accent) ? "#007fff" : accent;
}

function applyAccent(color: string) {
  document.documentElement.style.setProperty("--bs-primary", color);
  document.documentElement.style.setProperty("--app-accent", color);
  const rgb = hexToRgb(color);
  if (rgb) {
    document.documentElement.style.setProperty("--app-accent-rgb", rgb);
  }
  // When the accent is grey, override secondary buttons to blue
  if (isGreyish(color)) {
    document.documentElement.classList.add("app-grey-accent");
  } else {
    document.documentElement.classList.remove("app-grey-accent");
  }
  localStorage.setItem("app-accent-color", color);
}

function applyDefaultNavStyle() {
  document.documentElement.classList.remove("app-custom-theme");
  document.documentElement.style.setProperty("--app-nav-link-light-hover", DEFAULT_NAV_LINK_COLOR);
  document.documentElement.style.setProperty("--app-nav-link-light-underline", DEFAULT_NAV_LINK_COLOR);
  document.documentElement.style.setProperty("--app-nav-dropdown-item-light-hover-color", "#495057");
  document.documentElement.style.setProperty("--app-nav-dropdown-item-light-hover-bg", "#f8f9fa");
  document.documentElement.style.setProperty("--app-jump-link-hover", DEFAULT_JUMP_LINK_COLOR);
  document.documentElement.style.setProperty("--app-jump-link-active", DEFAULT_JUMP_LINK_COLOR);
  document.documentElement.style.setProperty("--app-jump-link-hover-bg", "rgba(0, 127, 255, 0.06)");
  document.documentElement.style.setProperty("--app-jump-link-active-bg", "rgba(0, 127, 255, 0.08)");
  localStorage.setItem(APPEARANCE_NAV_STYLE_KEY, "default");
}

function applyCustomNavStyle() {
  document.documentElement.classList.add("app-custom-theme");
  document.documentElement.style.setProperty("--app-nav-link-light-hover", "var(--app-accent, #007fff)");
  document.documentElement.style.setProperty("--app-nav-link-light-underline", "var(--app-accent, #007fff)");
  document.documentElement.style.setProperty("--app-nav-dropdown-item-light-hover-color", "var(--app-accent, #007fff)");
  document.documentElement.style.setProperty("--app-nav-dropdown-item-light-hover-bg", "rgba(var(--app-accent-rgb, 0, 127, 255), 0.12)");
  document.documentElement.style.setProperty("--app-jump-link-hover", "var(--app-accent, #007fff)");
  document.documentElement.style.setProperty("--app-jump-link-active", "var(--app-accent, #007fff)");
  document.documentElement.style.setProperty("--app-jump-link-hover-bg", "rgba(var(--app-accent-rgb, 0, 127, 255), 0.06)");
  document.documentElement.style.setProperty("--app-jump-link-active-bg", "rgba(var(--app-accent-rgb, 0, 127, 255), 0.08)");
  localStorage.setItem(APPEARANCE_NAV_STYLE_KEY, "custom");
}

interface Props {
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function AppearanceModal({ show, setShow }: Props) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // "saved" = what's currently applied; "draft" = what the user is picking
  const [savedColor, setSavedColor] = useState(DEFAULT_ACCENT);
  const [draftColor, setDraftColor] = useState(DEFAULT_ACCENT);
  const [pendingTheme, setPendingTheme] = useState<string>("system");
  const [savedTypography, setSavedTypography] =
    useState<TypographyProfileKey>("default");
  const [draftTypography, setDraftTypography] =
    useState<TypographyProfileKey>("default");
  const [isDefaultProfileMode, setIsDefaultProfileMode] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("app-accent-color");
    if (stored && isValidHex(stored)) {
      setSavedColor(stored);
      setDraftColor(stored);
      applyAccent(stored);
    }
    const storedTheme = localStorage.getItem(APPEARANCE_THEME_KEY);
    if (storedTheme && THEME_OPTIONS.some((option) => option.key === storedTheme)) {
      setPendingTheme(storedTheme);
      setTheme(storedTheme);
    }
    const typographyProfile = getStoredTypographyProfile();
    setSavedTypography(typographyProfile);
    setDraftTypography(typographyProfile);
    applyTypographyProfile(typographyProfile);
    const navStyle = localStorage.getItem(APPEARANCE_NAV_STYLE_KEY);
    if (navStyle === "custom") {
      applyCustomNavStyle();
      setIsDefaultProfileMode(false);
    } else {
      applyDefaultNavStyle();
      setIsDefaultProfileMode(true);
    }
  }, [setTheme]);

  // Sync pendingTheme when modal opens
  useEffect(() => {
    if (show && theme) {
      const storedTheme = localStorage.getItem(APPEARANCE_THEME_KEY);
      if (storedTheme && THEME_OPTIONS.some((option) => option.key === storedTheme)) {
        setPendingTheme(storedTheme);
      } else {
        setPendingTheme(theme);
      }
      const stored = localStorage.getItem("app-accent-color");
      if (stored && isValidHex(stored)) {
        setSavedColor(stored);
        setDraftColor(stored);
      }
      const typographyProfile = getStoredTypographyProfile();
      setSavedTypography(typographyProfile);
      setDraftTypography(typographyProfile);
      const navStyle = localStorage.getItem(APPEARANCE_NAV_STYLE_KEY);
      setIsDefaultProfileMode(navStyle !== "custom");
    }
  }, [show, theme]);

  function handleClose() {
    // Revert draft to saved on cancel
    setDraftColor(savedColor);
    setPendingTheme(theme || "system");
    setDraftTypography(savedTypography);
    setIsDefaultProfileMode(localStorage.getItem(APPEARANCE_NAV_STYLE_KEY) !== "custom");
    setShow(false);
  }

  function handleModalHide() {
    if (shouldSuppressModalHide()) return;
    handleClose();
  }

  function handleSave() {
    const colorToApply = isValidHex(draftColor) ? draftColor : DEFAULT_ACCENT;
    applyAccent(colorToApply);
    setSavedColor(colorToApply);
    applyTypographyProfile(draftTypography);
    setSavedTypography(draftTypography);
    if (isDefaultProfileMode) {
      applyDefaultNavStyle();
      setIsDefaultProfileMode(true);
    } else {
      applyCustomNavStyle();
      setIsDefaultProfileMode(false);
    }
    setTheme(pendingTheme);
    localStorage.setItem(APPEARANCE_THEME_KEY, pendingTheme);
    setShow(false);
  }

  if (!mounted) return null;

  return (
    <Modal
      dialogAs={DraggableModalDialog}
      show={show}
      onHide={handleModalHide}
      size="lg"
    >
      <Modal.Header closeButton>
        <Modal.Title>Appearance</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-4">
          <Form.Label className="fw-semibold">Interface Theme</Form.Label>
          <div className="theme-cards">
            {THEME_OPTIONS.map((opt) => {
              const isActive = pendingTheme === opt.key;
              return (
                <button
                  type="button"
                  key={opt.key}
                  className={`theme-card${isActive ? " is-active" : ""}`}
                  onClick={() => {
                    setPendingTheme(opt.key);
                  }}
                  aria-label={`Select ${opt.label}`}
                >
                  <div className="theme-card-preview">
                    <ThemePreview variant={opt.key} />
                  </div>
                  <span className="theme-card-label">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold">Accent Colour</Form.Label>
          <div className="color-scheme-grid">
            {(() => {
              const selected = isDefaultProfileMode;
              const ringColor = selectionBorderColor(DEFAULT_ACCENT);
              return (
                <button
                  type="button"
                  key="default-profile"
                  className={`color-scheme-btn${selected ? " is-selected" : ""}`}
                  style={selected ? { borderColor: ringColor, boxShadow: `0 0 0 1px ${ringColor}` } : undefined}
                  aria-label="Select default appearance"
                  onClick={() => {
                    setDraftColor(DEFAULT_ACCENT);
                    setIsDefaultProfileMode(true);
                  }}
                >
                  <span
                    className="color-scheme-circle"
                    style={{ background: "linear-gradient(90deg, #007fff 0 50%, #909091 50% 100%)" }}
                  >
                    {selected && (
                      <svg viewBox="0 0 16 16" className="color-scheme-check" fill="white" aria-hidden>
                        <path d="M13.485 3.929a1 1 0 0 1 .057 1.414l-6 6.5a1 1 0 0 1-1.452.012l-3-3a1 1 0 1 1 1.414-1.414L6.95 9.88l5.293-5.893a1 1 0 0 1 1.414-.057z" />
                      </svg>
                    )}
                  </span>
                  <span className="color-scheme-label">Default</span>
                </button>
              );
            })()}
            {THEME_COLORS.map((c) => {
              const selected = !isDefaultProfileMode && draftColor === c.value;
              const ringColor = selectionBorderColor(c.value);
              return (
                <button
                  type="button"
                  key={c.value}
                  className={`color-scheme-btn${selected ? " is-selected" : ""}`}
                  style={selected ? { borderColor: ringColor, boxShadow: `0 0 0 1px ${ringColor}` } : undefined}
                  aria-label={`Select ${c.name}`}
                  onClick={() => {
                    setDraftColor(c.value);
                    setIsDefaultProfileMode(false);
                  }}
                >
                  <span
                    className="color-scheme-circle"
                    style={{ background: c.value }}
                  >
                    {selected && (
                      <svg viewBox="0 0 16 16" className="color-scheme-check" fill="white" aria-hidden>
                        <path d="M13.485 3.929a1 1 0 0 1 .057 1.414l-6 6.5a1 1 0 0 1-1.452.012l-3-3a1 1 0 1 1 1.414-1.414L6.95 9.88l5.293-5.893a1 1 0 0 1 1.414-.057z" />
                      </svg>
                    )}
                  </span>
                  <span className="color-scheme-label">{c.name}</span>
                </button>
              );
            })}
          </div>
        </Form.Group>

        <Form.Group className="mb-0">
          <Form.Label className="fw-semibold">Typography</Form.Label>
          <div className="typography-cards">
            {TYPOGRAPHY_OPTIONS.map((option) => {
              const isActive = draftTypography === option.key;
              return (
                <button
                  type="button"
                  key={option.key}
                  className={`typography-card${isActive ? " is-active" : ""}`}
                  onClick={() => setDraftTypography(option.key)}
                  aria-label={`Select ${option.label} typography`}
                >
                  <div className="typography-card-header">
                    <span className="typography-card-label">{option.label}</span>
                    <span className="typography-card-badge">
                      {option.key === "apollo" ? "Guideline" : "Legacy"}
                    </span>
                  </div>
                  <div className="typography-card-preview-block">
                    <div
                      className="typography-card-heading"
                      style={{ fontFamily: option.key === "apollo" ? '"Jost", "Segoe UI", sans-serif' : '"Roboto", Arial, sans-serif' }}
                    >
                      Titles &amp; Headers
                    </div>
                    <div
                      className="typography-card-subheading"
                      style={{ fontFamily: option.key === "apollo" ? '"Merriweather", Georgia, serif' : '"Roboto", Arial, sans-serif' }}
                    >
                      Sub Headers &amp; Emphasis
                    </div>
                    <div
                      className="typography-card-body"
                      style={{ fontFamily: option.key === "apollo" ? '"Source Sans 3", "Segoe UI", sans-serif' : '"Roboto", Arial, sans-serif' }}
                    >
                      Body copy stays readable across the editor, docs, and diagram labels.
                    </div>
                  </div>
                  <div className="typography-card-meta">
                    <span>{option.heading}</span>
                    <span>{option.subheading}</span>
                    <span>{option.body}</span>
                  </div>
                  <div className="typography-card-description">{option.description}</div>
                </button>
              );
            })}
          </div>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

/* ---------- SVG preview thumbnails ---------- */

function ThemePreview({ variant }: { variant: string }) {
  const isDark = variant === "dark";
  const isSystem = variant === "system";

  if (isSystem) {
    return (
      <svg viewBox="0 0 220 140" className="theme-preview-svg" aria-hidden>
        <defs>
          <clipPath id="sysL"><rect x="0" y="0" width="110" height="140" /></clipPath>
          <clipPath id="sysR"><rect x="110" y="0" width="110" height="140" /></clipPath>
        </defs>
        <g clipPath="url(#sysL)">
          <rect width="220" height="140" rx="8" fill="#f4f4f5" />
          <rect x="18" y="30" width="184" height="6" rx="3" fill="#d4d4d8" />
          <circle cx="18" cy="56" r="5" fill="#c4c4c8" />
          <rect x="30" y="52" width="120" height="5" rx="2.5" fill="#d4d4d8" />
          <circle cx="18" cy="76" r="5" fill="#818cf8" />
          <rect x="30" y="72" width="140" height="5" rx="2.5" fill="#d4d4d8" />
          <circle cx="18" cy="96" r="5" fill="#c4c4c8" />
          <rect x="30" y="92" width="100" height="5" rx="2.5" fill="#d4d4d8" />
        </g>
        <g clipPath="url(#sysR)">
          <rect width="220" height="140" rx="8" fill="#1e1e2e" />
          <rect x="18" y="30" width="184" height="6" rx="3" fill="#3f3f5a" />
          <circle cx="18" cy="56" r="5" fill="#4a4a6a" />
          <rect x="30" y="52" width="120" height="5" rx="2.5" fill="#3f3f5a" />
          <circle cx="18" cy="76" r="5" fill="#818cf8" />
          <rect x="30" y="72" width="140" height="5" rx="2.5" fill="#3f3f5a" />
          <circle cx="18" cy="96" r="5" fill="#4a4a6a" />
          <rect x="30" y="92" width="100" height="5" rx="2.5" fill="#3f3f5a" />
        </g>
        <line x1="110" y1="0" x2="110" y2="140" stroke="#888" strokeWidth="0.5" />
      </svg>
    );
  }

  const bg = isDark ? "#1e1e2e" : "#f4f4f5";
  const line = isDark ? "#3f3f5a" : "#d4d4d8";
  const dot = isDark ? "#4a4a6a" : "#c4c4c8";
  const accent = "#818cf8";

  return (
    <svg viewBox="0 0 220 140" className="theme-preview-svg" aria-hidden>
      <rect width="220" height="140" rx="8" fill={bg} />
      <rect x="18" y="30" width="184" height="6" rx="3" fill={line} />
      <circle cx="18" cy="56" r="5" fill={dot} />
      <rect x="30" y="52" width="120" height="5" rx="2.5" fill={line} />
      <circle cx="18" cy="76" r="5" fill={accent} />
      <rect x="30" y="72" width="140" height="5" rx="2.5" fill={line} />
      <circle cx="18" cy="96" r="5" fill={dot} />
      <rect x="30" y="92" width="100" height="5" rx="2.5" fill={line} />
    </svg>
  );
}
