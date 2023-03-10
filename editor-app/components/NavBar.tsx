import React from "react";
import Link from "next/link";
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
  const linkType = props.linkType ?? Nav.Link;
  return (
    <Link href={href} passHref style={{ textDecoration: "none" }}>
      {React.createElement(linkType, { as: "span" }, children)}
    </Link>
  );
}

/*
            <NavDropdown title="Advanced Topics" id="collasible-nav-dropdown">
              <NavDropdown.Item href="#action/3.1">
                First Topic
              </NavDropdown.Item>
              <NavDropdown.Item href="#action/3.2">
                Second topic
              </NavDropdown.Item>
              <NavDropdown.Item href="#action/3.3">
                Second Topic
              </NavDropdown.Item>
            </NavDropdown>
*/

function CollapsibleExample() {
  return (
    <Navbar
      className="mb-5"
      collapseOnSelect
      expand="lg"
      bg="dark"
      variant="dark"
    >
      <Container>
        <NavItem href="/" linkType={Navbar.Brand}>
          Activity Diagram Editor
        </NavItem>
        <Navbar.Toggle aria-controls="responsive-navbar-nav" />
        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="me-auto">
            <NavItem href="/intro">Introduction</NavItem>
            <NavItem href="/editor">Editor</NavItem>
            <NavItem href="/crane">Example analysis</NavItem>
            <NavItem href="/management">Integrated information management</NavItem>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default CollapsibleExample;
