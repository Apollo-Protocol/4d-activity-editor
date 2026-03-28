import { useState, useEffect, useRef, useMemo, MutableRefObject, JSX, Dispatch, SetStateAction } from "react";
import { createPortal } from "react-dom";
import Breadcrumb from "react-bootstrap/Breadcrumb";
import Button from "react-bootstrap/Button";
import Draggable from "react-draggable";
import { drawActivityDiagram } from "@/diagram/DrawActivityDiagram";
import { ConfigData } from "@/diagram/config";
import { Model } from "@/lib/Model";
import { Activity, Id, Individual, Maybe, Participation } from "@/lib/Schema";
import { ENTITY_TYPE_IDS, getEntityTypeIdFromIndividual, getEntityTypeLabel } from "@/lib/entityTypes";
import { getActiveInstallationForActivity } from "@/utils/installations";
import * as d3 from "d3";

interface Props {
  dataset: Model;
  configData: ConfigData;
  setConfigData?: Dispatch<SetStateAction<ConfigData>>;
  activityContext: Maybe<Id>;
  setActivityContext: (c: Maybe<Id>) => void;
  clickIndividual: (i: Individual) => void;
  clickActivity: (a: Activity) => void;
  clickParticipation: (a: Activity, p: Participation) => void;
  rightClickIndividual: (i: Individual) => void;
  rightClickActivity: (a: Activity) => void;
  rightClickParticipation: (a: Activity, p: Participation) => void;
  svgRef: MutableRefObject<any>;
  hideNonParticipating?: boolean;
  highlightedActivityId?: string | null;
  onReorderIndividuals?: (orderedIds: string[]) => void;
  renameIndividual?: (id: string, newName: string) => void;
  collapseStateResetToken?: number;
  minimapPortalTarget?: HTMLElement | null;
}

const COLLAPSED_SYSTEMS_STORAGE_KEY = "4d-collapsed-systems";

const ActivityDiagram = (props: Props) => {
  const {
    svgRef,
    dataset,
    configData,
    activityContext,
    setActivityContext,
    clickIndividual,
    clickActivity,
    clickParticipation,
    rightClickIndividual,
    rightClickActivity,
    rightClickParticipation,
    hideNonParticipating = false,
    highlightedActivityId,
    onReorderIndividuals,
    renameIndividual,
    collapseStateResetToken = 0,
    minimapPortalTarget,
  } = props;

  const [plot, setPlot] = useState({
    width: 0,
    height: 0,
  });

  const [interactionMode, setInteractionMode] = useState<"pointer" | "zoom">("pointer");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [themeAttribute, setThemeAttribute] = useState<string>(() =>
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-bs-theme") || ""
      : ""
  );

  const searchHighlightTimerRef = useRef<number | null>(null);

  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editingEntityName, setEditingEntityName] = useState("");
  const [highlightedSearchIndex, setHighlightedSearchIndex] = useState(-1);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const searchDragRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440
  );

  const getResponsiveDefaultMinimapScale = () => (viewportWidth <= 1599 ? 0.75 : 1);

  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomTransformRef = useRef(d3.zoomIdentity);

  const [collapsedSystems, setCollapsedSystems] = useState<Set<string>>(new Set());
  const [hasRestoredCollapsedSystems, setHasRestoredCollapsedSystems] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [minimapScale, setMinimapScale] = useState(() => getResponsiveDefaultMinimapScale());
  const [minimapPos, setMinimapPos] = useState<{ left: number; top: number } | null>(null);
  const [minimapHoveredEntityId, setMinimapHoveredEntityId] = useState<string | null>(null);
  const minimapRef = useRef<SVGSVGElement>(null);
  const minimapViewportRef = useRef<SVGRectElement>(null);
  const updateMinimapViewportRef = useRef<(() => void) | null>(null);
  const minimapDragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
  const minimapLensRef = useRef<HTMLDivElement>(null);
  const minimapLensSvgRef = useRef<SVGSVGElement>(null);

  const systemsWithComponents = useMemo(() => {
    return Array.from(dataset.individuals.values()).filter((ind) => {
      if (getEntityTypeIdFromIndividual(ind) !== ENTITY_TYPE_IDS.SYSTEM) return false;
      return Array.from(dataset.individuals.values()).some(
        (c) =>
          c.installedIn === ind.id &&
          getEntityTypeIdFromIndividual(c) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT
      );
    });
  }, [dataset]);

  const resolveVisibleEntityId = (entityId: string): string => {
    const entity = dataset.individuals.get(entityId);
    if (!entity) return entityId;

    if (
      getEntityTypeIdFromIndividual(entity) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT &&
      entity.installedIn &&
      collapsedSystems.has(entity.installedIn)
    ) {
      return entity.installedIn;
    }

    return entityId;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = sessionStorage.getItem(COLLAPSED_SYSTEMS_STORAGE_KEY);
      if (stored) {
        setCollapsedSystems(new Set<string>(JSON.parse(stored)));
      }
    } catch {
      // ignore storage errors
    } finally {
      setHasRestoredCollapsedSystems(true);
    }
  }, []);

  useEffect(() => {
    if (!hasRestoredCollapsedSystems) return;
    try {
      sessionStorage.setItem(
        COLLAPSED_SYSTEMS_STORAGE_KEY,
        JSON.stringify(Array.from(collapsedSystems))
      );
    } catch {
      // ignore storage errors
    }
  }, [collapsedSystems, hasRestoredCollapsedSystems]);

  // Prune any stored collapsed IDs that no longer exist in the current dataset.
  // Skip when systemsWithComponents is empty — that means the dataset hasn't
  // loaded yet and pruning would incorrectly wipe the restored collapse state.
  useEffect(() => {
    if (!hasRestoredCollapsedSystems) return;
    if (systemsWithComponents.length === 0) return;
    const validIds = new Set(systemsWithComponents.map((s) => s.id));
    setCollapsedSystems((prev) => {
      const pruned = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [systemsWithComponents, hasRestoredCollapsedSystems]);

  const prevCollapseResetTokenRef = useRef(collapseStateResetToken);
  useEffect(() => {
    if (prevCollapseResetTokenRef.current === collapseStateResetToken) return;
    prevCollapseResetTokenRef.current = collapseStateResetToken;

    setCollapsedSystems(new Set());
    try {
      sessionStorage.removeItem(COLLAPSED_SYSTEMS_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, [collapseStateResetToken]);

  const responsiveDefaultMinimapScale = getResponsiveDefaultMinimapScale();
  const previousResponsiveMinimapScaleRef = useRef(responsiveDefaultMinimapScale);
  useEffect(() => {
    setMinimapScale((current) => {
      const previousResponsiveScale = previousResponsiveMinimapScaleRef.current;
      previousResponsiveMinimapScaleRef.current = responsiveDefaultMinimapScale;
      return current === previousResponsiveScale ? responsiveDefaultMinimapScale : current;
    });
  }, [responsiveDefaultMinimapScale]);

  const isMobileLegendLayout = viewportWidth <= 767.98;

  const searchableEntities = useMemo(() => {
    return Array.from(dataset.individuals.values())
      .map((individual) => ({
        id: individual.id,
        name: individual.name,
        typeLabel: getEntityTypeLabel(individual.type, individual.installedIn, individual.entityType),
      }));
  }, [dataset]);

  const filteredSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return searchableEntities;

    return searchableEntities
      .filter(
        (entity) =>
          entity.name.toLowerCase().includes(query) ||
          
          entity.typeLabel.toLowerCase().includes(query)
      )
      .slice(0, 20);
  }, [searchableEntities, searchQuery]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedSearchIndex(-1);
  }, [filteredSearchResults]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setThemeAttribute(root.getAttribute("data-bs-theme") || "");
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-bs-theme"],
    });

    setThemeAttribute(root.getAttribute("data-bs-theme") || "");

    return () => observer.disconnect();
  }, []);

  const clearSearchHighlight = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll(".individual").classed("search-result-highlight", false);
    svg.selectAll(".individualLabel").classed("search-result-highlight", false);
    svg.selectAll(".installHatch").classed("search-result-highlight", false);
    svg.selectAll(".installConnectorRibbon").classed("search-result-highlight", false);
  };

  const focusEntityFromSearch = (entityId: string) => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const visibleEntityId = resolveVisibleEntityId(entityId);
    const rowNode = svg.select(`#i${visibleEntityId}`).node() as SVGGraphicsElement | null;
    if (!rowNode) return;

    const scrollContainer = document.getElementById("activity-diagram-scrollable-div");
    if (scrollContainer) {
      const rowRect = rowNode.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const rowTopInContainer = rowRect.top - containerRect.top + scrollContainer.scrollTop;
      const rowPixelHeight = rowRect.height;
      const targetTop = Math.max(0, rowTopInContainer - scrollContainer.clientHeight / 2 + rowPixelHeight / 2);
      scrollContainer.scrollTo({
        top: targetTop,
        behavior: "smooth",
      });
    }

    clearSearchHighlight();

    svg.select(`#i${visibleEntityId}`).classed("search-result-highlight", true);
    svg.select(`#il${visibleEntityId}`).classed("search-result-highlight", true);

    const entity = dataset.individuals.get(entityId);
    const entityType = entity ? getEntityTypeIdFromIndividual(entity) : null;
    const isSystemComponent = entityType === ENTITY_TYPE_IDS.SYSTEM_COMPONENT;
    const highlightEntityIds = new Set([entityId, visibleEntityId]);

    svg.selectAll(".installHatch").each(function () {
      const el = this as Element;
      if (
        highlightEntityIds.has(el.getAttribute("data-installed-id") ?? "") ||
        highlightEntityIds.has(el.getAttribute("data-target-id") ?? "")
      ) {
        d3.select(el).classed("search-result-highlight", true);
      }
    });
    if (!isSystemComponent || visibleEntityId !== entityId) {
      svg.selectAll(".installConnectorRibbon").each(function () {
        const el = this as Element;
        if (
          highlightEntityIds.has(el.getAttribute("data-installed-id") ?? "") ||
          highlightEntityIds.has(el.getAttribute("data-target-id") ?? "")
        ) {
          d3.select(el).classed("search-result-highlight", true);
        }
      });
    }

    if (searchHighlightTimerRef.current !== null) {
      window.clearTimeout(searchHighlightTimerRef.current);
    }

    searchHighlightTimerRef.current = window.setTimeout(() => {
      clearSearchHighlight();
      searchHighlightTimerRef.current = null;
    }, 2000);
  };

  const renderConfig: ConfigData = {
    ...configData,
    viewPort: {
      ...configData.viewPort,
      zoom: 1,
    },
  };

  useEffect(() => {
    setPlot(
      drawActivityDiagram(
        dataset,
        renderConfig,
        activityContext,
        svgRef.current,
        clickIndividual,
        clickActivity,
        clickParticipation,
        rightClickIndividual,
        rightClickActivity,
        rightClickParticipation,
        hideNonParticipating,
        collapsedSystems
      )
    );
  }, [
    dataset,
    configData,
    activityContext,
    themeAttribute,
    svgRef,
    clickIndividual,
    clickActivity,
    clickParticipation,
    rightClickIndividual,
    rightClickActivity,
    rightClickParticipation,
    hideNonParticipating,
    collapsedSystems,
  ]);

  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .select("#activity-diagram-group")
      .attr("transform", zoomTransformRef.current.toString());
  }, [plot, svgRef]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    svg.on(".zoom", null);

    if (interactionMode === "zoom") {
      const zoomBehavior = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 4])
        .on("zoom", (event) => {
          svg
            .select("#activity-diagram-group")
            .attr("transform", event.transform.toString());
          zoomTransformRef.current = event.transform;
          updateMinimapViewportRef.current?.();
        });

      zoomRef.current = zoomBehavior;
      svg.call(zoomBehavior);
      svg.call(zoomBehavior.transform, zoomTransformRef.current);
    }
  }, [plot, svgRef, interactionMode]);

  // Attach right-click collapse/expand on system rows that have components
  useEffect(() => {
    if (!svgRef.current || plot.width === 0) return;
    const svg = d3.select(svgRef.current);
    // Remove any leftover chevron toggles
    svg.select("#activity-diagram-group").selectAll(".system-collapse-toggle").remove();

    const systemIds = new Set(systemsWithComponents.map((s) => s.id));

    systemsWithComponents.forEach((system) => {
      const handler = (event: any) => {
        event.preventDefault();
        event.stopPropagation();
        setCollapsedSystems((prev) => {
          const next = new Set(prev);
          if (next.has(system.id)) next.delete(system.id);
          else next.add(system.id);
          return next;
        });
      };
      svg.select(`#i${system.id}`).on("contextmenu.collapse", handler);
      svg.select(`#il${system.id}`).on("contextmenu.collapse", handler);
    });

    return () => {
      systemsWithComponents.forEach((system) => {
        svg.select(`#i${system.id}`).on("contextmenu.collapse", null);
        svg.select(`#il${system.id}`).on("contextmenu.collapse", null);
      });
    };
  }, [plot, dataset, collapsedSystems, systemsWithComponents, svgRef]);

  useEffect(() => {
    if (!svgRef.current || plot.width === 0) return;
    const svg = d3.select(svgRef.current);

    svg.selectAll(".system-collapsed-highlight").classed("system-collapsed-highlight", false);

    systemsWithComponents.forEach((system) => {
      if (!collapsedSystems.has(system.id)) return;
      svg.select(`#i${system.id}`).classed("system-collapsed-highlight", true);
      svg.select(`#il${system.id}`).classed("system-collapsed-highlight", true);
    });
  }, [plot, collapsedSystems, systemsWithComponents, svgRef]);

  // Clone diagram content into minimap
  useEffect(() => {
    if (!svgRef.current || !minimapRef.current || !showMinimap) return;
    if (plot.width === 0 || plot.height === 0) return;

    const mainGroup = d3
      .select(svgRef.current)
      .select("#activity-diagram-group")
      .node() as SVGGElement | null;
    if (!mainGroup) return;

    const minimapSvg = d3.select(minimapRef.current);
    minimapSvg.selectAll("*").remove();

    const clone = mainGroup.cloneNode(true) as SVGGElement;
    clone.removeAttribute("transform");
    clone.id = "minimap-content";
    d3.select(clone).selectAll(".system-collapse-toggle").remove();
    minimapRef.current.appendChild(clone);

    minimapSvg
      .append("rect")
      .attr("class", "diagram-minimap-viewport")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", plot.width)
      .attr("height", plot.height)
      .attr("rx", 2);

    minimapViewportRef.current = minimapSvg
      .select<SVGRectElement>(".diagram-minimap-viewport")
      .node();
  }, [plot, showMinimap, svgRef, collapsedSystems, isMobileLegendLayout, minimapPortalTarget, viewportWidth]);

  // Track scroll / zoom and update minimap viewport rectangle
  useEffect(() => {
    if (!showMinimap) return;
    const scrollContainer = document.getElementById(
      "activity-diagram-scrollable-div"
    );
    if (!scrollContainer || !svgRef.current) return;

    const update = () => {
      const vpRect = minimapViewportRef.current;
      if (!vpRect || plot.width === 0 || plot.height === 0) return;
      const svgEl = svgRef.current!;
      const svgRect = svgEl.getBoundingClientRect();
      if (svgRect.width === 0) return;
      const pixelScale = svgRect.width / plot.width;
      const t = zoomTransformRef.current;
      const svgLeft = scrollContainer.scrollLeft / pixelScale;
      const svgTop = scrollContainer.scrollTop / pixelScale;
      const svgW = scrollContainer.clientWidth / pixelScale;
      const svgH = scrollContainer.clientHeight / pixelScale;
      const dLeft = (svgLeft - t.x) / t.k;
      const dTop = (svgTop - t.y) / t.k;
      const dW = svgW / t.k;
      const dH = svgH / t.k;
      vpRect.setAttribute("x", String(Math.max(0, dLeft)));
      vpRect.setAttribute("y", String(Math.max(0, dTop)));
      vpRect.setAttribute(
        "width",
        String(Math.min(plot.width - Math.max(0, dLeft), dW))
      );
      vpRect.setAttribute(
        "height",
        String(Math.min(plot.height - Math.max(0, dTop), dH))
      );
    };

    updateMinimapViewportRef.current = update;
    scrollContainer.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    return () => {
      scrollContainer.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      updateMinimapViewportRef.current = null;
    };
  }, [plot, showMinimap, svgRef, isMobileLegendLayout, minimapPortalTarget, viewportWidth]);

  useEffect(() => {
    if (!showMinimap) return;
    const timer = window.setTimeout(() => {
      updateMinimapViewportRef.current?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showMinimap, isMobileLegendLayout, minimapPortalTarget, viewportWidth]);

  // Apply highlighting when highlightedActivityId changes
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    if (highlightedActivityId) {
      // Dim all activities and participations
      svg.selectAll(".activity").attr("opacity", 0.15);
      svg.selectAll(".participation").attr("opacity", 0.1);
      svg.selectAll(".activityLabel").attr("opacity", 0.2);

      // Highlight the selected activity
      svg.select(`#a${highlightedActivityId}`)
        .attr("opacity", 1)
        .attr("stroke-width", "2.5px")
        .attr("stroke-dasharray", "none");
      svg.select(`#al${highlightedActivityId}`)
        .attr("opacity", 1);

      // Highlight participations belonging to the selected activity
      svg.selectAll(".participation")
        .filter(function () {
          const id = (this as SVGElement).getAttribute("id") || "";
          return id.startsWith(`p${highlightedActivityId}`);
        })
        .attr("opacity", 0.8);
    } else {
      // Reset all to default
      svg.selectAll(".activity")
        .attr("opacity", configData.presentation.activity.opacity)
        .attr("stroke-width", configData.presentation.activity.strokeWidth)
        .attr("stroke-dasharray", configData.presentation.activity.strokeDasharray);
      svg.selectAll(".participation").attr("opacity", configData.presentation.participation.opacity);
      svg.selectAll(".activityLabel").attr("opacity", 1);
    }
  }, [highlightedActivityId, plot, configData, svgRef]);

  useEffect(() => {
    if (!svgRef.current || !onReorderIndividuals || interactionMode !== "pointer") {
      return;
    }

    const svg = d3.select(svgRef.current);
    const rowSelection = svg.selectAll<SVGPathElement, Individual>(".individual");
    const tooltipSelection = d3.select("#tooltip");

    if (rowSelection.empty()) return;

    const updateTooltipDuringDrag = (sourceEvent: any) => {
      if (tooltipSelection.empty()) {
        return;
      }

      if (tooltipSelection.style("display") === "none") {
        return;
      }

      const pointerEvent = sourceEvent as MouseEvent | undefined;
      if (!pointerEvent || pointerEvent.pageX == null || pointerEvent.pageY == null) {
        return;
      }

      if (pointerEvent.pageX < window.innerWidth / 2) {
        tooltipSelection
          .style("top", pointerEvent.pageY + 20 + "px")
          .style("left", pointerEvent.pageX + "px");
      } else {
        const ttNode = tooltipSelection.node() as HTMLElement | null;
        const ttWidth = ttNode?.getBoundingClientRect().width ?? 0;
        tooltipSelection
          .style("top", pointerEvent.pageY + 20 + "px")
          .style("left", pointerEvent.pageX - ttWidth + "px");
      }
    };

    // ── Helpers for system grouping ──
    const isNestedComponent = (ind: Individual | undefined): boolean => {
      if (!ind) return false;
      if (getEntityTypeIdFromIndividual(ind) !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) return false;
      if (!ind.installedIn) return false;
      const host = dataset.individuals.get(ind.installedIn);
      return !!host && getEntityTypeIdFromIndividual(host) === ENTITY_TYPE_IDS.SYSTEM;
    };

    const getComponentIdsForSystem = (systemId: string): string[] => {
      return Array.from(dataset.individuals.values())
        .filter(
          (ind) =>
            ind.installedIn === systemId &&
            getEntityTypeIdFromIndividual(ind) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT
        )
        .map((ind) => ind.id);
    };

    const canReorderIndividuals = (
      activeItem: Individual | undefined,
      overItem: Individual | undefined
    ) => {
      if (!activeItem || !overItem) return false;

      const activeType = getEntityTypeIdFromIndividual(activeItem);
      if (activeType !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        return true;
      }

      const overType = getEntityTypeIdFromIndividual(overItem);
      if (overType === ENTITY_TYPE_IDS.SYSTEM) {
        return !!activeItem.installedIn && activeItem.installedIn === overItem.id;
      }

      if (overType !== ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
        return false;
      }

      return (
        !!activeItem.installedIn && activeItem.installedIn === overItem.installedIn
      );
    };

    const getClosestTargetRow = (
      rows: Array<{ id: string; centerY: number; node: SVGPathElement }>,
      draggedId: string,
      draggedCenter: number
    ) => {
      let closestRow: { id: string; centerY: number; node: SVGPathElement } | null =
        null;
      let closestDist = Infinity;

      for (const row of rows) {
        if (row.id === draggedId) continue;
        const dist = Math.abs(draggedCenter - row.centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closestRow = row;
        }
      }

      return closestRow;
    };

    const updateLinkedLabel = (entityId: string, offset: number) => {
      svg.select(`#il${entityId}`).attr("transform", `translate(0, ${offset})`);
    };

    const updateLinkedHatches = (entityId: string, offset: number) => {
      const t = offset === 0 ? null : `translate(0, ${offset})`;
      // Hatches are drawn ON the target component, so only move them
      // when the target component moves (not when the installed individual moves).
      // The hatches use clip-path with userSpaceOnUse, which doesn't follow
      // the element's transform, so we temporarily remove clip-path during drag
      // and restore it when the transform is cleared.
      svg
        .selectAll<SVGRectElement, unknown>(".installHatch")
        .filter(function () {
          return (this as SVGElement).getAttribute("data-target-id") === entityId;
        })
        .each(function () {
          const el = this as SVGElement;
          if (offset !== 0) {
            const cp = el.getAttribute("clip-path");
            if (cp) el.setAttribute("data-saved-clip", cp);
            el.removeAttribute("clip-path");
          } else {
            const saved = el.getAttribute("data-saved-clip");
            if (saved) {
              el.setAttribute("clip-path", saved);
              el.removeAttribute("data-saved-clip");
            }
          }
        })
        .attr("transform", t);
    };

    /** Read the current Y translate offset from an element's transform attribute */
    const getElementOffset = (id: string): number => {
      const el = svg.select(`#i${id}`).node() as SVGElement | null;
      if (!el) return 0;
      const t = el.getAttribute("transform");
      if (!t) return 0;
      const m = t.match(/translate\(\s*[\d.eE+-]+\s*,\s*([\d.eE+-]+)\s*\)/);
      return m ? Number(m[1]) : 0;
    };

    const updateLinkedRibbons = (entityId: string, offset: number) => {
      svg
        .selectAll<SVGPathElement, unknown>(".installConnectorRibbon")
        .filter(function () {
          const node = this as SVGElement;
          const installedId = node.getAttribute("data-installed-id");
          const targetId = node.getAttribute("data-target-id");
          return installedId === entityId || targetId === entityId;
        })
        .attr("d", function () {
          const node = this as SVGElement;
          const installedId = node.getAttribute("data-installed-id");
          const targetId = node.getAttribute("data-target-id");
          const kind = node.getAttribute("data-ribbon-kind");

          const mainX = Number(node.getAttribute("data-main-x") ?? "0");
          const sideX = Number(node.getAttribute("data-side-x") ?? "0");
          const lowerTopBase = Number(node.getAttribute("data-lower-top") ?? "0");
          const lowerBottomBase = Number(node.getAttribute("data-lower-bottom") ?? "0");
          const upperTopBase = Number(node.getAttribute("data-upper-top") ?? "0");
          const upperBottomBase = Number(node.getAttribute("data-upper-bottom") ?? "0");

          // For the endpoint being explicitly moved, use the passed offset.
          // For the OTHER endpoint, read its current transform from the DOM.
          const lowerShift = installedId === entityId ? offset : getElementOffset(installedId!);
          const upperShift = targetId === entityId ? offset : getElementOffset(targetId!);
          const lowerTop = lowerTopBase + lowerShift;
          const lowerBottom = lowerBottomBase + lowerShift;
          const upperTop = upperTopBase + upperShift;
          const upperBottom = upperBottomBase + upperShift;

          if (kind === "start") {
            return `M ${sideX} ${lowerTop}
L ${sideX} ${lowerBottom}
L ${mainX} ${upperBottom}
L ${mainX} ${upperTop} Z`;
          }

          return `M ${mainX} ${upperTop}
L ${mainX} ${upperBottom}
L ${sideX} ${lowerBottom}
L ${sideX} ${lowerTop} Z`;
        });
    };

    const updateLinkedParticipations = (entityId: string, offset: number) => {
      const t = offset === 0 ? null : `translate(0, ${offset})`;
      svg
        .selectAll<SVGRectElement, unknown>(".participation")
        .filter(function () {
          return (this as SVGElement).getAttribute("data-row-id") === entityId;
        })
        .attr("transform", t);
    };

    interface ActivityBoundsSnapshot {
      y: number;
      height: number;
    }

    let activityBoundsSnapshot = new Map<string, ActivityBoundsSnapshot>();

    const snapshotActivityBounds = () => {
      activityBoundsSnapshot = new Map();
      svg.selectAll<SVGRectElement, unknown>(".activity").each(function () {
        const activityNode = this as SVGRectElement;
        activityBoundsSnapshot.set(activityNode.id.substring(1), {
          y: Number(activityNode.getAttribute("y") ?? "0"),
          height: Number(activityNode.getAttribute("height") ?? "0"),
        });
      });
    };

    const restoreActivityBounds = () => {
      svg.selectAll<SVGRectElement, unknown>(".activity").each(function () {
        const activityNode = this as SVGRectElement;
        const baseBounds = activityBoundsSnapshot.get(activityNode.id.substring(1));
        if (!baseBounds) return;

        d3.select(activityNode)
          .attr("y", baseBounds.y)
          .attr("height", baseBounds.height);
      });
    };

    const resolvePreviewActivityRowId = (
      activity: Activity,
      individual: Individual
    ) => {
      const activeInstallation = getActiveInstallationForActivity(individual, activity);
      const installedTarget = activeInstallation
        ? dataset.individuals.get(activeInstallation.systemComponentId)
        : individual.installedIn
        ? dataset.individuals.get(individual.installedIn)
        : undefined;
      const isInstalledInComponent =
        !!installedTarget &&
        getEntityTypeIdFromIndividual(installedTarget) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT;

      if (!isInstalledInComponent) {
        return individual.id;
      }

      if (!activeInstallation) {
        return individual.id;
      }

      const installedSystem = installedTarget.installedIn
        ? dataset.individuals.get(installedTarget.installedIn)
        : undefined;
      const isInstalledInSystem =
        !!installedSystem &&
        getEntityTypeIdFromIndividual(installedSystem) === ENTITY_TYPE_IDS.SYSTEM;

      return isInstalledInSystem ? installedSystem.id : installedTarget.id;
    };

    const getPreviewRowBounds = (rowId: string) => {
      const rowNode = svg.select(`#i${rowId}`).node() as SVGGraphicsElement | null;
      if (!rowNode) {
        return null;
      }

      const bbox = rowNode.getBBox();
      const rowYAttr = Number(rowNode.getAttribute("data-row-y") ?? "NaN");
      const baseTop = Number.isFinite(rowYAttr) ? rowYAttr : bbox.y;
      const offset = entityOffsets.get(rowId) ?? getElementOffset(rowId);

      return {
        top: baseTop + offset,
        bottom: baseTop + offset + bbox.height,
      };
    };

    const updateLinkedActivities = () => {
      svg.selectAll<SVGRectElement, unknown>(".activity").each(function () {
        const activityNode = this as SVGRectElement;
        const activityId = activityNode.id.substring(1); // remove 'a'
        const baseBounds = activityBoundsSnapshot.get(activityId) ?? {
          y: Number(activityNode.getAttribute("y") ?? "0"),
          height: Number(activityNode.getAttribute("height") ?? "0"),
        };
        const activity = dataset.activities.get(activityId);
        
        let minTop = Infinity;
        let maxBottom = -Infinity;
        
        activity?.participations?.forEach((participation) => {
          const individual = dataset.individuals.get(participation.individualId);
          if (!individual) {
            return;
          }

          const rowId = resolvePreviewActivityRowId(activity, individual);
          const rowBounds = getPreviewRowBounds(rowId);
          if (!rowBounds) {
            return;
          }

          if (rowBounds.top < minTop) minTop = rowBounds.top;
          if (rowBounds.bottom > maxBottom) maxBottom = rowBounds.bottom;
        });
          
        if (minTop === Infinity || maxBottom === -Infinity) {
          d3.select(activityNode)
            .attr("y", baseBounds.y)
            .attr("height", baseBounds.height);
          return;
        }

        const gap = configData.layout.individual.gap;
        const previewTop = minTop - gap * 0.3;
        const previewBottom = maxBottom + gap * 0.3;

        d3.select(activityNode)
          .attr("y", previewTop)
          .attr("height", Math.max(0, previewBottom - previewTop));
      });
    };

    // ── Snapshot types ──
    // Top-level snapshot: systems are treated as groups (system + its components).
    // Nested system components are NOT separate entries in topLevelSnapshot;
    // they are tracked via componentIds on their parent system entry.
    interface RowSnapshot {
      id: string;
      y: number;
      height: number;          // full group height (for systems this includes components)
      node: SVGPathElement;
      componentIds: string[];  // child component IDs (non-empty only for systems)
      parentSystemId?: string; // set only for nested system components
    }
    let dragSnapshot: RowSnapshot[] = [];          // ALL rows (including nested components)
    let topLevelSnapshot: RowSnapshot[] = [];      // only top-level rows (systems as groups)
    let entityOffsets = new Map<string, number>();   // intended Y offset per entity (avoids reading mid-transition DOM)

    // ── Shift helpers ──
    const shiftElement = (id: string, dy: number, animate: boolean) => {
      entityOffsets.set(id, dy);
      const t = dy === 0 ? null : `translate(0, ${dy})`;
      if (animate) {
        svg.select(`#i${id}`).transition().duration(50).attr("transform", t);
        svg.select(`#il${id}`).transition().duration(50).attr("transform", t);
        svg
          .selectAll<SVGPathElement, unknown>(".installDash")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-individual-id") === id;
          })
          .transition()
          .duration(50)
          .attr("transform", t);
        svg
          .selectAll<SVGRectElement, unknown>(".participation")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-row-id") === id;
          })
          .transition()
          .duration(50)
          .attr("transform", t);
      } else {
        svg.select(`#i${id}`).attr("transform", t);
        svg.select(`#il${id}`).attr("transform", t);
        svg
          .selectAll<SVGPathElement, unknown>(".installDash")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-individual-id") === id;
          })
          .attr("transform", t);
        svg
          .selectAll<SVGRectElement, unknown>(".participation")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-row-id") === id;
          })
          .attr("transform", t);
      }
      updateLinkedHatches(id, dy);
      updateLinkedRibbons(id, dy);
      
      // We need to update activities after the transition starts, but for simplicity
      // we can just update them immediately. The transition might make it look slightly out of sync,
      // but it's better than not updating.
      updateLinkedActivities();
    };

    /** Shift a top-level row and, if it's a system, all its components */
    const shiftGroup = (snap: RowSnapshot, dy: number, animate = true) => {
      shiftElement(snap.id, dy, animate);
      snap.componentIds.forEach((cid) => shiftElement(cid, dy, animate));
    };

    const clearAllPreviewShifts = () => {
      // First pass: reset all element transforms
      dragSnapshot.forEach((snap) => {
        svg.select(`#i${snap.id}`).interrupt().attr("transform", null);
        svg.select(`#il${snap.id}`).interrupt().attr("transform", null);
        svg
          .selectAll<SVGPathElement, unknown>(".installDash")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-individual-id") === snap.id;
          })
          .interrupt()
          .attr("transform", null);
        svg
          .selectAll<SVGRectElement, unknown>(".participation")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-row-id") === snap.id;
          })
          .interrupt()
          .attr("transform", null);
        updateLinkedHatches(snap.id, 0);
      });
      // Second pass: reset all ribbon paths (after all transforms are cleared,
      // so getElementOffset returns 0 for all endpoints)
      dragSnapshot.forEach((snap) => {
        updateLinkedRibbons(snap.id, 0);
      });
      // Third pass: clear offset tracking and restore activity bounds
      entityOffsets.clear();
      restoreActivityBounds();
    };

    // ── Auto-scroll during drag ──
    const scrollContainer = document.getElementById("activity-diagram-scrollable-div");
    const AUTO_SCROLL_EDGE = 40;   // px from edge to trigger
    const AUTO_SCROLL_SPEED = 8;   // px per frame
    let autoScrollRAF: number | null = null;

    const autoScrollDuringDrag = (clientY: number) => {
      if (autoScrollRAF) cancelAnimationFrame(autoScrollRAF);
      if (!scrollContainer) return;
      const rect = scrollContainer.getBoundingClientRect();
      const distFromTop = clientY - rect.top;
      const distFromBottom = rect.bottom - clientY;

      const step = () => {
        if (!scrollContainer) return;
        const r = scrollContainer.getBoundingClientRect();
        const dTop = clientY - r.top;
        const dBot = r.bottom - clientY;
        if (dTop < AUTO_SCROLL_EDGE && scrollContainer.scrollTop > 0) {
          scrollContainer.scrollTop -= AUTO_SCROLL_SPEED;
          autoScrollRAF = requestAnimationFrame(step);
        } else if (dBot < AUTO_SCROLL_EDGE && scrollContainer.scrollTop < scrollContainer.scrollHeight - scrollContainer.clientHeight) {
          scrollContainer.scrollTop += AUTO_SCROLL_SPEED;
          autoScrollRAF = requestAnimationFrame(step);
        } else {
          autoScrollRAF = null;
        }
      };

      if (distFromTop < AUTO_SCROLL_EDGE || distFromBottom < AUTO_SCROLL_EDGE) {
        autoScrollRAF = requestAnimationFrame(step);
      }
    };

    const stopAutoScroll = () => {
      if (autoScrollRAF) {
        cancelAnimationFrame(autoScrollRAF);
        autoScrollRAF = null;
      }
    };

    // ── Drag behavior ──

    // Helper: raise a single entity's bar, label, dashes, hatches, and ribbons
    const raiseEntityVisuals = (id: string) => {
      svg.select(`#i${id}`).raise();
      svg.select(`#il${id}`).raise();
      svg
        .selectAll<SVGPathElement, unknown>(".installDash")
        .filter(function () {
          return (this as SVGElement).getAttribute("data-individual-id") === id;
        })
        .raise();
      svg
        .selectAll<SVGRectElement, unknown>(".installHatch")
        .filter(function () {
          return (this as SVGElement).getAttribute("data-target-id") === id;
        })
        .raise();
      svg
        .selectAll<SVGPathElement, unknown>(".installConnectorRibbon")
        .filter(function () {
          const node = this as SVGElement;
          return node.getAttribute("data-installed-id") === id
            || node.getAttribute("data-target-id") === id;
        })
        .raise();
      // Raise activities and participations so they stay on top
      svg.selectAll(".activity").raise();
      svg.selectAll(".participation").raise();
    };

    const DRAG_ACTIVATION_DISTANCE = 6;

    const getDragRowSelection = (
      node: SVGGraphicsElement,
      individualId: string
    ) => {
      const nodeId = node.getAttribute("id") ?? "";
      if (nodeId === `i${individualId}`) {
        return d3.select(node as SVGPathElement);
      }
      return svg.select<SVGPathElement>(`#i${individualId}`);
    };

    const dragBehavior = d3
      .drag<SVGGraphicsElement, Individual>()
      .clickDistance(4)
      .on("start", function (event, draggedIndividual) {
        const draggedSelection = getDragRowSelection(this, draggedIndividual.id);
        if (draggedSelection.empty()) return;

        updateTooltipDuringDrag(event.sourceEvent);

        snapshotActivityBounds();

        // Build full snapshot of every .individual element
        dragSnapshot = svg
          .selectAll<SVGPathElement, Individual>(".individual")
          .nodes()
          .map((node) => {
            const id = (node.getAttribute("id") ?? "").replace(/^i/, "");
            const y = Number(node.getAttribute("data-row-y") ?? "0");
            const bbox = node.getBBox();
            const ind = dataset.individuals.get(id);
            const cIds = ind && getEntityTypeIdFromIndividual(ind) === ENTITY_TYPE_IDS.SYSTEM
              ? getComponentIdsForSystem(id) : [];
            const parentSysId = ind && isNestedComponent(ind) ? ind.installedIn : undefined;
            return { id, y, height: bbox.height, node, componentIds: cIds, parentSystemId: parentSysId };
          })
          .filter((r) => r.id.length > 0)
          .sort((a, b) => a.y - b.y);

        // Build top-level snapshot (exclude nested system components)
        topLevelSnapshot = dragSnapshot.filter((r) => !r.parentSystemId);

        draggedSelection
          .attr("data-drag-offset", "0")
          .attr("data-total-drag", "0")
          .attr("data-was-dragged", "0")
          .attr("data-raised", "0")
          .style("cursor", "default");
      })
      .on("drag", function (event, draggedIndividual) {
        const draggedSelection = getDragRowSelection(this, draggedIndividual.id);
        if (draggedSelection.empty()) return;

        updateTooltipDuringDrag(event.sourceEvent);

        const accumulatedDrag =
          Number(draggedSelection.attr("data-total-drag") ?? "0") +
          Math.abs(event.dy);
        draggedSelection.attr("data-total-drag", String(accumulatedDrag));

        const dragActivated =
          draggedSelection.attr("data-was-dragged") === "1" ||
          accumulatedDrag >= DRAG_ACTIVATION_DISTANCE;
        if (!dragActivated) {
          return;
        }

        draggedSelection.attr("data-was-dragged", "1");

        const currentOffset = Number(draggedSelection.attr("data-drag-offset") ?? "0");
        const nextOffset = currentOffset + event.dy;
        const draggedType = getEntityTypeIdFromIndividual(draggedIndividual);
        const isSystem = draggedType === ENTITY_TYPE_IDS.SYSTEM;
        const isDraggedComponent = isNestedComponent(draggedIndividual);

        // Raise dragged element above everything on the first actual movement
        if (draggedSelection.attr("data-raised") === "0") {
          draggedSelection.attr("data-raised", "1");
          raiseEntityVisuals(draggedIndividual.id);
          if (isSystem) {
            const compIds = getComponentIdsForSystem(draggedIndividual.id);
            compIds.forEach((cid) => raiseEntityVisuals(cid));
          }
        }

        draggedSelection
          .attr("data-drag-offset", String(nextOffset))
          .attr("transform", `translate(0, ${nextOffset})`);

        // Auto-scroll when near the edges of the scroll container
        autoScrollDuringDrag(event.sourceEvent.clientY);

        updateLinkedLabel(draggedIndividual.id, nextOffset);
        svg
          .selectAll<SVGPathElement, unknown>(".installDash")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-individual-id") === draggedIndividual.id;
          })
          .attr("transform", `translate(0, ${nextOffset})`);
        updateLinkedHatches(draggedIndividual.id, nextOffset);
        updateLinkedRibbons(draggedIndividual.id, nextOffset);
        updateLinkedParticipations(draggedIndividual.id, nextOffset);
        entityOffsets.set(draggedIndividual.id, nextOffset);

        // If dragging a system, also move its components
        if (isSystem) {
          const compIds = getComponentIdsForSystem(draggedIndividual.id);
          compIds.forEach((cid) => {
            entityOffsets.set(cid, nextOffset);
            svg.select(`#i${cid}`).attr("transform", `translate(0, ${nextOffset})`);
            updateLinkedLabel(cid, nextOffset);
            svg
              .selectAll<SVGPathElement, unknown>(".installDash")
              .filter(function () {
                return (this as SVGElement).getAttribute("data-individual-id") === cid;
              })
              .attr("transform", `translate(0, ${nextOffset})`);
            updateLinkedHatches(cid, nextOffset);
            updateLinkedRibbons(cid, nextOffset);
            updateLinkedParticipations(cid, nextOffset);
          });
        }
        
        updateLinkedActivities();

        // ── Choose working set based on what's being dragged ──
        if (isDraggedComponent) {
          // --- SYSTEM COMPONENT DRAG (within its parent system) ---
          const parentId = draggedIndividual.installedIn!;
          // Only consider sibling components for reorder
          const siblingSnaps = dragSnapshot
            .filter((r) => r.parentSystemId === parentId)
            .sort((a, b) => a.y - b.y);

          const draggedSnap = siblingSnaps.find((r) => r.id === draggedIndividual.id);
          if (!draggedSnap) return;

          const draggedCenter = draggedSnap.y + draggedSnap.height / 2 + nextOffset;
          const siblings = siblingSnaps.filter((r) => r.id !== draggedIndividual.id);

          // Check validity globally to show red indicator if dragged out of host
          const closestRow = getClosestTargetRow(
            dragSnapshot.map((s) => ({
              id: s.id,
              centerY: s.y + s.height / 2,
              node: s.node,
            })),
            draggedIndividual.id,
            draggedCenter
          );

          let isValidTarget = true;
          if (closestRow) {
            const overIndividual = dataset.individuals.get(closestRow.id);
            isValidTarget = canReorderIndividuals(draggedIndividual, overIndividual);
          }

          svg
            .selectAll(".individual")
            .classed("drop-target-valid", false)
            .classed("drop-target-invalid", false);

          if (closestRow && !isValidTarget) {
            d3.select(closestRow.node).classed("drop-target-invalid", true);
            
            // If dragging outside the parent system, don't displace siblings
            siblings.forEach((snap) => shiftElement(snap.id, 0, true));
            return;
          }

          let insertIdx = siblings.length;
          for (let i = 0; i < siblings.length; i++) {
            if (draggedCenter < siblings[i].y + siblings[i].height / 2) {
              insertIdx = i;
              break;
            }
          }

          const origIdx = siblingSnaps.indexOf(draggedSnap);

          const draggedHeight = draggedSnap.height + (configData.layout.system?.componentGap ?? 4);

          siblings.forEach((snap, i) => {
            const origOtherIdx = siblingSnaps.indexOf(snap);
            let dy = 0;
            if (origOtherIdx < origIdx && i >= insertIdx) {
              dy = draggedHeight;
            } else if (origOtherIdx > origIdx && i < insertIdx) {
              dy = -draggedHeight;
            }
            shiftElement(snap.id, dy, true);
          });
        } else {
          // --- TOP-LEVEL DRAG (system or regular individual) ---
          const draggedSnap = topLevelSnapshot.find((r) => r.id === draggedIndividual.id);
          if (!draggedSnap) return;

          const draggedTop = draggedSnap.y + nextOffset;
          const draggedBottom = draggedTop + draggedSnap.height;
          const movingDown = nextOffset >= 0;
          const targetProbeY = movingDown ? draggedBottom : draggedTop;
          const others = topLevelSnapshot.filter((r) => r.id !== draggedIndividual.id);

          const insertIdxCandidate = others.findIndex(
            (row) => targetProbeY < row.y + row.height / 2
          );
          const insertIdx = insertIdxCandidate < 0 ? others.length : insertIdxCandidate;

          // Check validity
          const closestRow = getClosestTargetRow(
            topLevelSnapshot.map((s) => ({
              id: s.id,
              centerY: s.y + s.height / 2,
              node: s.node,
            })),
            draggedIndividual.id,
            targetProbeY
          );

          let isValidTarget = true;
          if (closestRow) {
            const overIndividual = dataset.individuals.get(closestRow.id);
            isValidTarget = canReorderIndividuals(draggedIndividual, overIndividual);
          }

          svg
            .selectAll(".individual")
            .classed("drop-target-valid", false)
            .classed("drop-target-invalid", false);
            
          if (closestRow && !isValidTarget) {
            d3.select(closestRow.node).classed("drop-target-invalid", true);
          }

          const origIdx = topLevelSnapshot.indexOf(draggedSnap);

          if (!isValidTarget) {
            others.forEach((snap) => shiftGroup(snap, 0));
            return;
          }

          // draggedHeight includes the full group height + gap
          const draggedHeight = draggedSnap.height + configData.layout.individual.gap;

          others.forEach((snap, i) => {
            const origOtherIdx = topLevelSnapshot.indexOf(snap);
            let dy = 0;
            if (origOtherIdx < origIdx && i >= insertIdx) {
              dy = draggedHeight;
            } else if (origOtherIdx > origIdx && i < insertIdx) {
              dy = -draggedHeight;
            }
            shiftGroup(snap, dy);
          });
        }
      })
      .on("end", function (_event, draggedIndividual) {
        // Stop auto-scroll
        stopAutoScroll();

        // Clean up all preview transforms
        clearAllPreviewShifts();

        // Clean up drop target visuals
        svg
          .selectAll(".individual")
          .classed("drop-target-valid", false)
          .classed("drop-target-invalid", false);

        const draggedSelection = getDragRowSelection(this, draggedIndividual.id);
        if (draggedSelection.empty()) return;
        const wasDragged = draggedSelection.attr("data-was-dragged") === "1";
        const dragOffset = Number(draggedSelection.attr("data-drag-offset") ?? "0");

        const draggedType = getEntityTypeIdFromIndividual(draggedIndividual);
        const isSystem = draggedType === ENTITY_TYPE_IDS.SYSTEM;
        const isDraggedComponent = isNestedComponent(draggedIndividual);

        // Reset transforms on dragged element (and its components if system)
        draggedSelection
          .attr("transform", null)
          .attr("data-drag-offset", null)
          .attr("data-total-drag", null)
          .attr("data-was-dragged", null)
          .attr("data-raised", null)
          .style("cursor", "default");

        svg.select(`#il${draggedIndividual.id}`).attr("transform", null);
        svg
          .selectAll<SVGPathElement, unknown>(".installDash")
          .filter(function () {
            return (this as SVGElement).getAttribute("data-individual-id") === draggedIndividual.id;
          })
          .attr("transform", null);
        updateLinkedHatches(draggedIndividual.id, 0);
        updateLinkedRibbons(draggedIndividual.id, 0);

        if (isSystem) {
          const compIds = getComponentIdsForSystem(draggedIndividual.id);
          compIds.forEach((cid) => {
            svg.select(`#i${cid}`).attr("transform", null);
            svg.select(`#il${cid}`).attr("transform", null);
            updateLinkedHatches(cid, 0);
            updateLinkedRibbons(cid, 0);
          });
        }

        const savedTopLevel = [...topLevelSnapshot];
        const savedFull = [...dragSnapshot];
        dragSnapshot = [];
        topLevelSnapshot = [];
        activityBoundsSnapshot.clear();
        entityOffsets.clear();

        if (!wasDragged) return;

        if (isDraggedComponent) {
          // ── Component reorder within its system ──
          const parentId = draggedIndividual.installedIn!;
          const siblingSnaps = savedFull
            .filter((r) => r.parentSystemId === parentId)
            .sort((a, b) => a.y - b.y);

          const draggedSnap = siblingSnaps.find((r) => r.id === draggedIndividual.id);
          if (!draggedSnap) return;

          const draggedCenter = draggedSnap.y + draggedSnap.height / 2 + dragOffset;
          const otherSiblings = siblingSnaps.filter((r) => r.id !== draggedIndividual.id);
          const insertionIndex = otherSiblings.findIndex(
            (r) => draggedCenter < r.y + r.height / 2
          );
          const nextSiblings = [...otherSiblings];
          if (insertionIndex < 0) {
            nextSiblings.push(draggedSnap);
          } else {
            nextSiblings.splice(insertionIndex, 0, draggedSnap);
          }

          // Build full ID list: go through savedFull in order, replacing
          // sibling component order with the new order
          const newComponentOrder = nextSiblings.map((s) => s.id);
          const topRows = savedTopLevel.map((s) => s.id);
          // For the parent system, swap in the new component order
          const fullIds: string[] = [];
          topRows.forEach((id) => {
            fullIds.push(id);
            if (id === parentId) {
              newComponentOrder.forEach((cid) => fullIds.push(cid));
            } else {
              const snap = savedTopLevel.find((s) => s.id === id);
              if (snap) snap.componentIds.forEach((cid) => fullIds.push(cid));
            }
          });

          onReorderIndividuals(fullIds);
        } else {
          // ── Top-level reorder ──
          const topRows = [...savedTopLevel].sort((a, b) => a.y - b.y);
          const draggedRow = topRows.find((row) => row.id === draggedIndividual.id);
          if (!draggedRow) return;

          const draggedTop = draggedRow.y + dragOffset;
          const draggedBottom = draggedTop + draggedRow.height;
          const movingDown = dragOffset >= 0;
          const targetProbeY = movingDown ? draggedBottom : draggedTop;

          const closestRow = getClosestTargetRow(
            topRows.map((row) => ({
              id: row.id,
              centerY: row.y + row.height / 2,
              node: row.node,
            })),
            draggedIndividual.id,
            targetProbeY
          );
          const overIndividual = closestRow
            ? dataset.individuals.get(closestRow.id)
            : undefined;
          if (!canReorderIndividuals(draggedIndividual, overIndividual)) {
            return;
          }

          const otherRows = topRows.filter((row) => row.id !== draggedIndividual.id);
          const insertionIndex = otherRows.findIndex(
            (row) => targetProbeY < row.y + row.height / 2
          );
          const nextRows = [...otherRows];
          if (insertionIndex < 0) {
            nextRows.push(draggedRow);
          } else {
            nextRows.splice(insertionIndex, 0, draggedRow);
          }

          // Emit full list including components after their parent systems
          const fullIds: string[] = [];
          nextRows.forEach((row) => {
            fullIds.push(row.id);
            const snap = savedTopLevel.find((s) => s.id === row.id);
            if (snap) snap.componentIds.forEach((cid) => fullIds.push(cid));
          });

          onReorderIndividuals(fullIds);
        }
      });

    svg
      .selectAll<SVGGraphicsElement, Individual>(".individual, .individualLabel")
      .style("cursor", "default")
      .call(dragBehavior as any);

    return () => {
      svg
        .selectAll(".individual, .individualLabel")
        .on(".drag", null)
        .interrupt()
        .style("cursor", null)
        .classed("drop-target-valid", false)
        .classed("drop-target-invalid", false);
      svg.selectAll(".individual").attr("transform", null);
      svg.selectAll(".individualLabel").interrupt().attr("transform", null);
      svg.selectAll(".installDash").interrupt().attr("transform", null);
      svg.selectAll(".installHatch").interrupt().attr("transform", null)
        .each(function () {
          const el = this as SVGElement;
          const saved = el.getAttribute("data-saved-clip");
          if (saved) {
            el.setAttribute("clip-path", saved);
            el.removeAttribute("data-saved-clip");
          }
        });
      dragSnapshot = [];
      topLevelSnapshot = [];
      activityBoundsSnapshot.clear();
      entityOffsets.clear();
      stopAutoScroll();
    };
  }, [plot, svgRef, interactionMode, onReorderIndividuals, dataset]);

  useEffect(() => {
    return () => {
      if (searchHighlightTimerRef.current !== null) {
        window.clearTimeout(searchHighlightTimerRef.current);
      }
    };
  }, []);

  const minimapBaseWidth = useMemo(() => {
    if (plot.width === 0 || plot.height === 0) return 280;
    const aspect = plot.width / plot.height;
    return Math.min(360, Math.max(220, 180 * aspect));
  }, [plot]);

  const effectiveMinimapWidth = Math.round(minimapBaseWidth * minimapScale);

  const getClampedMinimapSizeAndPosition = (requestedPos: { left: number; top: number } | null) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = Math.min(effectiveMinimapWidth, Math.max(180, viewportWidth - 24));
    const panelHeight = plot.width > 0 && plot.height > 0
      ? Math.min(260, Math.max(90, Math.round((panelWidth / plot.width) * plot.height) + 28))
      : 180;

    if (!requestedPos) {
      return {
        width: panelWidth,
        pos: null as { left: number; top: number } | null,
        panelHeight,
      };
    }

    return {
      width: panelWidth,
      panelHeight,
      pos: {
        left: Math.max(0, Math.min(requestedPos.left, Math.max(0, viewportWidth - panelWidth))),
        top: Math.max(0, Math.min(requestedPos.top, Math.max(0, viewportHeight - panelHeight))),
      },
    };
  };

  const { width: minimapPanelWidth, pos: clampedMinimapPos } = getClampedMinimapSizeAndPosition(minimapPos);

  const navigateFromMinimap = (e: React.PointerEvent<SVGSVGElement>) => {
    const scrollContainer = document.getElementById("activity-diagram-scrollable-div");
    if (!scrollContainer || !svgRef.current || !minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const diagX = Math.max(0, Math.min(plot.width, ((e.clientX - rect.left) / rect.width) * plot.width));
    const diagY = Math.max(0, Math.min(plot.height, ((e.clientY - rect.top) / rect.height) * plot.height));
    const svgRect = svgRef.current.getBoundingClientRect();
    if (svgRect.width === 0) return;
    const pixelScale = svgRect.width / plot.width;
    const t = zoomTransformRef.current;
    const svgX = diagX * t.k + t.x;
    const svgY = diagY * t.k + t.y;
    scrollContainer.scrollLeft = svgX * pixelScale - scrollContainer.clientWidth / 2;
    scrollContainer.scrollTop = svgY * pixelScale - scrollContainer.clientHeight / 2;
  };

  const LENS_SIZE = 160;
  const LENS_ZOOM = 5;

  const updateMinimapLens = (e: React.PointerEvent<SVGSVGElement>) => {
    const lens = minimapLensRef.current;
    const lensSvg = minimapLensSvgRef.current;
    if (!lens || !lensSvg || !minimapRef.current) return;
    const mmSvgRect = minimapRef.current.getBoundingClientRect();
    if (mmSvgRect.width === 0 || mmSvgRect.height === 0) return;
    // Fraction of minimap where cursor is
    const fracX = (e.clientX - mmSvgRect.left) / mmSvgRect.width;
    const fracY = (e.clientY - mmSvgRect.top) / mmSvgRect.height;
    // Position lens relative to the minimap container
    const mmParent = minimapRef.current.closest(".diagram-minimap") as HTMLElement | null;
    if (!mmParent) return;
    const mmParentRect = mmParent.getBoundingClientRect();
    const relX = e.clientX - mmParentRect.left;
    const relY = e.clientY - mmParentRect.top;
    // Offset lens so it doesn't occlude the cursor
    let lensLeft = relX - LENS_SIZE - 12;
    let lensTop = relY - LENS_SIZE - 12;
    if (lensLeft < 0) lensLeft = relX + 16;
    if (lensTop < 0) lensTop = relY + 16;
    lens.style.left = lensLeft + "px";
    lens.style.top = lensTop + "px";
    lens.style.display = "block";
    // Scale the lens SVG to LENS_ZOOM × the minimap SVG size and translate
    // so the cursor position is centered in the lens window.
    const scaledW = mmSvgRect.width * LENS_ZOOM;
    const scaledH = mmSvgRect.height * LENS_ZOOM;
    lensSvg.style.width = scaledW + "px";
    lensSvg.style.height = scaledH + "px";
    const unclampedTranslateX = LENS_SIZE / 2 - fracX * scaledW;
    const unclampedTranslateY = LENS_SIZE / 2 - fracY * scaledH;
    const translateX = Math.min(0, Math.max(LENS_SIZE - scaledW, unclampedTranslateX));
    const translateY = Math.min(0, Math.max(LENS_SIZE - scaledH, unclampedTranslateY));
    lensSvg.style.transformOrigin = "top left";
    lensSvg.style.transform = `translate(${translateX}px, ${translateY}px)`;
  };

  const hideMinimapLens = () => {
    setMinimapHoveredEntityId(null);
    if (minimapLensRef.current) minimapLensRef.current.style.display = "none";
  };

  // Clone minimap content into the lens SVG whenever minimap redraws
  useEffect(() => {
    if (!minimapRef.current || !minimapLensSvgRef.current || !showMinimap) return;
    const lSvg = minimapLensSvgRef.current;
    // Remove old content except viewport
    while (lSvg.firstChild) lSvg.removeChild(lSvg.firstChild);
    const clone = minimapRef.current.querySelector("#minimap-content");
    if (clone) {
      lSvg.appendChild(clone.cloneNode(true));
    }
  }, [plot, showMinimap, collapsedSystems, isMobileLegendLayout, minimapPortalTarget, viewportWidth]);

  const hitTestMinimapEntity = (e: React.PointerEvent<SVGSVGElement>): string | null => {
    if (!minimapRef.current) return null;

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    for (const element of elements) {
      if (!minimapRef.current.contains(element)) continue;

      const installedId = element.getAttribute("data-installed-id");
      if (installedId) return resolveVisibleEntityId(installedId);

      const targetId = element.getAttribute("data-target-id");
      if (targetId) return resolveVisibleEntityId(targetId);

      let cursor: Element | null = element;
      while (cursor && cursor !== minimapRef.current) {
        const cursorInstalledId = cursor.getAttribute("data-installed-id");
        if (cursorInstalledId) return resolveVisibleEntityId(cursorInstalledId);

        const cursorTargetId = cursor.getAttribute("data-target-id");
        if (cursorTargetId) return resolveVisibleEntityId(cursorTargetId);

        const rawId = cursor.getAttribute("id") ?? "";
        if (rawId.startsWith("il")) return resolveVisibleEntityId(rawId.slice(2));
        if (rawId.startsWith("i")) return resolveVisibleEntityId(rawId.slice(1));
        cursor = cursor.parentElement;
      }
    }

    const rect = minimapRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const diagY = ((e.clientY - rect.top) / rect.height) * plot.height;
    const individuals = Array.from(dataset.individuals.values());
    const svg = svgRef.current ? d3.select(svgRef.current) : null;
    if (!svg) return null;
    for (const ind of individuals) {
      const rowNode = svg.select(`#i${ind.id}`).node() as SVGGraphicsElement | null;
      if (!rowNode) continue;
      const box = rowNode.getBBox();
      if (diagY >= box.y && diagY <= box.y + box.height) {
        return resolveVisibleEntityId(ind.id);
      }
    }
    return null;
  };

  const applyEntityHighlightToMinimap = (svgNode: SVGSVGElement | null, entityId: string | null) => {
    if (!svgNode) return;
    const svg = d3.select(svgNode);
    svg.selectAll(".entity-hover-highlight").classed("entity-hover-highlight", false);
    if (!entityId) return;

    const visibleEntityId = resolveVisibleEntityId(entityId);
    const highlightEntityIds = new Set([entityId, visibleEntityId]);

    svg.select(`#i${visibleEntityId}`).classed("entity-hover-highlight", true);
    svg.select(`#il${visibleEntityId}`).classed("entity-hover-highlight", true);
    svg.selectAll(".installHatch").each(function () {
      const el = this as Element;
      if (
        highlightEntityIds.has(el.getAttribute("data-installed-id") ?? "") ||
        highlightEntityIds.has(el.getAttribute("data-target-id") ?? "")
      ) {
        d3.select(el).classed("entity-hover-highlight", true);
      }
    });

    const entity = dataset.individuals.get(entityId);
    const isSystemComponent = entity && getEntityTypeIdFromIndividual(entity) === ENTITY_TYPE_IDS.SYSTEM_COMPONENT;
    if (!isSystemComponent || visibleEntityId !== entityId) {
      svg.selectAll(".installConnectorRibbon").each(function () {
        const el = this as Element;
        if (
          highlightEntityIds.has(el.getAttribute("data-installed-id") ?? "") ||
          highlightEntityIds.has(el.getAttribute("data-target-id") ?? "")
        ) {
          d3.select(el).classed("entity-hover-highlight", true);
        }
      });
    }
  };

  useEffect(() => {
    applyEntityHighlightToMinimap(minimapRef.current, minimapHoveredEntityId);
    applyEntityHighlightToMinimap(minimapLensSvgRef.current, minimapHoveredEntityId);
  }, [minimapHoveredEntityId, plot, showMinimap, collapsedSystems]);

  const onMinimapHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const minimapEl = (e.target as HTMLElement).closest(".diagram-minimap") as HTMLElement | null;
    if (!minimapEl) return;
    const mmRect = minimapEl.getBoundingClientRect();
    minimapDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: mmRect.left,
      startTop: mmRect.top,
    };
  };

  const onMinimapHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!minimapDragRef.current) return;
    const dx = e.clientX - minimapDragRef.current.startX;
    const dy = e.clientY - minimapDragRef.current.startY;
    const requested = {
      left: minimapDragRef.current.startLeft + dx,
      top: minimapDragRef.current.startTop + dy,
    };
    setMinimapPos(getClampedMinimapSizeAndPosition(requested).pos);
  };

  const onMinimapHeaderPointerUp = () => {
    minimapDragRef.current = null;
  };

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      setMinimapPos((current) => getClampedMinimapSizeAndPosition(current).pos);
    };

    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [effectiveMinimapWidth, plot.width, plot.height]);

  const buildCrumbs = () => {
    const context = [];
    let id: string | undefined = activityContext;
    while (true) {
      const link = id;
      const act = id ? dataset.activities.get(id) : null;
      const text = act ? act.name : <i>{dataset.name ?? "Top"}</i>;
      context.push(
        <Breadcrumb.Item
          active={id == activityContext}
          linkProps={{ onClick: () => setActivityContext(link) }}
          key={id ?? "."}
        >
          {text}
        </Breadcrumb.Item>
      );
      if (id == undefined) break;
      id = act!.partOf;
    }
    return context.reverse();
  };
  const crumbs: JSX.Element[] = buildCrumbs();
  const isDiagramEmpty = dataset.individuals.size === 0 && dataset.activities.size === 0;

  const minimapPanel = showMinimap && !isDiagramEmpty && plot.width > 0 ? (
    <div
      className="diagram-minimap"
      style={
        isMobileLegendLayout
          ? { position: "static", width: "100%", maxWidth: "100%" }
          : clampedMinimapPos
            ? { position: "fixed", width: minimapPanelWidth + "px", left: clampedMinimapPos.left, top: clampedMinimapPos.top, bottom: "auto", right: "auto" }
            : { position: "absolute", width: minimapPanelWidth + "px", maxWidth: "calc(100vw - 24px)" }
      }
    >
      <div
        className="diagram-minimap-header"
        onPointerDown={onMinimapHeaderPointerDown}
        onPointerMove={onMinimapHeaderPointerMove}
        onPointerUp={onMinimapHeaderPointerUp}
      >
        <span className="diagram-minimap-grip" aria-hidden="true">⠿</span>
        <span className="diagram-minimap-controls">
          <button
            type="button"
            className="diagram-minimap-btn"
            title="Zoom out minimap"
            onClick={() => setMinimapScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            disabled={minimapScale <= 0.5}
          >−</button>
          <button
            type="button"
            className="diagram-minimap-btn"
            title="Reset minimap size"
            onClick={() => { setMinimapScale(responsiveDefaultMinimapScale); setMinimapPos(null); }}
          >⟳</button>
          <button
            type="button"
            className="diagram-minimap-btn"
            title="Zoom in minimap"
            onClick={() => setMinimapScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
            disabled={minimapScale >= 3}
          >+</button>
        </span>
      </div>
      <div className="diagram-minimap-canvas">
        <svg
          ref={minimapRef}
          viewBox={`0 0 ${plot.width} ${plot.height}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={(e) => {
            e.preventDefault();
            minimapRef.current?.setPointerCapture(e.pointerId);
            const entityId = hitTestMinimapEntity(e);
            if (entityId) {
              focusEntityFromSearch(entityId);
            } else {
              navigateFromMinimap(e);
            }
          }}
          onPointerMove={(e) => {
            setMinimapHoveredEntityId(hitTestMinimapEntity(e));
            updateMinimapLens(e);
            if (e.buttons > 0) navigateFromMinimap(e);
          }}
          onPointerLeave={hideMinimapLens}
        />
      </div>
      <div ref={minimapLensRef} className="diagram-minimap-lens" style={{ display: "none", width: LENS_SIZE, height: LENS_SIZE }}>
        <svg
          ref={minimapLensSvgRef}
          viewBox={`0 0 ${plot.width} ${plot.height}`}
        />
      </div>
    </div>
  ) : null;

  return (
    <>
      <Breadcrumb>{crumbs}</Breadcrumb>
      <div
        className="diagram-viewport"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="diagram-icon-toggle"
          style={{
            marginLeft: "auto",
            display: "flex",
            justifyContent: "flex-end",
            gap: "6px",
            marginBottom: "0px",
            marginTop: "-44px", /* Align controls vertically with the Top breadcrumb label */
            marginRight: "20px",
            width: "fit-content",
            position: "sticky", /* Ensuring stickiness aligns with globals.css or overrides if needed */
            top: "72px",
            zIndex: 10,
          }}
        >
          <Button
            variant={interactionMode === "pointer" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setInteractionMode("pointer")}
            aria-pressed={interactionMode === "pointer"}
            title="Pointer mode"
            style={{ width: "2.2em", height: "2.2em", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="1em" height="1em" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 2l9 4-4 1 2 6-2 1-2-6-3 3V2z" fill="currentColor" />
            </svg>
          </Button>
          <Button
            variant={interactionMode === "zoom" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setInteractionMode("zoom")}
            onContextMenu={(e) => {
              e.preventDefault();
              zoomTransformRef.current = d3.zoomIdentity;
              if (svgRef.current) {
                const svg = d3.select(svgRef.current);
                svg.select("#activity-diagram-group").attr("transform", d3.zoomIdentity.toString());
                if (zoomRef.current) {
                  svg.call(zoomRef.current.transform, d3.zoomIdentity);
                }
              }
            }}
            aria-pressed={interactionMode === "zoom"}
            title="Zoom mode (right-click to reset)"
            style={{ width: "2.2em", height: "2.2em", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="1em" height="1em" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M7 4.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M5 7h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Button>

          <div className="diagram-search-wrap">
            <Button
              variant={isSearchOpen ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setIsSearchOpen((prev) => !prev);
                setSearchQuery("");
              }}
              aria-pressed={isSearchOpen}
              title="Search entities"
              style={{ width: "2.2em", height: "2.2em", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="1em" height="1em" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Button>

            {isSearchOpen && (
              <Draggable nodeRef={searchDragRef} handle=".diagram-search-drag-handle">
              <div className="diagram-search-popover" ref={searchDragRef}>
                <div
                  className="diagram-search-drag-handle"
                  style={{
                    cursor: "grab",
                    width: "100%",
                    height: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "6px",
                    opacity: 0.3,
                  }}
                  title="Drag to move"
                  onMouseDown={(e) => (e.currentTarget.style.cursor = "grabbing")}
                  onMouseUp={(e) => (e.currentTarget.style.cursor = "grab")}
                >
                  <svg width="24" height="6" viewBox="0 0 24 6" fill="currentColor">
                    <circle cx="2" cy="3" r="1.5" />
                    <circle cx="8" cy="3" r="1.5" />
                    <circle cx="14" cy="3" r="1.5" />
                    <circle cx="20" cy="3" r="1.5" />
                  </svg>
                </div>
                <div className="diagram-search-input-wrap">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setHighlightedSearchIndex(-1);
                    }}
                    onKeyDown={(e) => {
                      const len = filteredSearchResults.length;
                      if (len === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightedSearchIndex((prev) => {
                          const next = prev < len - 1 ? prev + 1 : 0;
                          requestAnimationFrame(() => {
                            const container = searchResultsRef.current;
                            const child = container?.children[next] as HTMLElement | undefined;
                            if (container && child) {
                              const childTop = child.offsetTop;
                              const childBottom = childTop + child.offsetHeight;
                              if (childBottom > container.scrollTop + container.clientHeight) {
                                container.scrollTop = childBottom - container.clientHeight;
                              } else if (childTop < container.scrollTop) {
                                container.scrollTop = childTop;
                              }
                            }
                          });
                          return next;
                        });
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightedSearchIndex((prev) => {
                          const next = prev > 0 ? prev - 1 : len - 1;
                          requestAnimationFrame(() => {
                            const container = searchResultsRef.current;
                            const child = container?.children[next] as HTMLElement | undefined;
                            if (container && child) {
                              const childTop = child.offsetTop;
                              const childBottom = childTop + child.offsetHeight;
                              if (childTop < container.scrollTop) {
                                container.scrollTop = childTop;
                              } else if (childBottom > container.scrollTop + container.clientHeight) {
                                container.scrollTop = childBottom - container.clientHeight;
                              }
                            }
                          });
                          return next;
                        });
                      } else if (e.key === "Enter" && highlightedSearchIndex >= 0 && highlightedSearchIndex < len) {
                        e.preventDefault();
                        const entity = filteredSearchResults[highlightedSearchIndex];
                        focusEntityFromSearch(entity.id);
                      } else if (e.key === "Escape") {
                        setIsSearchOpen(false);
                        setSearchQuery("");
                      }
                    }}
                    placeholder="Search entity"
                    className="diagram-search-input"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="diagram-search-clear"
                      onClick={() => setSearchQuery("")}
                      title="Clear search"
                    >
                      <svg width="1em" height="1em" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" fill="currentColor" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="diagram-search-results" ref={searchResultsRef}>
                  {filteredSearchResults.length === 0 ? (
                    <div className="diagram-search-empty">No results</div>
                  ) : (
                    filteredSearchResults.map((entity) =>
                      editingEntityId === entity.id ? (
                        <div key={entity.id} className="diagram-search-result-edit">
                          <input
                            type="text"
                            value={editingEntityName}
                            onChange={(e) => setEditingEntityName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (renameIndividual && editingEntityName.trim()) {
                                  renameIndividual(entity.id, editingEntityName.trim());
                                }
                                setEditingEntityId(null);
                              } else if (e.key === "Escape") {
                                setEditingEntityId(null);
                              }
                            }}
                            autoFocus
                            className="diagram-search-edit-input"
                          />
                          <button
                            type="button"
                            className="diagram-search-edit-confirm"
                            title="Confirm"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (renameIndividual && editingEntityName.trim()) {
                                renameIndividual(entity.id, editingEntityName.trim());
                              }
                              setEditingEntityId(null);
                            }}
                          >
                            <svg width="1em" height="1em" viewBox="0 0 16 16" aria-hidden="true">
                              <path d="M13.485 1.929a.75.75 0 0 1 .086 1.057l-7.25 8.5a.75.75 0 0 1-1.1.042l-3.25-3.25a.75.75 0 0 1 1.06-1.06l2.663 2.663 6.734-7.893a.75.75 0 0 1 1.057-.059z" fill="currentColor" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          key={entity.id}
                          type="button"
                          className={`diagram-search-result${filteredSearchResults.indexOf(entity) === highlightedSearchIndex ? " diagram-search-result-active" : ""}`}
                          onClick={() => {
                            focusEntityFromSearch(entity.id);
                          }}
                          onMouseEnter={() => setHighlightedSearchIndex(filteredSearchResults.indexOf(entity))}
                        >
                          <span className="diagram-search-name">{entity.name}</span>
                          <span className="diagram-search-actions">
                            <span className="diagram-search-type">{entity.typeLabel}</span>
                            {renameIndividual && (
                              <span
                                className="diagram-search-edit-icon"
                                role="button"
                                tabIndex={0}
                                title="Edit name"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEntityId(entity.id);
                                  setEditingEntityName(entity.name);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setEditingEntityId(entity.id);
                                    setEditingEntityName(entity.name);
                                  }
                                }}
                              >
                                <svg width="1em" height="1em" viewBox="0 0 16 16" aria-hidden="true">
                                  <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708L12.854.146zM13.5 6.207L9.793 2.5 3.622 8.671a.5.5 0 0 0-.121.196l-1.47 4.166a.5.5 0 0 0 .638.638l4.166-1.47a.5.5 0 0 0 .196-.12L13.5 6.207z" fill="currentColor" />
                                </svg>
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    )
                  )}
                </div>
              </div>
              </Draggable>
            )}
          </div>

          <Button
            variant={showMinimap ? "primary" : "secondary"}
            size="sm"
            onClick={() => setShowMinimap((prev) => !prev)}
            aria-pressed={showMinimap}
            title="Toggle minimap"
            style={{ width: "2.2em", height: "2.2em", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="1em" height="1em" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <rect x="8" y="8" width="6" height="6" rx="1" fill="currentColor" opacity="0.5" />
            </svg>
          </Button>
        </div>

        <div
          id="activity-diagram-scrollable-div"
          style={{
            overflowX: "auto",
            overflowY: "auto",
            touchAction: "pan-x pan-y",
            cursor: interactionMode === "zoom" ? "zoom-in" : "default",
          }}
        >
          <svg
            viewBox={`0 0 ${plot.width} ${plot.height}`}
            ref={svgRef}
            style={{
              minWidth: "100%",
              maxWidth: "100%",
            }}
          />
        </div>
        {isMobileLegendLayout && minimapPortalTarget ? createPortal(minimapPanel, minimapPortalTarget) : minimapPanel}
      </div>
    </>
  );
};

export default ActivityDiagram;
