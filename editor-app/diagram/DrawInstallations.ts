import { DrawContext, keepIndividualLabels } from "./DrawHelpers";
import { EntityType, Installation, Individual } from "@/lib/Schema";
import { Model } from "@/lib/Model";

// Helper to check if this is an "installation reference" (virtual row)
function isInstallationRef(ind: Individual): boolean {
  return ind.id.includes("__installed_in__");
}

// Get the original ID from an installation reference
function getOriginalId(ind: Individual): string {
  if (isInstallationRef(ind)) {
    return ind.id.split("__installed_in__")[0];
  }
  return ind.id;
}

// Get the slot ID from an installation reference
function getSlotId(ind: Individual): string | undefined {
  if (isInstallationRef(ind)) {
    const parts = ind.id.split("__installed_in__")[1];
    if (parts) {
      const subParts = parts.split("__");
      return subParts[0];
    }
  }
  return undefined;
}

// Get the installation ID from an installation reference
function getInstallationId(ind: Individual): string | undefined {
  if (isInstallationRef(ind)) {
    const parts = ind.id.split("__installed_in__")[1];
    if (parts) {
      const subParts = parts.split("__");
      return subParts[1];
    }
  }
  return ind._installationId;
}

export function drawInstallations(ctx: DrawContext) {
  // Hatch overlay removed — legend icons indicate installed status.
  // This function intentionally left as a no-op to avoid drawing hatch patterns.
  return;
}
