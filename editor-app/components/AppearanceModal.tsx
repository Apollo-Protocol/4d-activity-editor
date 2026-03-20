import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import DraggableModalDialog from "@/components/DraggableModalDialog";
import { useTheme } from "next-themes";

const APPEARANCE_THEME_KEY = "app-theme";
const APPEARANCE_NAV_STYLE_KEY = "app-nav-style";
const DEFAULT_ACCENT = "#0d6efd";
const DEFAULT_THEME = "light" as const;
const DEFAULT_NAV_LINK_COLOR = "#6c757d";
const DEFAULT_JUMP_LINK_COLOR = "#0d6efd";

const THEME_COLORS = [
  { name: "Blue", value: "#0d6efd" },
  { name: "Indigo", value: "#6610f2" },
  { name: "Purple", value: "#6f42c1" },
  { name: "Pink", value: "#d63384" },
  { name: "Red", value: "#dc3545" },
  { name: "Orange", value: "#fd7e14" },
  { name: "Yellow", value: "#ffc107" },
  { name: "Green", value: "#198754" },
  { name: "Teal", value: "#20c997" },
  { name: "Slate", value: "#6c757d" },
];

const THEME_OPTIONS = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
] as const;

function isValidHex(hex: string) {
  return /^#([0-9a-fA-F]{3}){1,2}$/.test(hex);
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

function applyAccent(color: string) {
  document.documentElement.style.setProperty("--bs-primary", color);
  document.documentElement.style.setProperty("--app-accent", color);
  const rgb = hexToRgb(color);
  if (rgb) {
    document.documentElement.style.setProperty("--app-accent-rgb", rgb);
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
  document.documentElement.style.setProperty("--app-jump-link-hover-bg", "rgba(13, 110, 253, 0.06)");
  document.documentElement.style.setProperty("--app-jump-link-active-bg", "rgba(13, 110, 253, 0.08)");
  localStorage.setItem(APPEARANCE_NAV_STYLE_KEY, "default");
}

function applyCustomNavStyle() {
  document.documentElement.classList.add("app-custom-theme");
  document.documentElement.style.setProperty("--app-nav-link-light-hover", "var(--app-accent, #0d6efd)");
  document.documentElement.style.setProperty("--app-nav-link-light-underline", "var(--app-accent, #0d6efd)");
  document.documentElement.style.setProperty("--app-nav-dropdown-item-light-hover-color", "var(--app-accent, #0d6efd)");
  document.documentElement.style.setProperty("--app-nav-dropdown-item-light-hover-bg", "rgba(var(--app-accent-rgb, 13, 110, 253), 0.12)");
  document.documentElement.style.setProperty("--app-jump-link-hover", "var(--app-accent, #0d6efd)");
  document.documentElement.style.setProperty("--app-jump-link-active", "var(--app-accent, #0d6efd)");
  document.documentElement.style.setProperty("--app-jump-link-hover-bg", "rgba(var(--app-accent-rgb, 13, 110, 253), 0.06)");
  document.documentElement.style.setProperty("--app-jump-link-active-bg", "rgba(var(--app-accent-rgb, 13, 110, 253), 0.08)");
  localStorage.setItem(APPEARANCE_NAV_STYLE_KEY, "custom");
}

function applyDefaultAppearance(setTheme: (theme: string) => void) {
  applyAccent(DEFAULT_ACCENT);
  applyDefaultNavStyle();
  setTheme(DEFAULT_THEME);
  localStorage.setItem(APPEARANCE_THEME_KEY, DEFAULT_THEME);
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
  const [isDefaultProfileMode, setIsDefaultProfileMode] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("app-accent-color");
    if (stored && isValidHex(stored)) {
      setSavedColor(stored);
      setDraftColor(stored);
    }
    const storedTheme = localStorage.getItem(APPEARANCE_THEME_KEY);
    if (storedTheme && THEME_OPTIONS.some((option) => option.key === storedTheme)) {
      setPendingTheme(storedTheme);
      setTheme(storedTheme);
    }
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
      const navStyle = localStorage.getItem(APPEARANCE_NAV_STYLE_KEY);
      setIsDefaultProfileMode(navStyle !== "custom");
    }
  }, [show, theme]);

  function handleClose() {
    // Revert draft to saved on cancel
    setDraftColor(savedColor);
    setPendingTheme(theme || "system");
    setIsDefaultProfileMode(localStorage.getItem(APPEARANCE_NAV_STYLE_KEY) !== "custom");
    setShow(false);
  }

  function handleSave() {
    const colorToApply = isValidHex(draftColor) ? draftColor : DEFAULT_ACCENT;
    applyAccent(colorToApply);
    setSavedColor(colorToApply);
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

  function handleResetDefaults() {
    applyDefaultAppearance(setTheme);
    setSavedColor(DEFAULT_ACCENT);
    setDraftColor(DEFAULT_ACCENT);
    setPendingTheme(DEFAULT_THEME);
    setIsDefaultProfileMode(true);
    setShow(false);
  }

  if (!mounted) return null;

  const isPreset = THEME_COLORS.some((c) => c.value === draftColor);

  return (
    <Modal
      dialogAs={DraggableModalDialog}
      show={show}
      onHide={handleClose}
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
          <p className="text-secondary mb-2" style={{ fontSize: "0.88rem" }}>
            Choose a preset or pick a custom colour.
          </p>
          <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
            {THEME_COLORS.map((c) => (
              <button
                type="button"
                key={c.value}
                className={`color-swatch${!isDefaultProfileMode && draftColor === c.value ? " is-selected" : ""}`}
                style={{ background: c.value }}
                title={c.name}
                aria-label={`Select ${c.name}`}
                onClick={() => {
                  setDraftColor(c.value);
                  setIsDefaultProfileMode(false);
                }}
              />
            ))}
          </div>
          <div className="d-flex align-items-center gap-2">
            <Form.Control
              type="color"
              value={draftColor}
              onChange={(e) => {
                setDraftColor(e.target.value);
                setIsDefaultProfileMode(false);
              }}
              style={{ width: "50px", height: "38px", padding: "2px" }}
              title="Pick a custom colour"
            />
            <Form.Control
              type="text"
              value={draftColor}
              onChange={(e) => {
                const v = e.target.value;
                setDraftColor(v);
                setIsDefaultProfileMode(false);
              }}
              placeholder="#000000"
              style={{ maxWidth: "120px" }}
            />
            {!isPreset && draftColor !== "#0d6efd" && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setDraftColor(DEFAULT_ACCENT)}
                title="Reset to default"
              >
                Reset
              </Button>
            )}
          </div>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={handleResetDefaults}>
          Reset Defaults
        </Button>
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