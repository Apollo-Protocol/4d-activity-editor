import React from "react";
import Link from "next/link";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";

interface NavItemProps {
  href: string;
  children: string;
  linkType?: React.FunctionComponent;
}

function NavItem(props: NavItemProps) {
  const { href, children } = props;
  const linkType = props.linkType ?? Nav.Link;
  return (
    <Link href={href} passHref style={{ textDecoration: "none" }}>
      {React.createElement(linkType, { as: "span" }, children)}
    </Link>
  );
}

function CollapsibleExample() {
  return (
    <Navbar
      collapseOnSelect
      expand="lg"
      variant="light"
      sticky="top"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        zIndex: 1030,
      }}
    >
      <Container fluid className="px-4">
        <Link className="navbar-brand d-flex align-items-center" href="/#">
          <picture>
            <img src="Logo_Apollo.png" height="50" alt="Apollo Protocol" />
          </picture>
        </Link>
        <Navbar.Toggle aria-controls="responsive-navbar-nav" />
        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="ms-auto gap-2">
            <NavItem href="editor">Editor</NavItem>
            <NavItem href="manual">Guide</NavItem>
            <NavDropdown
              title="Activity Modelling"
              id="activity-modelling-dropdown"
            >
              <NavDropdown.Item href="./intro">Introduction</NavDropdown.Item>
              <NavDropdown.Item href="./crane">
                Example Analysis
              </NavDropdown.Item>
              <NavDropdown.Item href="./management">
                Integrated Information Management
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default CollapsibleExample;
