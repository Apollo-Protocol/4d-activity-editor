import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";


interface NavItemProps {
  href: string;
  /* This disallows creating nav items containing anything but plain
   * strings. But without this I can't see how to get tsc to let me pass
   * the children into React.createElement below. */
  children: string;
  onNavigate?: () => void;
}

function NavItem(props: NavItemProps) {
  const { href, children, onNavigate } = props;
  const router = useRouter();
  const isActive = router.pathname === "/" + href || router.pathname === href;
  const handleClick = () => {
    onNavigate?.();
  };

  return (
    <Link
      href={href}
      passHref
      style={{ textDecoration: "none" }}
      className={`nav-link ${isActive ? "active" : ""}`}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}

interface NavBarProps {
  openAppearanceModal: () => void;
}

function CollapsibleExample({ openAppearanceModal }: NavBarProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const isActivityModellingActive = [
    "/intro",
    "/crane",
    "/management",
  ].includes(router.pathname);
  const isGuideActive = [
    "/manual",
    "/terminology",
    "/system-intro",
    "/system-example",
  ].includes(router.pathname);

  const collapseNavbar = () => setExpanded(false);

  useEffect(() => {
    collapseNavbar();
  }, [router.asPath]);

  return (
    <Navbar
      collapseOnSelect
      expand="lg"
      expanded={expanded}
      onToggle={(nextExpanded) => setExpanded(Boolean(nextExpanded))}
      className="app-navbar bg-body"
      fixed="top"
      style={{
        backdropFilter: "none",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        zIndex: 1030,
      }}
    >
      <Container fluid className="px-4">
        <Link className="navbar-brand d-flex align-items-center" href="/">
          <picture className="brand-image-surface">
            <img src="Logo_Apollo.png" height="50" alt="Apollo Protocol" className="brand-image" />
          </picture>
        </Link>
        <Navbar.Toggle aria-controls="responsive-navbar-nav" />
        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="ms-auto gap-2">
            <NavItem href="/" onNavigate={collapseNavbar}>Home</NavItem>
            <NavItem href="/editor" onNavigate={collapseNavbar}>Editor</NavItem>
            <NavDropdown
              title="Activity Modelling"
              id="activity-modelling-dropdown"
              className={isActivityModellingActive ? "active-dropdown" : ""}
              align="end"
            >
              <NavDropdown.Item
                as={Link}
                href="/intro"
                className={router.pathname === "/intro" ? "active" : ""}
                onClick={collapseNavbar}
              >
                Introduction
              </NavDropdown.Item>
              <NavDropdown.Item
                as={Link}
                href="/crane"
                className={router.pathname === "/crane" ? "active" : ""}
                onClick={collapseNavbar}
              >
                Example Analysis
              </NavDropdown.Item>
              <NavDropdown.Item
                as={Link}
                href="/management"
                className={router.pathname === "/management" ? "active" : ""}
                onClick={collapseNavbar}
              >
                Integrated Information Management
              </NavDropdown.Item>
            </NavDropdown>
            <NavDropdown
              title="Guide"
              id="guide-dropdown"
              className={isGuideActive ? "active-dropdown" : ""}
              align="end"
            >
              <NavDropdown.Item
                as={Link}
                href="/manual"
                className={router.pathname === "/manual" ? "active" : ""}
                onClick={collapseNavbar}
              >
                Editor Guide
              </NavDropdown.Item>
              <NavDropdown.Item
                as={Link}
                href="/terminology"
                className={router.pathname === "/terminology" ? "active" : ""}
                onClick={collapseNavbar}
              >
                Terminology
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <div className="nav-dropdown-section-title">System &amp; System Components</div>
              <NavDropdown.Item
                as={Link}
                href="/system-intro"
                className={`nav-dropdown-subsection-link ${router.pathname === "/system-intro" ? "active" : ""}`}
                onClick={collapseNavbar}
              >
                Introduction
              </NavDropdown.Item>
              <NavDropdown.Item
                as={Link}
                href="/system-example"
                className={`nav-dropdown-subsection-link ${router.pathname === "/system-example" ? "active" : ""}`}
                onClick={collapseNavbar}
              >
                Example Analysis
              </NavDropdown.Item>
            </NavDropdown>
            <button
              type="button"
              className="nav-link nav-settings-trigger"
              onClick={() => {
                collapseNavbar();
                openAppearanceModal();
              }}
              aria-label="Open appearance settings"
            >
              Settings
            </button>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default CollapsibleExample;
