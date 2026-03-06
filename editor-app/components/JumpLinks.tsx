import { useEffect, useMemo, useState } from "react";

export type JumpLinkItem = {
  id: string;
  label: string;
  children?: JumpLinkItem[];
};

type Props = {
  items: JumpLinkItem[];
  label?: string;
};

const flattenIds = (items: JumpLinkItem[]): string[] =>
  items.flatMap((item) => [item.id, ...(item.children ? flattenIds(item.children) : [])]);

const findItemById = (items: JumpLinkItem[], id: string): JumpLinkItem | undefined => {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const childMatch = findItemById(item.children, id);
      if (childMatch) return childMatch;
    }
  }
  return undefined;
};

const getActiveSection = (ids: string[]) => {
  if (typeof window === "undefined") {
    return ids[0] ?? "";
  }

  const sections = ids
    .map((id) => document.getElementById(id))
    .filter((section): section is HTMLElement => !!section);

  if (sections.length === 0) {
    return ids[0] ?? "";
  }

  const activationOffset = window.innerHeight * 0.28;
  let currentId = sections[0].id;

  for (const section of sections) {
    if (section.getBoundingClientRect().top <= activationOffset) {
      currentId = section.id;
    } else {
      break;
    }
  }

  const scrolledToBottom =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 4;

  if (scrolledToBottom) {
    currentId = sections[sections.length - 1].id;
  }

  return currentId;
};

export default function JumpLinks({
  items,
  label = "Jump to section",
}: Props) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const itemIds = useMemo(() => flattenIds(items), [items]);

  useEffect(() => {
    const updateActiveId = () => {
      const currentId = getActiveSection(itemIds);
      if (currentId) {
        setActiveId(currentId);
      }
    };

    updateActiveId();
    window.addEventListener("scroll", updateActiveId, { passive: true });
    window.addEventListener("resize", updateActiveId);
    window.addEventListener("hashchange", updateActiveId);

    return () => {
      window.removeEventListener("scroll", updateActiveId);
      window.removeEventListener("resize", updateActiveId);
      window.removeEventListener("hashchange", updateActiveId);
    };
  }, [itemIds]);

  const activeLabel =
    findItemById(items, activeId)?.label ?? items[0]?.label ?? label;

  const renderItems = (linkItems: JumpLinkItem[], depth = 0) => (
    <ul className={`doc-jump-links-list${depth > 0 ? " is-nested" : ""}`}>
      {linkItems.map((item) => {
        const isActive = item.id === activeId;
        const hasActiveChild = item.children?.some((child) => itemIds.includes(activeId) && flattenIds([child]).includes(activeId));

        return (
          <li key={item.id} className="doc-jump-links-item">
            <a
              href={`#${item.id}`}
              className={`doc-jump-links-link${isActive ? " is-active" : ""}${depth > 0 ? " is-subsection" : ""}`}
              aria-current={isActive ? "location" : undefined}
              onClick={() => {
                setActiveId(item.id);
                setMobileOpen(false);
              }}
            >
              {item.label}
            </a>
            {item.children && (isActive || hasActiveChild || depth === 0) ? renderItems(item.children, depth + 1) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="doc-jump-links" aria-label={label}>
      <button
        type="button"
        className="doc-jump-links-toggle"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className="doc-jump-links-toggle-label">{label}</span>
        <span className="doc-jump-links-toggle-value">{activeLabel}</span>
      </button>
      <nav className={`doc-jump-links-nav${mobileOpen ? " is-open" : ""}`}>
        <div className="doc-jump-links-title">{label}</div>
        {renderItems(items)}
      </nav>
    </aside>
  );
}