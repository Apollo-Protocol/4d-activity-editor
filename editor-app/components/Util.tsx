import React, { JSX } from "react";
import Link from "next/link";
import { Button, Col, Row } from "react-bootstrap";

interface ButtonRowProps {
  children: JSX.Element[];
}

export function ButtonRow({ children }: ButtonRowProps) {
  return (
    <Row className="justify-content-around">
      { children.map(c => <Col key={c.props.href}>{c}</Col>) }
    </Row>
  );
}

interface LinkButtonProps {
  href: string;
  children: React.ReactNode;
}

export function LinkButton({ href, children }: LinkButtonProps) {
  return (
    <Link href={href} passHref>
      <Button>{children}</Button>
    </Link>
  );
}

