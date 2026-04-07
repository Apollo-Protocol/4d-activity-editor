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
import * as d3 from "d3";
import { useDiagramDragReorder } from "@/hooks/useDiagramDragReorder";

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

  const getResponsiveDefaultMinimapScale = () => {
    if (viewportWidth >= 1600) return 0.75;
    if (viewportWidth <= 768) return 0.5;
    // Linear interpolation between 768→0.5 and 1600→0.75
    return +(0.5 + (0.25 * (viewportWidth - 768)) / (1600 - 768)).toFixed(3);
  };

  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomTransformRef = useRef(d3.zoomIdentity);

  const [collapsedSystems, setCollapsedSystems] = useState<Set<string>>(new Set());
  const [hasRestoredCollapsedSystems, setHasRestoredCollapsedSystems] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
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

  const shouldHighlightEntityConnectorRibbons = (entityId: string) => {
    const entity = dataset.individuals.get(entityId);
    if (!entity) {
      return true;
    }

    const entityType = getEntityTypeIdFromIndividual(entity);
    if (entityType === ENTITY_TYPE_IDS.SYSTEM_COMPONENT) {
      return false;
    }

    if (
      entityType === ENTITY_TYPE_IDS.SYSTEM &&
      collapsedSystems.has(entityId)
    ) {
      return false;
    }

    return true;
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
    if (shouldHighlightEntityConnectorRibbons(entityId)) {
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

    svg.selectAll(".activity")
      .attr("opacity", configData.presentation.activity.opacity)
      .attr("stroke-width", configData.presentation.activity.strokeWidth)
      .attr("stroke-dasharray", configData.presentation.activity.strokeDasharray);
    svg.selectAll(".participation").attr("opacity", configData.presentation.participation.opacity);
    svg.selectAll(".participationRibbon").attr("opacity", configData.presentation.participation.opacity);
    svg.selectAll(".activityLabel").attr("opacity", 1);

    if (highlightedActivityId) {
      // Dim all activities and participations
      svg.selectAll(".activity").attr("opacity", 0.15);
      svg.selectAll(".participation").attr("opacity", 0.1);
      svg.selectAll(".participationRibbon").attr("opacity", 0.1);
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
        .attr("opacity", 0.8)
        .raise();

      // Highlight participation ribbons belonging to the selected activity
      svg.selectAll(".participationRibbon")
        .filter(function () {
          return (this as SVGElement).getAttribute("data-activity-id") === highlightedActivityId;
        })
        .attr("opacity", 0.8)
        .raise();
    }
  }, [highlightedActivityId, plot, configData, svgRef]);


  useDiagramDragReorder(svgRef, plot, dataset, configData, interactionMode, onReorderIndividuals);


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
    // Offset lens so it doesn't occlude the cursor. Keep the vertical
    // placement fixed instead of flipping above/below the cursor.
    const viewportW = window.innerWidth;
    let lensLeft = relX - LENS_SIZE - 12;
    const lensTop = relY - LENS_SIZE - 12;
    if (e.clientX - LENS_SIZE - 12 < 0) lensLeft = relX + 16;
    if (e.clientX + 16 + LENS_SIZE > viewportW) lensLeft = relX - LENS_SIZE - 12;
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

    if (shouldHighlightEntityConnectorRibbons(entityId)) {
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
