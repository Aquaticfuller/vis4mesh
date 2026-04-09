import { EdgeDisplay } from "display/data";

export interface AbstractNode {
  x: number;
  y: number;
  level: number;
  dataFlow: number;
  edgeData: number[];
  edgeLevel: number[];
  edgeChannelData: number[][];
  edgeChannelLevel: number[][];
}

export class AbstractLayer {
  scale: number;
  height: number;
  width: number;
  bandwidth: number;
  active_channels: number;
  physical_channels: number;
  nodeValueMax: number = 0;
  linkValueMax: number = 0;
  nodes: AbstractNode[][];
  uppers: Array<number> = new Array<number>(10).fill(0);

  constructor(
    scale: number,
    height: number,
    width: number,
    bandwidth: number,
    edges: EdgeDisplay[],
    subLayer?: AbstractLayer,
    active_channels: number = 1,
    physical_channels?: number
  ) {
    this.scale = scale;
    this.height = height;
    this.width = width;
    this.bandwidth = bandwidth;
    this.active_channels = active_channels;
    this.physical_channels = physical_channels ?? active_channels;
    this.nodes = [];
    if (scale === 1) {
      this.nodes = this.buildFromFlatData(height, width, edges);
    } else {
      this.buildFromPrecedingLayer(subLayer!);
    }
    this.initLinearNormalize();
  }

  buildFromPrecedingLayer(subLayer: AbstractLayer) {
    this.active_channels = subLayer.active_channels;
    this.physical_channels = subLayer.physical_channels;
    const numChannels = this.active_channels;

    for (let i = 0; i < this.height; i++) {
      let row: AbstractNode[] = [];
      for (let j = 0; j < this.width; j++) {
        let value: number[] = [0, 0, 0, 0];
        let channelValue: number[][] = new Array(4)
          .fill(0)
          .map(() =>
            numChannels > 0 ? new Array(numChannels).fill(0) : new Array<number>()
          );
        let si = i * 4;
        let sj = j * 4;
        let sum = 0;
        for (let k = sj; k < sj + 4; k++) {
          sum += subLayer.nodes[si + 3][k].edgeData[0];
          if (numChannels > 0) {
            const subData = subLayer.nodes[si + 3][k].edgeChannelData[0] || [];
            for (let ch = 0; ch < numChannels; ch++) {
              channelValue[0][ch] += subData[ch] ?? 0;
            }
          }
        }
        value[0] = sum;

        sum = 0;
        for (let k = sj; k < sj + 4; k++) {
          sum += subLayer.nodes[si][k].edgeData[1];
          if (numChannels > 0) {
            const subData = subLayer.nodes[si][k].edgeChannelData[1] || [];
            for (let ch = 0; ch < numChannels; ch++) {
              channelValue[1][ch] += subData[ch] ?? 0;
            }
          }
        }
        value[1] = sum;

        sum = 0;
        for (let k = si; k < si + 4; k++) {
          sum += subLayer.nodes[k][sj + 3].edgeData[2];
          if (numChannels > 0) {
            const subData = subLayer.nodes[k][sj + 3].edgeChannelData[2] || [];
            for (let ch = 0; ch < numChannels; ch++) {
              channelValue[2][ch] += subData[ch] ?? 0;
            }
          }
        }
        value[2] = sum;

        sum = 0;
        for (let k = si; k < si + 4; k++) {
          sum += subLayer.nodes[k][sj].edgeData[3];
          if (numChannels > 0) {
            const subData = subLayer.nodes[k][sj].edgeChannelData[3] || [];
            for (let ch = 0; ch < numChannels; ch++) {
              channelValue[3][ch] += subData[ch] ?? 0;
            }
          }
        }
        value[3] = sum;

        //prepare for linear normalization
        for (let x of value) {
          this.linkValueMax = Math.max(this.linkValueMax, x);
        }
        sum = value[0] + value[1] + value[2] + value[3];
        this.nodeValueMax = Math.max(this.nodeValueMax, sum);
        row.push({
          x: i,
          y: j,
          dataFlow: sum,
          level: 0,
          edgeData: value,
          edgeLevel: [0, 0, 0, 0],
          edgeChannelData: channelValue,
          edgeChannelLevel: new Array(4)
            .fill(0)
            .map(() =>
              numChannels > 0
                ? new Array(numChannels).fill(0)
                : new Array<number>()
            ),
        });
      }
      this.nodes.push(row);
    }
  }

  buildFromFlatData(
    height: number,
    width: number,
    edges: EdgeDisplay[]
  ): AbstractNode[][] {
    let nodes: AbstractNode[][] = [];
    for (let i = 0; i < height; i++) {
      let row: AbstractNode[] = [];
      for (let j = 0; j < width; j++) {
        let value: number[] = [0, 0, 0, 0];
        const zeroChannels = new Array(this.physical_channels).fill(0);
        row.push({
          x: i,
          y: j,
          dataFlow: 0,
          level: 0,
          edgeData: value,
          edgeLevel: [0, 0, 0, 0],
          edgeChannelData: [
            [...zeroChannels],
            [...zeroChannels],
            [...zeroChannels],
            [...zeroChannels],
          ],
          edgeChannelLevel: [
            new Array(this.physical_channels).fill(0),
            new Array(this.physical_channels).fill(0),
            new Array(this.physical_channels).fill(0),
            new Array(this.physical_channels).fill(0),
          ],
        });
      }
      nodes.push(row);
    }
    // S N E W
    for (let edge of edges) {
      // deal with flat structre,  a better idea: the order is specific
      let x = Math.floor(parseInt(edge.source) / width);
      let y = parseInt(edge.source) % width;
      let dx = Math.floor(parseInt(edge.target) / width);
      let dy = parseInt(edge.target) % width;
      let dir = -1;
      if (dx === x + 1) {
        nodes[x][y].edgeData[0] = edge.weight;
        dir = 0;
      } else if (dx === x - 1) {
        nodes[x][y].edgeData[1] = edge.weight;
        dir = 1;
      } else if (dy === y + 1) {
        nodes[x][y].edgeData[2] = edge.weight;
        dir = 2;
      } else {
        nodes[x][y].edgeData[3] = edge.weight;
        dir = 3;
      }
      if (dir >= 0 && edge.channelWeights !== undefined) {
        const chArr = new Array(this.physical_channels).fill(0);
        edge.channelWeights.forEach((v, idx) => {
          if (idx < chArr.length) chArr[idx] = v;
        });
        nodes[x][y].edgeChannelData[dir] = chArr;
        this.physical_channels = Math.max(
          this.physical_channels,
          edge.channelWeights.length
        );
        nodes[x][y].edgeChannelLevel[dir] = chArr.map(() => 0);
      }
      nodes[x][y].dataFlow += edge.weight;
      // this.linkValueMax = Math.max(this.linkValueMax, edge.weight);
    }
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        this.nodeValueMax = Math.max(this.nodeValueMax, nodes[i][j].dataFlow);
      }
    }
    return nodes;
  }

  initLinearNormalize() {
    // Find the observed maximum across all edges and channels to use as the
    // normalization denominator.  The theoretical bandwidth (timeRange * channels
    // * cycles_per_slice) can be orders of magnitude larger than real traffic,
    // which collapses the entire color range to level-0 (blue).  Using the
    // observed max gives a meaningful blue→green→yellow→red gradient.
    let observedEdgeMax = 0;
    let observedChannelMax = 0;
    for (let row of this.nodes) {
      for (let node of row) {
        for (let i = 0; i < 4; i++) {
          observedEdgeMax = Math.max(observedEdgeMax, node.edgeData[i]);
          if (node.edgeChannelData[i]) {
            for (const v of node.edgeChannelData[i]) {
              observedChannelMax = Math.max(observedChannelMax, v);
            }
          }
        }
      }
    }
    // Use the larger of observed max (with 10% headroom) and 1 to avoid div-by-zero.
    // Fall back to theoretical bandwidth only when traffic is truly zero.
    const effectiveBandwidth = observedEdgeMax > 0
      ? observedEdgeMax * 1.1
      : this.bandwidth;
    const effectiveChannelBW = observedChannelMax > 0
      ? observedChannelMax * 1.1
      : (this.active_channels > 0
          ? this.bandwidth / this.active_channels
          : this.bandwidth);

    const clampLevel = (v: number, denom: number) =>
      Math.min(9, Math.floor((v * 10) / Math.max(denom, 1)));
    for (let row of this.nodes) {
      for (let node of row) {
        // calc node level
        if (this.nodeValueMax != 0) {
          node.level = clampLevel(node.dataFlow / 4, effectiveBandwidth);
        }
        // calc link level
        for (let i = 0; i < 4; i++) {
          let val = node.edgeData[i];
          node.edgeLevel[i] = clampLevel(val, effectiveBandwidth);
          if (
            node.edgeChannelData[i] !== undefined &&
            node.edgeChannelData[i].length > 0
          ) {
            node.edgeChannelLevel[i] = node.edgeChannelData[i].map((v) =>
              clampLevel(v, effectiveChannelBW)
            );
          }
        }
      }
    }
    this.uppers.forEach((u, i) => {
      this.uppers[i] = Math.floor(((i + 1) * effectiveBandwidth) / 10);
    });
  }
}

export function BuildAbstractLayers(
  tile_width: number,
  tile_height: number,
  init_scale: number,
  rangedEdges: EdgeDisplay[],
  timeRange: number,
  active_channels: number,
  cycles_per_slice: number,
  physical_channels?: number
): AbstractLayer[] {
  let buildStart = performance.now();
  let layers: AbstractLayer[] = [];
  const active_channels_safe = Math.max(active_channels, 1);
  const physical_channels_safe =
    physical_channels ?? active_channels_safe;
  let bandwidth = timeRange * active_channels_safe * cycles_per_slice;
  let start = performance.now();
  layers.push(
    new AbstractLayer(
      1,
      tile_height,
      tile_width,
      bandwidth,
      rangedEdges,
      undefined,
      active_channels_safe,
      physical_channels_safe
    )
  );
  let end = performance.now();
  // console.log(`build from source edgeData: time spent ${end - start}ms`);
  console.log("init_scale", init_scale);
  for (let i = 4; i <= init_scale; i *= 4) {
    bandwidth *= 4;
    let start = performance.now();
    let layer = new AbstractLayer(
      i,
      tile_height / i,
      tile_width / i,
      bandwidth,
      [],
      layers[layers.length - 1],
      active_channels_safe,
      physical_channels_safe
    );
    layers.push(layer);
    let end = performance.now();
  }
  let buildEnd = performance.now();
  console.log(`build layers: time spent ${buildEnd - buildStart}ms`);
  return layers;
}
