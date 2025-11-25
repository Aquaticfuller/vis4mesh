import {
  RectNode,
  LineLink,
  LinkText,
  RectCornerRadius,
  ArrowWidth,
} from "./common";
import TooltipInteraction from "./interaction/tooltip";
import ClickInteraction from "./interaction/click";
import InfoPanel, { InfoRow } from "./interaction/infopanel";
import {
  ColorScheme,
  GetLinkDst,
  GetRectIdentity,
  GetLineIdentity,
  DirectionOffset,
} from "./util";
import { MainView } from "./graph";
import Minimap from "./minimap";
import sidecanvas from "./interaction/sidecanvas";
import * as d3 from "d3";
import selector from "widget/daisen";
import { NodeCaption } from "./common";
import { CompressBigNumber } from "controller/module/filtermsg";

const node_rim_color = "#599dbb"; // #599dbb
const directionNames = ["South", "North", "East", "West"];

export class Render {
  mainview: MainView;
  pinMap: Map<
    string,
    d3.Selection<SVGCircleElement, unknown, HTMLElement, any>
  >;
  readonly grid = d3.select("#graph").append("svg").append("g");

  constructor(mainview: MainView) {
    this.mainview = mainview;
    d3.select("#graph")
      .select("svg")
      .on("click", () => ClickInteraction.reset());
    this.grid
      .append("svg:defs")
      .selectAll("marker")
      .data(["end"]) // different link/path types can be defined here
      .enter()
      .append("svg:marker") // this section adds in the arrows
      .attr("id", String)
      .attr("viewBox", "0 -5 10 10")
      .attr("refY", 0)
      .attr("markerWidth", ArrowWidth)
      .attr("markerHeight", ArrowWidth)
      .attr("orient", "auto")
      .append("svg:path")
      .attr("d", "M0,-5L10,0L0,5");

    this.pinMap = new Map();
  }

  SetPins(level: number) {
    let op = 0;
    if (level === 0) {
      op = 1;
    }
    for (let [x, y] of this.pinMap) {
      y.attr("opacity", op).raise();
    }
  }

  Transform(transform: string) {
    this.grid.attr("transform", transform);
  }

  draw_rect(nodes: RectNode[]) {
    const mainview = this.mainview;
    const renderer = this;
    this.grid
      .selectAll<SVGSVGElement, RectNode>("rect")
      .data<RectNode>(nodes, (d) => GetRectIdentity(d))
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("x", (d) => d.x)
            .attr("y", (d) => d.y)
            .attr("rx", (d) => RectCornerRadius * d.size)
            .attr("ry", (d) => RectCornerRadius * d.size)
            .attr("width", (d) => d.size)
            .attr("height", (d) => d.size)
            .attr("fill", (d) => d.color)
            .attr("stroke", node_rim_color)
            .attr("stroke-width", (d) => d.scale * 0.02),
        (update) =>
          update
            .transition()
            .duration(245)
            .attr("x", (d) => d.x)
            .attr("y", (d) => d.y)
            .attr("rx", (d) => RectCornerRadius * d.size)
            .attr("ry", (d) => RectCornerRadius * d.size)
            .attr("width", (d) => d.size)
            .attr("height", (d) => d.size)
            .attr("fill", (d) => d.color)
            .attr("stroke", node_rim_color)
            .attr("stroke-width", (d) => d.scale * 0.02),
        (exit) => exit.remove()
      )
      .on("mouseover", function (ev, d) {
        const sel = d3.select(this);
        sel.attr("fill", node_rim_color);
        sel.style("cursor", "pointer");
        if (d.level > 0) {
          return;
        }
        sel.append("title").text(`Tile_${d.idx}_${d.idy}`);
        // TooltipInteraction.onNode(nodeMap[d.id]);
      })
      .on("mousemove", function (ev) {
        // TooltipInteraction.move([ev.pageX, ev.pageY]);
      })
      .on("mouseout", function (ev, d) {
        const sel = d3.select(this);
        if (sel.property("checked") !== true) {
          sel.attr("fill", d.color);
          sel.style("cursor", "default");
        }
        // TooltipInteraction.hide();
        sel.select("title").remove();
      })
      .on("click", function (ev, d) {
        ev.stopPropagation();

        const sel = d3.select(this);
        mainview.click_node_jump(ev, d);
        if (d.level === 0) {
          const nodeInfo = renderer.nodeInfoRows(d);
          InfoPanel.show(`Node Tile_${d.idx}_${d.idy}`, nodeInfo);
        }
        ClickInteraction.onNode(
          d.level,
          `Tile_${d.idx}_${d.idy}`,
          () => {
            sel.attr("fill", node_rim_color);
            sel.property("checked", true);
            mainview.register_rect_color(d, node_rim_color);
            selector.register_ep([d.idx, d.idy]);
          },
          () => {
            sel.attr("fill", d.color);
            sel.property("checked", false);
            mainview.register_rect_color(d);
            selector.unset_ep();
          }
        );
      });
  }

  draw_captions(captions: NodeCaption[]) {
    this.grid
      .selectAll(".node-caption")
      .data(captions)
      .join(
        function (enter) {
          return enter.append("text");
        },
        function (update) {
          return update;
        },
        function (exit) {
          return exit.remove();
        }
      )
      .attr("class", "node-caption")
      .style("text-anchor", "middle")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("font-family", "SanFrancisco")
      .style("fill", "gray")
      .text((d) => d.text)
      .style("font-size", (d) => d.size)
      .raise();
  }

  draw_line(lines: LineLink[], minimap: Minimap) {
    const mainview = this.mainview;
    const renderer = this;
    const grid = this.grid;
    let pinMap = this.pinMap;
    // console.log(lines);
    this.grid
      .selectAll<SVGSVGElement, LineLink>("line")
      .data<LineLink>(lines, (l: LineLink) => GetLineIdentity(l))
      .join(
        function (enter) {
          return enter
            .append("line")
            .attr("marker-end", "url(#end)")
            .attr("stroke-width", (d) => d.width);
        },
        function (update) {
          return update;
        },
        function (exit) {
          return exit.remove();
        }
      )
      .attr("x1", (d) => d.x1)
      .attr("x2", (d) => d.x2)
      .attr("y1", (d) => d.y1)
      .attr("y2", (d) => d.y2)
      .attr("opacity", (d) => d.opacity)
      // .attr("stroke-dasharray", (d) => d.dasharray)
      .attr("stroke", (d) => ColorScheme(d.colorLevel))
      .on("mouseover", function (ev, d) {
        const sel = d3.select(this);
        sel.attr("stroke-width", d.width * 1.5);
        sel.style("cursor", "pointer");
        const [src, dst] = d.connection;
        const channelLabel = d.channel !== undefined ? ` (CH${d.channel})` : "";
        if (d.level > 0) {
          return;
        }
        let dstNode = GetLinkDst([d.idx, d.idy], d.direction);
        sel
          .append("title")
          .text(`Tile_${d.idx}_${d.idy} ---> ${dstNode}${channelLabel}`);
        // TooltipInteraction.onEdge([nodeMap[src], nodeMap[dst]]);
      })
      .on("mousemove", function (ev) {
        // TooltipInteraction.move([ev.pageX, ev.pageY]);
      })
      .on("mouseout", function (ev, d) {
        const sel = d3.select(this);
        if (sel.property("checked") !== true) {
          sel.attr("stroke-width", d.width);
          sel.style("cursor", "default");
        }
        sel.select("title").remove();
        // TooltipInteraction.hide();
      })
      .on("click", function (ev, d) {
        const sel = d3.select(this);
        const [src, dst] = d.connection;
        let dstNode = GetLinkDst([d.idx, d.idy], d.direction);
        const channelLabel = d.channel !== undefined ? ` (CH${d.channel})` : "";
        const channelId = d.channel !== undefined ? `_ch${d.channel}` : "";
        // Link info panel
        const layerNode =
          mainview.layers[mainview.level].nodes[d.idx][d.idy];
        InfoPanel.show(
          `Link ${d.connection[0]} -> ${d.connection[1]}${channelLabel}`,
          renderer.linkInfoRows(d, layerNode.edgeChannelData?.[d.direction])
        );

        ClickInteraction.onEdge(
          d.level,
          `Tile_${d.idx}_${d.idy} ---> ${dstNode}${channelLabel}`,
          function () {
            if (d.level === 0 && d.opacity !== 0) {
              let pin = grid.append("circle");
              let edgeName = `${d.connection[0]}to${d.connection[1]}${channelId}`;
              let removePins = () => {
                pin.remove();
                minimap.RemovePin([d.idx, d.idy]);
                pinMap.delete(edgeName);
              };
              sidecanvas.AddLinkHistogram(
                edgeName,
                (color: string) => {
                  minimap.AddPin([d.idx, d.idy], color, () => {
                    mainview.click_edge_jump(ev, d);
                  });
                  let [cx, cy] = DirectionOffset(
                    [d.x1, d.y1],
                    d.direction,
                    0.2
                  );
                  pin
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", 0.04)
                    .attr("fill", color)
                    .on("mouseover", () => {
                      pin.attr("r", 0.06).style("cursor", "pointer");
                    })
                    .on("mouseout", () => {
                      pin.attr("r", 0.04).style("cursor", "default");
                    })
                    .on("click", () => {
                      sidecanvas.checkoutLink("stacked-chart-" + edgeName);
                      removePins();
                    });
                  pinMap.set(edgeName, pin);
                },
                removePins,
                () => {
                  mainview.click_edge_jump(ev, d);
                },
                () => {
                  pin.attr("r", 0.06);
                },
                () => {
                  pin.attr("r", 0.04);
                }
              );
            }
            sel.attr("stroke-width", d.width * 1.5);
            sel.property("checked", true);
          },
          function () {
            console.log("clear click on edge");
            sel.attr("stroke-width", d.width);
            sel.property("checked", false);
          }
        );
        mainview.click_edge_jump(ev, d);
        ev.stopPropagation();
      });
  }

  private linkInfoRows(d: LineLink, channelData?: number[]): InfoRow[] {
    const range = this.mainview.timeRange;
    const rows: InfoRow[] = [];
    rows.push({ label: "Direction", value: directionNames[d.direction] });
    rows.push({
      label: "Channel",
      value:
        d.channel !== undefined ? d.channel : "aggregate (all channels)",
    });
    rows.push({ label: "From", value: d.connection[0] });
    rows.push({ label: "To", value: d.connection[1] });
    rows.push({
      label: "Time frame",
      value: `${range.start} → ${range.end}`,
    });
    rows.push({
      label: "Flits",
      value: CompressBigNumber(d.value),
    });
    rows.push({ label: "Level", value: d.colorLevel });
    if (channelData && channelData.length > 0) {
      const perChannel = channelData
        .map((v, i) => `CH${i}: ${CompressBigNumber(v)}`)
        .join(", ");
      rows.push({ label: "Per-channel", value: perChannel });
    }
    rows.push({ label: "Display mode", value: this.mainview.linkDisplayMode });
    return rows;
  }

  private nodeInfoRows(d: RectNode): InfoRow[] {
    const layer = this.mainview.layers[this.mainview.level];
    const node = layer.nodes[d.idx][d.idy];
    const incoming = this.incomingEdgeData(layer, d.idx, d.idy);
    const outgoing = node.edgeData;
    const totalOut = outgoing.reduce((a, b) => a + b, 0);
    const totalIn = incoming.reduce((a, b) => a + b, 0);
    const range = this.mainview.timeRange;

    const rows: InfoRow[] = [];
    rows.push({ label: "Node ID", value: `Tile_${d.idx}_${d.idy}` });
    rows.push({ label: "Position", value: `x=${d.idx}, y=${d.idy}` });
    rows.push({
      label: "Time frame",
      value: `${range.start} → ${range.end}`,
    });
    rows.push({ label: "Total out", value: CompressBigNumber(totalOut) });
    rows.push({ label: "Total in", value: CompressBigNumber(totalIn) });
    directionNames.forEach((dirName, idx) => {
      rows.push({
        label: `Out ${dirName}`,
        value: CompressBigNumber(outgoing[idx]),
      });
      rows.push({
        label: `In ${dirName}`,
        value: CompressBigNumber(incoming[idx]),
      });
    });
    return rows;
  }

  private incomingEdgeData(
    layer: any,
    x: number,
    y: number
  ): number[] {
    const incoming = [0, 0, 0, 0]; // S,N,E,W incoming flits
    // from South -> neighbor at x+1, its North (1)
    if (x + 1 < layer.height) incoming[0] = layer.nodes[x + 1][y].edgeData[1];
    // from North -> neighbor at x-1, its South (0)
    if (x - 1 >= 0) incoming[1] = layer.nodes[x - 1][y].edgeData[0];
    // from East -> neighbor at y+1, its West (3)
    if (y + 1 < layer.width) incoming[2] = layer.nodes[x][y + 1].edgeData[3];
    // from West -> neighbor at y-1, its East (2)
    if (y - 1 >= 0) incoming[3] = layer.nodes[x][y - 1].edgeData[2];
    return incoming;
  }

  draw_text(texts: LinkText[], rect_size: number) {
    let fontsize = rect_size * 0.1;
    this.grid
      .selectAll(".edge-label")
      .data(texts)
      .join(
        function (enter) {
          return enter
            .append("text")
            .attr("class", "edge-label")
            .attr("dy", ".35em")
            .attr("dominant-baseline", "middle");
        },
        function (update) {
          return update;
        },
        function (exit) {
          return exit.remove();
        }
      )
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("opacity", (d) => d.opacity)
      .style("fill", "gray")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("transform", (d) =>
        d.angle ? `rotate(${d.angle}, ${d.x}, ${d.y})` : null
      )
      .text((d) => d.label)
      .style("font-size", fontsize)
      .raise();
  }
}
