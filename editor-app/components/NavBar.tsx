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
      variant="light"
    >
      <Container className="border-bottom pb-3 mb-3">
      
        <Link className="navbar-brand" href="/#">
          <picture><img src="Logo_Apollo.png" height="56" alt=""></img></picture>
        </Link>
        <Navbar.Toggle aria-controls="responsive-navbar-nav" />
        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="me-auto">
            <NavItem href="editor">Editor</NavItem>
            <NavItem href="manual">Guide</NavItem>
            <NavDropdown title="Activity Modelling">
              <NavDropdown.Item href="./intro">Introduction</NavDropdown.Item>
              <NavDropdown.Item href="./crane">Example Analysis</NavDropdown.Item>
              <NavDropdown.Item href="./management">Integrated Information Management</NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default CollapsibleExample;
