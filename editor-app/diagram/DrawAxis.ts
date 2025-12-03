import { ConfigData } from "./config";
import { DrawContext } from "./DrawHelpers";

export function drawAxisArrows(ctx: DrawContext, viewPortHeight: number) {
  // Axis arrows are now rendered as fixed overlays in the React component
  // This function is kept for API compatibility but does nothing
  return;
}

// New function to get axis configuration for the fixed overlay
export function getAxisConfig(config: ConfigData, viewPortHeight: number) {
  return {
    margin: config.presentation.axis.margin,
    endMargin: config.presentation.axis.endMargin,
    width: config.presentation.axis.width,
    colour: config.presentation.axis.colour,
    textOffsetX: config.presentation.axis.textOffsetX,
    textOffsetY: config.presentation.axis.textOffsetY,
    viewPortWidth: config.viewPort.x * config.viewPort.zoom,
    viewPortHeight,
  };
}
