import Link from "next/link";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";

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
        <Link href="/" passHref style={{ textDecoration: "none" }}>
          <Navbar.Brand as="span">Activity Diagram Editor</Navbar.Brand>
        </Link>
        <Navbar.Toggle aria-controls="responsive-navbar-nav" />
        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="me-auto">
            <Link
              href="/getting-started"
              passHref
              style={{ textDecoration: "none" }}
            >
              <Nav.Link as="span">Getting Started</Nav.Link>
            </Link>
            <Link href="/editor" passHref style={{ textDecoration: "none" }}>
              <Nav.Link as="span">Editor</Nav.Link>
            </Link>
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
          </Nav>
          <Nav>
            <Nav.Link href="#deets">On The Right</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default CollapsibleExample;
