import React from "react";
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
  linkType?: React.FunctionComponent;
}

function NavItem(props: NavItemProps) {
  const { href, children } = props;
  const router = useRouter();
  const isActive = router.pathname === "/" + href || router.pathname === href;

  return (
    <Link
      href={href}
      passHref
      style={{ textDecoration: "none" }}
      className={`nav-link ${isActive ? "active" : ""}`}
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
  const isEditorDropdownActive = [
    "/manual",
    "/editor",
    "/terminology",
  ].includes(router.pathname);
  const isActivityModellingActive = [
    "/intro",
    "/crane",
    "/management",
  ].includes(router.pathname);
  const isSystemComponentsActive = [
    "/system-intro",
    "/system-example",
  ].includes(router.pathname);

  return (
    <Navbar
      collapseOnSelect
      expand="lg"
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
            <NavItem href="/">Home</NavItem>
            <NavDropdown
              title="Editor"
              id="editor-dropdown"
              className={isEditorDropdownActive ? "active-dropdown" : ""}
              align="end"
            >
              <NavDropdown.Item
                href="/manual"
                className={router.pathname === "/manual" ? "active" : ""}
              >
                Guide
              </NavDropdown.Item>
              <NavDropdown.Item
                href="/editor"
                className={router.pathname === "/editor" ? "active" : ""}
              >
                Activity Diagram
              </NavDropdown.Item>
              <NavDropdown.Item
                href="/terminology"
                className={router.pathname === "/terminology" ? "active" : ""}
              >
                Terminology
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item
                as="button"
                onClick={(event) => {
                  event.preventDefault();
                  openAppearanceModal();
                }}
              >
                Appearance
              </NavDropdown.Item>
            </NavDropdown>
            <NavDropdown
              title="Activity Modelling"
              id="activity-modelling-dropdown"
              className={isActivityModellingActive ? "active-dropdown" : ""}
              align="end"
            >
              <NavDropdown.Item
                href="/intro"
                className={router.pathname === "/intro" ? "active" : ""}
              >
                Introduction
              </NavDropdown.Item>
              <NavDropdown.Item
                href="/crane"
                className={router.pathname === "/crane" ? "active" : ""}
              >
                Example Analysis
              </NavDropdown.Item>
              <NavDropdown.Item
                href="/management"
                className={router.pathname === "/management" ? "active" : ""}
              >
                Integrated Information Management
              </NavDropdown.Item>
            </NavDropdown>
            <NavDropdown
              title="System &amp; System Component"
              id="system-dropdown"
              className={isSystemComponentsActive ? "active-dropdown" : ""}
              align="end"
            >
              <NavDropdown.Item
                href="/system-intro"
                className={router.pathname === "/system-intro" ? "active" : ""}
              >
                Introduction
              </NavDropdown.Item>
              <NavDropdown.Item
                href="/system-example"
                className={router.pathname === "/system-example" ? "active" : ""}
              >
                Example Analysis
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default CollapsibleExample;
