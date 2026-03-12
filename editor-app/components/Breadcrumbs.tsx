import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Breadcrumb from "react-bootstrap/Breadcrumb";
import Container from "react-bootstrap/Container";
import Dropdown from "react-bootstrap/Dropdown";

const pathMap: Record<string, string> = {
  "/": "Home",
  "/editor": "Diagram Editor",
  "/manual": "Editor Guide",
  "/intro": "Introduction to 4D",
  "/system-intro": "System Modelling",
  "/system-example": "System Model Example",
  "/crane": "Crane Lift Walkthrough",
  "/management": "Managing Diagrams",
  "/terminology": "Terminology",
};

// NextJS native link wrapper for React-Bootstrap Dropdown
const DropdownLink = React.forwardRef<HTMLAnchorElement, any>((props, ref) => {
  const { href, children, ...rest } = props;
  return (
    <Link href={href} legacyBehavior>
      <a ref={ref} {...rest}>{children}</a>
    </Link>
  );
});
DropdownLink.displayName = "DropdownLink";

export default function Breadcrumbs() {
  const router = useRouter();
  const path = router.pathname;
  const [history, setHistory] = useState<{ path: string; label: string }[]>([]);

  useEffect(() => {
    if (!router.isReady) return;

    let currentHistory: { path: string; label: string }[] = [];
    try {
      const stored = sessionStorage.getItem("breadcrumbHistory");
      if (stored) {
        currentHistory = JSON.parse(stored);
      }
    } catch (e) {
      // safe fallback if JSON parse fails
    }

    // Always ensure Home is the root of the trail
    if (currentHistory.length === 0 || currentHistory[0].path !== "/") {
      currentHistory = [{ path: "/", label: "Home" }];
    }

    const currentLabel = pathMap[path] || "Page";

    if (path === "/") {
      // If navigating to root, reset the history
      currentHistory = [{ path: "/", label: "Home" }];
    } else {
      const existingIndex = currentHistory.findIndex((h) => h.path === path);
      if (existingIndex !== -1) {
        // If the path already exists in history, trim history up to this point
        currentHistory = currentHistory.slice(0, existingIndex + 1);
      } else {
        // Otherwise, add the current page onto the trail
        currentHistory.push({ path, label: currentLabel });
      }
    }

    sessionStorage.setItem("breadcrumbHistory", JSON.stringify(currentHistory));
    setHistory(currentHistory);
  }, [path, router.isReady]);

  if (path === "/") return null; // Don't show on home page

  const renderBreadcrumbs = () => {
    if (history.length <= 5) {
      return history.map((crumb, index) => {
        const isLast = index === history.length - 1;
        return (
          <Breadcrumb.Item 
            active={isLast} 
            linkAs={isLast ? undefined : Link} 
            href={isLast ? undefined : crumb.path} 
            key={crumb.path}
          >
            {crumb.label}
          </Breadcrumb.Item>
        );
      });
    }

    // If more than 5, show Home > ... > [Last 3]
    const first = history[0];
    const dropItems = history.slice(1, history.length - 3);
    const lastThree = history.slice(-3);

    return (
      <>
        <Breadcrumb.Item linkAs={Link} href={first.path} key={first.path}>
          {first.label}
        </Breadcrumb.Item>
        
        <li className="breadcrumb-item d-flex align-items-center">
          <Dropdown>
            <Dropdown.Toggle 
              as="span" 
              className="text-primary fw-bold" 
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
            >
              ...
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {dropItems.map((c) => (
                <Dropdown.Item as={DropdownLink} href={c.path} key={c.path}>
                  {c.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </li>

        {lastThree.map((crumb, index) => {
          const isLast = index === lastThree.length - 1;
          return (
            <Breadcrumb.Item 
              active={isLast} 
              linkAs={isLast ? undefined : Link} 
              href={isLast ? undefined : crumb.path} 
              key={crumb.path}
            >
              {crumb.label}
            </Breadcrumb.Item>
          );
        })}
      </>
    );
  };

  // During SSR, history will be empty, render a placeholder layout so structure doesn't jump
  if (history.length === 0) {
    return (
      <Container fluid className="px-lg-4 breadcrumb-wrapper">
        <Breadcrumb className="mb-0">
          <Breadcrumb.Item active>Loading...</Breadcrumb.Item>
        </Breadcrumb>
      </Container>
    );
  }

  return (
    <Container fluid className="px-lg-4 breadcrumb-wrapper">
      <Breadcrumb className="mb-0 d-flex align-items-center">
        {renderBreadcrumbs()}
      </Breadcrumb>
    </Container>
  );
}
