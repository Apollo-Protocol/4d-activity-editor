/* eslint-disable max-classes-per-file */
import { HQDM_NS } from "@apollo-protocol/hqdm-lib";
import type {
  Activity,
  Id,
  Individual,
  Installation,
  Maybe,
  Participation,
} from "./Schema.js";
import { EntityType } from "./Schema";
import { EPOCH_END } from "./ActivityLib";

/**
 * A class used to list the types needed for drop-downs in the UI.
 */
export class Kind {
  readonly id: Id;
  name: string;
  readonly isCoreHqdm: boolean;

  constructor(id: Id, name: string, isCoreHqdm: boolean) {
    this.id = id;
    this.name = name;
    this.isCoreHqdm = isCoreHqdm;
  }
}

/**
 * A class that is the UI Model.
 */
export class Model {
  readonly activities: Map<Id, Activity>;
  readonly individuals: Map<Id, Individual>;

  readonly roles: Array<Kind>;
  readonly activityTypes: Array<Kind>;
  readonly individualTypes: Array<Kind>;

  defaultRole: Kind;
  defaultActivityType: Kind;
  defaultIndividualType: Kind;

  // Overall information about the model
  name: Maybe<string>;
  description: Maybe<string>;
  filename: string;

  // NEW: central store of installations
  installations: Map<Id, Installation>;

  constructor(name?: string, description?: string) {
    this.name = name;
    this.description = description;
    this.filename = "activity_diagram.ttl";
    this.activities = new Map<Id, Activity>();
    this.individuals = new Map<Id, Individual>();

    /* XXX There is an inconsistency here. Most objects in the UI model
     * have their id set to a plain UUID, i.e. not to an IRI. These core
     * HQDM objects are created with their id set to an IRI. */

    /* These default roles created here need to match the equivalents
     * created in ActivityLib:toModel. */
    this.roles = [new Kind(HQDM_NS + "participant", "Participant", true)];
    this.defaultRole = this.roles[0];
    this.activityTypes = [new Kind(HQDM_NS + "activity", "Task", true)];
    this.defaultActivityType = this.activityTypes[0];
    this.individualTypes = [
      new Kind(HQDM_NS + "person", "Person", true),
      new Kind(HQDM_NS + "organization", "Organization", true),
      new Kind(HQDM_NS + "ordinary_physical_object", "Resource", true),
    ];
    this.defaultIndividualType = this.individualTypes[2];

    this.installations = new Map<Id, Installation>();
  }

  static END_OF_TIME = EPOCH_END;

  /**
   * Returns a copy of the model.
   */
  clone(): Model {
    const newModel = new Model(this.name, this.description);
    newModel.filename = this.filename;

    // Deep clone activities
    this.activities.forEach((a) => {
      // Deep clone participations map
      let participations: Map<string, Participation> | undefined;
      if (a.participations instanceof Map) {
        participations = new Map<string, Participation>();
        a.participations.forEach((p, k) => {
          participations!.set(k, { ...p });
        });
      } else if (a.participations) {
        participations = new Map<string, Participation>(
          Object.entries(a.participations).map(([k, p]) => [
            k,
            Object.assign({}, p as Participation),
          ])
        );
      }
      newModel.addActivity({
        ...a,
        participations: participations ?? new Map<string, Participation>(),
      });
    });

    // Deep clone individuals
    this.individuals.forEach((i) => {
      // Deep clone installations array if present
      let installations = undefined;
      if (i.installations) {
        installations = i.installations.map((inst) => ({ ...inst }));
      }
      newModel.addIndividual({
        ...i,
        installations,
      });
    });

    // Deep clone central installations map
    this.installations.forEach((inst, id) => {
      newModel.installations.set(id, { ...inst });
    });

    this.roles
      .filter((r) => !r.isCoreHqdm)
      .forEach((r) => {
        newModel.roles.push(r);
      });
    this.activityTypes
      .filter((a) => !a.isCoreHqdm)
      .forEach((a) => {
        newModel.activityTypes.push(a);
      });
    this.individualTypes
      .filter((i) => !i.isCoreHqdm)
      .forEach((i) => {
        newModel.individualTypes.push(i);
      });
    return newModel;
  }

  /**
   * Adds a new activity to the model.
   *
   * @param a The activity to add.
   */
  addActivity(a: Activity): void {
    if (!a.id) {
      console.error("Cannot add an Activity when the Activity id is: ", a.id);
    } else {
      this.activities.set(a.id, a);
    }
  }

  /**
   * Removes an activity from the model.
   *
   * @param id The id of the activity to remove.
   */
  removeActivity(id: string): void {
    this.activities.delete(id);
  }

  /**
   * Adds a new individual to the model.
   *
   * @param individual The individual to add.
   */
  addIndividual(individual: Individual): void {
    if (!individual.id) {
      console.error(
        "Cannot add an individual when the individual id is: ",
        individual.id
      );
    } else {
      this.individuals.set(individual.id, individual);

      // Also mirror any inline installations into the central map
      if (individual.installations) {
        individual.installations.forEach((inst) => {
          this.installations.set(inst.id, inst);
        });
      }
    }
  }

  /**
   * Removes an individual from the model.
   *
   * @param id The id of the individual to remove.
   */
  removeIndividual(id: string) {
    // delegate to deleteIndividual which performs full cleanup
    this.deleteIndividual(id);
  }

  /**
   * Removes an individual and cleans up related data (participations, installations, activities).
   *
   * @param id The id of the individual to remove.
   */
  deleteIndividual(id: string) {
    const individual = this.individuals.get(id);
    if (!individual) return;

    // Remove the individual itself
    this.individuals.delete(id);

    // Remove installations that target this id (e.g., slot or system removed)
    this.individuals.forEach((ind) => {
      if (ind.installations) {
        ind.installations = ind.installations.filter(
          (inst) => inst.targetId !== id
        );
      }
    });

    // Also remove any installations owned by the deleted component (componentId === id)
    // and remove them from the central installations map.
    Array.from(this.installations.entries()).forEach(([instId, inst]) => {
      if (inst.componentId === id || inst.targetId === id) {
        this.installations.delete(instId);
      }
    });

    // Clean up participations in all activities
    const activitiesToDelete: string[] = [];
    this.activities.forEach((activity) => {
      const parts = activity.participations;
      if (!parts) return;

      // Support Map or object shape; prefer Map if used
      if (parts instanceof Map) {
        const toRemove: string[] = [];
        parts.forEach((part, key) => {
          // Remove if direct reference
          if (key === id) {
            toRemove.push(key);
            return;
          }
          // Remove if participation object points to individualId
          if ((part as any).individualId === id) {
            toRemove.push(key);
            return;
          }
          // Remove if installed component, slot, or system is being deleted
          if (typeof key === "string" && key.includes("__installed_in__")) {
            const parts = key.split("__installed_in__");
            const originalId = parts[0];
            const rest = parts[1];
            // rest could be "targetId" or "targetId__installationId"
            const targetId = rest.split("__")[0];

            if (originalId === id || targetId === id) {
              toRemove.push(key);
              return;
            }
            // Defensive: remove if either referenced individual is missing
            if (
              !this.individuals.has(originalId) ||
              !this.individuals.has(targetId)
            ) {
              toRemove.push(key);
              return;
            }
          }
        });

        toRemove.forEach((k) => parts.delete(k));
        // Update the activity in the map after modifying participations
        this.activities.set(activity.id, activity);

        // mark activity for deletion if no participations remain
        if (parts.size === 0) activitiesToDelete.push(activity.id);
      } else {
        // If participations are stored as an object/array, handle common shapes
        try {
          // object with keys
          const keys = Object.keys(parts as any);
          keys.forEach((k) => {
            const p = (parts as any)[k];
            if (k === id || p?.individualId === id) {
              delete (parts as any)[k];
              return;
            }
            if (k.includes("__installed_in__")) {
              const partsSplit = k.split("__installed_in__");
              const originalId = partsSplit[0];
              const rest = partsSplit[1];
              const targetId = rest.split("__")[0];

              if (originalId === id || targetId === id) {
                delete (parts as any)[k];
                return;
              }
              // Defensive: remove if either referenced individual is missing
              if (
                !this.individuals.has(originalId) ||
                !this.individuals.has(targetId)
              ) {
                delete (parts as any)[k];
                return;
              }
            }
          });

          // after deleting keys from (parts as any)
          this.activities.set(activity.id, activity);

          // if it's now empty, queue activity for removal
          if (Object.keys(parts as any).length === 0)
            activitiesToDelete.push(activity.id);
        } catch {
          // ignore unexpected shapes
        }
      }
    });

    // Remove activities that have become orphaned
    activitiesToDelete.forEach((aid) => this.activities.delete(aid));
  }

  /**
   * Given an individual, find the beginning of the earliest activity in which it participates
   *
   * @param individualId
   * @returns A Integer representing the beginning of the earliest participant found, or undefined or no participations where found
   */
  earliestParticipantBeginning(individualId: string) {
    let earliestBeginning = -1;
    this.activities.forEach((a) => {
      a.participations.forEach((p) => {
        if (
          p.individualId === individualId &&
          (earliestBeginning === -1 || a.beginning < earliestBeginning)
        ) {
          earliestBeginning = a.beginning;
        }
      });
    });
    return earliestBeginning;
  }

  /**
   * Given an individual, find the ending of the lastest activity in which it participates
   *
   * @param individualId
   * @returns  Integer representing the ending of the latest participant found, or an integer representing the END_OF_TIME when no participations where found
   */
  lastParticipantEnding(individualId: string) {
    let lastEnding: number = Model.END_OF_TIME;
    this.activities.forEach((a) => {
      a.participations.forEach((p) => {
        if (
          p.individualId === individualId &&
          (lastEnding === Model.END_OF_TIME || a.ending > lastEnding)
        ) {
          lastEnding = a.ending;
        }
      });
    });
    return lastEnding;
  }

  /**
   * Given an individual, find if the individual participates in any activities
   *
   * @param individualId
   * @returns A boolean
   */
  hasParticipants(individualId: string) {
    let hasParticipants = false;
    this.activities.forEach((a) => {
      a.participations.forEach((p) => {
        if (p.individualId === individualId) {
          hasParticipants = true;
        }
      });
    });
    return hasParticipants;
  }

  /**
   * Given an activity ID, finds if the activity has any parts.
   */
  hasParts(activityId: string) {
    return this.getPartsCount(activityId) > 0;
  }

  /**
   * Return the list of child activities (parts) for a given activity id.
   */
  getParts(activityId: string): Activity[] {
    const parts: Activity[] = [];
    this.activities.forEach((a) => {
      if (a.partOf === activityId) parts.push(a);
    });
    return parts;
  }

  /**
   * Return the number of child activities (parts) for a given activity id.
   */
  getPartsCount(activityId: string): number {
    let count = 0;
    this.activities.forEach((a) => {
      if (a.partOf === activityId) count++;
    });
    return count;
  }

  /**
   * Add a new role type to the model.
   *
   * @param id The id of the role type.
   * @param name The name of the role type.
   */
  addRoleType(id: string, name: string): void {
    this.roles.push(new Kind(id, name, false));
  }

  /**
   * Add a new activity type to the model.
   *
   * @param id The id of the activity type.
   * @param name The name of the activity type.
   */
  addActivityType(id: string, name: string): void {
    this.activityTypes.push(new Kind(id, name, false));
  }

  /**
   * Add a new individual type to the model.
   *
   * @param id The id of the individual type.
   * @param name The name of the individual type.
   */
  addIndividualType(id: string, name: string): void {
    this.individualTypes.push(new Kind(id, name, false));
  }

  /**
   * Translate and scale child activity temporal bounds to lie within
   * their parent activities.
   */
  normalizeActivityBounds(): void {
    console.log("Normalising activity bounds: %o", this.activities);

    const parts = new Map<Maybe<Id>, Id[]>();
    this.activities.forEach((a) => {
      const list = parts.get(a.partOf);
      if (list) list.push(a.id);
      else parts.set(a.partOf, [a.id]);
    });

    const to_process: Id[] = [];
    const to_check: Maybe<Id>[] = [undefined];
    while (to_check.length > 0) {
      const next = to_check.shift();
      const list = parts.get(next);
      if (list) {
        /* This skips the top-level activities. We could instead rescale
         * to some standard boundaries (e.g. 0-1000). */
        if (next) to_process.push(next);
        to_check.push(...list);
      }
    }

    for (const id of to_process) {
      const act = this.activities.get(id)!;

      const kids = parts.get(id)!.map((id) => this.activities.get(id)!);
      const earliest = Math.min(...kids.map((a) => a.beginning));
      const latest = Math.max(...kids.map((a) => a.ending));

      const scale = (act.ending - act.beginning) / (latest - earliest);
      const offset = act.beginning - earliest;

      for (const kid of kids) {
        kid.beginning = (kid.beginning + offset) * scale;
        kid.ending = (kid.ending + offset) * scale;
      }
    }

    console.log("Normalised activity bounds: %o", this.activities);
  }

  // Return the activity object for a given id (or undefined)
  getActivity(activityId: Id): Activity | undefined {
    return this.activities.get(activityId);
  }

  // Set the parent (partOf) for an activity. parentId may be null for top-level.
  setActivityParent(
    activityId: Id,
    parentId: Id | null,
    expandAncestors = false
  ) {
    const a = this.activities.get(activityId);
    if (!a) return;
    a.partOf = parentId ?? undefined;
    this.activities.set(a.id, a);

    if (expandAncestors && parentId) {
      let cur = this.activities.get(parentId);
      while (cur) {
        // ensure parent contains child
        if (a.beginning < cur.beginning) cur.beginning = a.beginning;
        if (a.ending > cur.ending) cur.ending = a.ending;
        this.activities.set(cur.id, cur);
        if (!cur.partOf) break;
        cur = this.activities.get(cur.partOf);
      }
    }
  }

  // Get parent activity (or undefined)
  getParent(activityId: Id): Activity | undefined {
    const a = this.activities.get(activityId);
    if (!a || !a.partOf) return undefined;
    return this.activities.get(a.partOf);
  }

  // Return ancestors chain (closest parent first)
  getAncestors(activityId: Id): Activity[] {
    const ancestors: Activity[] = [];
    let cur = this.getParent(activityId);
    while (cur) {
      ancestors.push(cur);
      if (!cur.partOf) break;
      cur = this.getParent(cur.id);
    }
    return ancestors;
  }

  // True if candidateAncestorId is an ancestor of descendantId
  isAncestor(candidateAncestorId: Id, descendantId: Id): boolean {
    let cur = this.getParent(descendantId);
    while (cur) {
      if (cur.id === candidateAncestorId) return true;
      if (!cur.partOf) break;
      cur = this.getParent(cur.id);
    }
    return false;
  }

  // True if descendantId is a descendant of ancestorId
  isDescendant(ancestorId: Id, descendantId: Id): boolean {
    return this.isAncestor(ancestorId, descendantId);
  }

  // Persist/update an individual as usual
  setIndividual(individual: Individual) {
    this.individuals.set(individual.id, individual);

    // Also mirror any inline installations into the central map
    if (individual.installations) {
      individual.installations.forEach((inst) => {
        this.installations.set(inst.id, inst);
      });
    }
  }

  // NEW: convenience methods for managing installations
  addInstallation(inst: Installation) {
    this.installations.set(inst.id, inst);

    const comp = this.individuals.get(inst.componentId);
    if (comp) {
      const list = [...(comp.installations ?? [])].filter(
        (i) => i.id !== inst.id
      );
      list.push(inst);
      comp.installations = list;
      this.individuals.set(comp.id, comp);
    }
  }

  removeInstallation(id: Id) {
    const inst = this.installations.get(id);
    if (inst) {
      const comp = this.individuals.get(inst.componentId);
      if (comp && comp.installations) {
        comp.installations = comp.installations.filter((i) => i.id !== id);
        this.individuals.set(comp.id, comp);
      }

      // Clean up any participations that reference this installation
      // The participation key format is: componentId__installed_in__targetId__installationId
      const activitiesToDelete: string[] = [];
      this.activities.forEach((activity) => {
        const parts = activity.participations;
        if (!parts) return;

        if (parts instanceof Map) {
          const toRemove: string[] = [];
          parts.forEach((_, key) => {
            // Check if this participation key references the deleted installation
            if (key.includes(`__${id}`)) {
              toRemove.push(key);
            }
          });
          toRemove.forEach((k) => parts.delete(k));
          this.activities.set(activity.id, activity);
          if (parts.size === 0) activitiesToDelete.push(activity.id);
        } else {
          try {
            const keys = Object.keys(parts as any);
            keys.forEach((k) => {
              if (k.includes(`__${id}`)) {
                delete (parts as any)[k];
              }
            });
            this.activities.set(activity.id, activity);
            if (Object.keys(parts as any).length === 0) {
              activitiesToDelete.push(activity.id);
            }
          } catch {
            // ignore
          }
        }
      });

      // Remove activities that have become orphaned
      activitiesToDelete.forEach((aid) => this.activities.delete(aid));
    }
    this.installations.delete(id);
  }

  // ... existing code ...

  /**
   * Check for circular references in installation hierarchy.
   *
   * Only blocks:
   * 1. Direct self-installation (SC1 → SC1)
   * 2. Installing into something that is currently being installed into you
   *    within the SAME installation chain/context
   *
   * Allowed:
   * - SC1 → SC2 (in System A) AND SC2 → SC1 (in System A) - parallel installations
   * - SC1 → SC2 (time 0-10) AND SC2 → SC1 (time 0-10) - both are top-level in system
   *
   * Blocked:
   * - SC1 → SC2 → SC1 (where SC2 that contains SC1 is the same SC2 that is inside SC1)
   *
   * @param componentId - The component being installed
   * @param potentialTargetId - The target to install into
   * @param scInstallationContextId - The specific SC installation context (for nested SCs)
   */
  wouldCreateCircularReference(
    componentId: string,
    potentialTargetId: string,
    scInstallationContextId?: string
  ): boolean {
    // Rule 1: Can't install into self
    if (componentId === potentialTargetId) {
      return true;
    }

    // Rule 2: Check if we're trying to install into a specific SC instance
    // that is itself installed inside us (would create SC1 → SC2 → SC1 chain)
    if (scInstallationContextId) {
      // We're installing into a specific instance of potentialTargetId
      // Check if that instance is already installed inside componentId

      // Find the installation that created this context
      const potentialTarget = this.individuals.get(potentialTargetId);
      if (potentialTarget?.installations) {
        for (const inst of potentialTarget.installations) {
          if (inst.id === scInstallationContextId) {
            // This is the specific installation context
            // Check if its target is componentId (direct cycle)
            if (inst.targetId === componentId) {
              return true;
            }

            // Check if its target is installed in componentId (indirect cycle)
            // Walk up the chain from inst.targetId to see if we reach componentId
            const visited = new Set<string>();
            const checkChain = (
              targetId: string,
              contextId?: string
            ): boolean => {
              const key = `${targetId}__${contextId || ""}`;
              if (visited.has(key)) return false;
              visited.add(key);

              if (targetId === componentId) return true;

              const target = this.individuals.get(targetId);
              if (!target?.installations) return false;

              for (const parentInst of target.installations) {
                // If contextId is specified, only follow that specific installation
                if (contextId && parentInst.id !== contextId) continue;

                if (
                  checkChain(
                    parentInst.targetId,
                    parentInst.scInstallationContextId
                  )
                ) {
                  return true;
                }
              }

              return false;
            };

            if (checkChain(inst.targetId, inst.scInstallationContextId)) {
              return true;
            }
          }
        }
      }
    }

    // All other cases are allowed
    // SC1 → SC2 and SC2 → SC1 as parallel installations is fine
    return false;
  }

  /**
   * Get the effective time bounds for an installation target
   * Works for both Systems and SystemComponents
   */
  getTargetTimeBounds(targetId: string): { beginning: number; ending: number } {
    const target = this.individuals.get(targetId);
    if (!target) {
      return { beginning: 0, ending: Model.END_OF_TIME };
    }

    const targetType = target.entityType ?? EntityType.Individual;
    let beginning = target.beginning >= 0 ? target.beginning : 0;
    let ending = target.ending;

    // If target is a SystemComponent, get bounds from ITS installations
    if (targetType === EntityType.SystemComponent) {
      if (target.installations && target.installations.length > 0) {
        const instBeginnings = target.installations.map((inst) =>
          Math.max(0, inst.beginning ?? 0)
        );
        const instEndings = target.installations.map(
          (inst) => inst.ending ?? Model.END_OF_TIME
        );
        beginning = Math.min(...instBeginnings);
        ending = Math.max(...instEndings);
      }
    }

    return { beginning, ending };
  }

  /**
   * Get the list of individuals to display in the diagram.
   * Handles nested SystemComponent → SystemComponent → System hierarchies.
   */
  getDisplayIndividuals(): Individual[] {
    const result: Individual[] = [];
    const processedIds = new Set<string>();

    // Helper to recursively add installations with proper context
    const addInstallationsRecursively = (
      target: Individual,
      parentPath: string,
      parentBounds: { beginning: number; ending: number },
      nestingLevel: number,
      parentInstallationId?: string
    ) => {
      const targetEntityType = target.entityType ?? EntityType.Individual;

      this.individuals.forEach((component) => {
        const entityType = component.entityType ?? EntityType.Individual;
        if (
          entityType !== EntityType.SystemComponent &&
          entityType !== EntityType.InstalledComponent
        ) {
          return;
        }

        if (!component.installations || component.installations.length === 0) {
          return;
        }

        component.installations.forEach((installation) => {
          if (installation.targetId !== target.id) return;

          // If target is a SystemComponent (nested), check context matches
          if (
            targetEntityType === EntityType.SystemComponent &&
            parentInstallationId
          ) {
            if (installation.scInstallationContextId) {
              if (
                installation.scInstallationContextId !== parentInstallationId
              ) {
                return;
              }
            }
          }

          const instStart = installation.beginning ?? 0;
          const instEnd = installation.ending ?? Model.END_OF_TIME;

          const effectiveStart = Math.max(instStart, parentBounds.beginning);
          const effectiveEnd = Math.min(
            instEnd,
            parentBounds.ending < Model.END_OF_TIME
              ? parentBounds.ending
              : instEnd
          );

          if (effectiveStart >= effectiveEnd) return;

          const virtualId = `${component.id}__installed_in__${target.id}__${installation.id}`;

          if (processedIds.has(virtualId)) return;
          processedIds.add(virtualId);

          const newPath = parentPath
            ? `${parentPath}__${target.id}`
            : target.id;

          const virtualRow: Individual = {
            ...component,
            id: virtualId,
            beginning: effectiveStart,
            ending: effectiveEnd,
            _isVirtualRow: true,
            _parentPath: newPath,
            _nestingLevel: nestingLevel,
            _installationId: installation.id,
          };

          result.push(virtualRow);

          // If this component is a SystemComponent, recursively add things installed in IT
          if (entityType === EntityType.SystemComponent) {
            addInstallationsRecursively(
              component,
              newPath,
              { beginning: effectiveStart, ending: effectiveEnd },
              nestingLevel + 1,
              installation.id
            );
          }
        });
      });
    };

    // STEP 1: Add all Systems and their nested components IN ORDER
    // This ensures virtual rows appear immediately after their parent system
    const systems: Individual[] = [];
    this.individuals.forEach((ind) => {
      const entityType = ind.entityType ?? EntityType.Individual;
      if (entityType === EntityType.System) {
        systems.push(ind);
      }
    });

    // Sort systems by name
    systems.sort((a, b) => a.name.localeCompare(b.name));

    // Add each system and IMMEDIATELY add its nested virtual rows
    systems.forEach((system) => {
      if (!processedIds.has(system.id)) {
        processedIds.add(system.id);
        result.push({
          ...system,
          _isVirtualRow: false,
          _parentPath: "",
          _nestingLevel: 0,
        });

        // Add virtual rows for this system IMMEDIATELY after the system
        const bounds = this.getTargetTimeBounds(system.id);
        addInstallationsRecursively(system, "", bounds, 1, undefined);
      }
    });

    // STEP 2: Add ALL SystemComponents at top level (those not yet added as virtual rows)
    const topLevelSCs: Individual[] = [];
    this.individuals.forEach((ind) => {
      const entityType = ind.entityType ?? EntityType.Individual;
      if (entityType === EntityType.SystemComponent) {
        if (!processedIds.has(ind.id)) {
          topLevelSCs.push(ind);
        }
      }
    });
    topLevelSCs.sort((a, b) => a.name.localeCompare(b.name));
    topLevelSCs.forEach((ind) => {
      processedIds.add(ind.id);
      result.push({
        ...ind,
        _isVirtualRow: false,
        _parentPath: "",
        _nestingLevel: 0,
      });
    });

    // STEP 3: Add ALL InstalledComponents at top level
    const topLevelICs: Individual[] = [];
    this.individuals.forEach((ind) => {
      const entityType = ind.entityType ?? EntityType.Individual;
      if (entityType === EntityType.InstalledComponent) {
        if (!processedIds.has(ind.id)) {
          topLevelICs.push(ind);
        }
      }
    });
    topLevelICs.sort((a, b) => a.name.localeCompare(b.name));
    topLevelICs.forEach((ind) => {
      processedIds.add(ind.id);
      result.push({
        ...ind,
        _isVirtualRow: false,
        _parentPath: "",
        _nestingLevel: 0,
      });
    });

    // STEP 4: Add regular Individuals
    const regularIndividuals: Individual[] = [];
    this.individuals.forEach((ind) => {
      const entityType = ind.entityType ?? EntityType.Individual;
      if (entityType === EntityType.Individual) {
        if (!processedIds.has(ind.id)) {
          regularIndividuals.push(ind);
        }
      }
    });
    regularIndividuals.sort((a, b) => a.name.localeCompare(b.name));
    regularIndividuals.forEach((ind) => {
      processedIds.add(ind.id);
      result.push({
        ...ind,
        _isVirtualRow: false,
        _parentPath: "",
        _nestingLevel: 0,
      });
    });

    // NO SORTING NEEDED - items are added in correct order:
    // 1. Sys 1 (System)
    //    - Sys comp 1 (virtual row under Sys 1)
    //      - Inst comp 1 (virtual row under Sys comp 1 under Sys 1)
    // 2. Sys 2 (System)
    //    - Sys comp 2 (virtual row under Sys 2)
    // 3. Sys comp 1 (top-level definition)
    // 4. Sys comp 2 (top-level definition)
    // 5. Inst comp 1 (top-level definition)
    // 6. Inst comp 2 (top-level definition)
    // 7. Egg, Me, Pan... (regular Individuals)

    return result;
  }

  // Helper to extract installation ID from virtual row ID
  extractInstallationIdFromVirtualId(virtualId: string): string | undefined {
    if (!virtualId.includes("__installed_in__")) return undefined;
    const parts = virtualId.split("__installed_in__");
    if (parts.length < 2) return undefined;
    let rest = parts[1];

    // Remove context suffix if present
    const ctxIndex = rest.indexOf("__ctx_");
    if (ctxIndex !== -1) {
      rest = rest.substring(0, ctxIndex);
    }

    const restParts = rest.split("__");
    // Format: targetId__installationId
    return restParts.length > 1 ? restParts[1] : undefined;
  }
}
