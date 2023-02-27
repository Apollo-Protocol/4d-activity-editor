export function drawAxisArrows(
  config: any,
  svgElement: any,
  viewPortHeight: number
) {
  //Define arrow head
  svgElement
    .append("svg:defs")
    .attr("class", "axisTriangle")
    .append("svg:marker")
    .attr("id", "triangle")
    .attr("refX", 0)
    .attr("refY", 10)
    .attr("markerWidth", 20)
    .attr("markerHeight", 20)
    .attr("markerUnits", "userSpaceOnUse")
    .attr("orient", "auto")
    .attr("viewbox", "0 0 20 20")
    .append("path")
    .attr("d", "M 0 0 L 20 10 L 0 20 z")
    .style("fill", config.presentation.axis.colour);

  //X Axis arrow
  svgElement
    .append("line")
    .attr("class", "axisLine")
    .attr("x1", config.presentation.axis.margin)
    .attr("y1", viewPortHeight - config.presentation.axis.margin)
    .attr(
      "x2",
      config.viewPort.x * config.viewPort.zoom -
        config.presentation.axis.endMargin
    )
    .attr("y2", viewPortHeight - config.presentation.axis.margin)
    .attr("marker-end", "url(#triangle)")
    .attr("stroke", config.presentation.axis.colour)
    .attr("stroke-width", config.presentation.axis.width);

  //X Axis text
  svgElement
    .append("text")
    .attr("class", "axisLable")
    .attr(
      "x",
      (config.viewPort.x * config.viewPort.zoom) / 2 -
        config.presentation.axis.endMargin
    )
    .attr(
      "y",
      viewPortHeight -
        config.presentation.axis.margin +
        config.presentation.axis.textOffsetX
    )
    .attr("stroke", "white")
    .attr("fill", "white")
    .attr("font-size", "0.8em")
    .attr("font-weight", "200")
    .attr("text-anchor", "start")
    .attr("font-family", "Roboto, Arial, sans-serif")
    .text("Time");

  //Y Axis arrow
  svgElement
    .append("line")
    .attr("class", "axisLine")
    .attr("x1", config.presentation.axis.margin)
    .attr(
      "y1",
      viewPortHeight -
        config.presentation.axis.margin +
        config.presentation.axis.width / 2
    )
    .attr("x2", config.presentation.axis.margin)
    .attr("y2", config.presentation.axis.endMargin)
    .attr("marker-end", "url(#triangle)")
    .attr("stroke", config.presentation.axis.colour)
    .attr("stroke-width", config.presentation.axis.width);

  //Y Axis text
  svgElement
    .append("text")
    .attr("class", "axisLable")
    .attr(
      "x",
      config.presentation.axis.margin * 2 + config.presentation.axis.textOffsetY
    )
    .attr("y", viewPortHeight / 2 + config.presentation.axis.margin)
    .attr("stroke", "white")
    .attr("fill", "white")
    .attr("font-size", "0.8em")
    .attr("font-weight", "200")
    .attr("text-anchor", "middle")
    .attr("font-family", "Roboto, Arial, sans-serif")
    .attr(
      "transform",
      "rotate(270 " +
        (config.presentation.axis.margin +
          config.presentation.axis.textOffsetY) +
        " " +
        (viewPortHeight / 2 + config.presentation.axis.margin) +
        ")"
    )
    .text("Space");
}
