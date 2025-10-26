import DataPort from "./dataport";

import { MsgTypes, DataOrCommandMap, MsgGroupsMap } from "./classification";
import {
  MetaData,
  NodeData,
  EdgeData,
  FlatData,
  SnapShotData,
} from "./data";

import { FileLoader } from "./fileloader";
import { directoryOpen } from "browser-fs-access";

export default class LocalDataPort extends DataPort {
  protected loader!: FileLoader;
  protected meta!: MetaData;
  protected overview!: FlatData;
  protected nodes!: NodeData[];

  constructor() {
    super();
  }

  protected async initData(dataType: string) {
    const content = await this.loader.getFileContent(dataType);
    if (content === undefined) {
      throw new Error("Unreachable code of getFileContent");
    }
    return content;
  }

  /**
   * Build an all-zero EdgeData[] using the shape of the first available edge file.
   * Falls back to zeroing that shape so value vectors have the correct length/order.
   */
  protected async edgeEmptyData(): Promise<EdgeData[]> {
    // try to use slice 0 as template
    try {
      const t = JSON.parse(
        await this.loader.getEdgeFileContent(0)
      ) as EdgeData[];
      const zeros = new Array<number>(t[0].value.length).fill(0);
      t.forEach((edge) => {
        edge.value = zeros.slice(); // per-edge clone
      });
      return t;
    } catch (_) {
      // As a last resort, synthesize an empty list from meta/nodes if no edge file exists at all
      // (rare: only if edge_prefix_sum is totally empty)
      const edges: EdgeData[] = [];
      // Build a grid and connect only 4-neighbors (N/E/S/W) with zero vectors
      const W = this.meta.width;
      const H = this.meta.height;
      const VLEN = 4 * this.meta.num_hop_units * MsgTypes.length; // tt(4) * hops * msg_types
      const zeros = new Array<number>(VLEN).fill(0);
      const inRange = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const id = y * W + x;
          const nbrs = [
            [x, y + 1],
            [x + 1, y],
            [x, y - 1],
            [x - 1, y],
          ];
          for (const [nx, ny] of nbrs) {
            if (inRange(nx, ny)) {
              const nid = ny * W + nx;
              edges.push({
                source: String(id),
                target: String(nid),
                value: zeros.slice(),
                detail: `${id}->${nid}`,
              });
            }
          }
        }
      }
      return edges;
    }
  }

  /**
   * Ensure flat overview has slices [0, elapse-1], inserting zero-count
   * records for missing slices and missing message-types within existing slices.
   */
  protected densifyOverview(): void {
    const elapse = Number(this.meta.elapse);
    // Normalize ids to numbers and group by slice
    const bySlice = new Map<number, SnapShotData[]>();
    for (const rec of this.overview) {
      (rec as any).id = Number((rec as any).id);
      const sid = (rec as any).id as number;
      const list = bySlice.get(sid) ?? [];
      list.push(rec);
      bySlice.set(sid, list);
    }

    // Build zero templates per msg type using classification maps
    const zeroOf = (sid: number, msgType: string): SnapShotData => ({
      id: sid,
      type: msgType,
      group: (MsgGroupsMap as any)[msgType] ?? "Others",
      doc: (DataOrCommandMap as any)[msgType] ?? "C",
      count: 0,
      max_flits: 0,
      hop_units: 0,
      transfer_type: 1, // Relay as neutral default; timebar uses count
    });

    const dense: SnapShotData[] = [];
    for (let s = 0; s < elapse; s++) {
      const have = bySlice.get(s) ?? [];
      if (have.length === 0) {
        // Entire slice missing: add zeros for all MsgTypes
        for (const mt of MsgTypes) dense.push(zeroOf(s, mt));
      } else {
        // Keep existing
        dense.push(...have);
        // Also add zeros for any missing MsgTypes within this slice (keeps stacked bars consistent)
        const present = new Set(have.map((r) => r.type));
        for (const mt of MsgTypes) {
          if (!present.has(mt)) dense.push(zeroOf(s, mt));
        }
      }
    }

    // Sort by slice, then (stable) by type to keep deterministic layout
    dense.sort((a, b) => (a.id as number) - (b.id as number));
    this.overview = dense as FlatData;
  }

  async init() {
    // open a directory picked by the user
    const dirEntries = await directoryOpen({ recursive: true });

    this.loader = new FileLoader(dirEntries);
    // load lightweight file handles of all edge files at once
    await this.loader.getEdgeFiles();

    try {
      this.meta = JSON.parse(await this.initData("meta")) as MetaData;
      this.overview = JSON.parse(await this.initData("flat")) as FlatData;
      this.nodes = JSON.parse(await this.initData("nodes")) as NodeData[];

      // Normalize & order flat by numeric id
      this.overview.forEach((d: any) => {
        d.id = Number(d.id);
      });
      this.overview.sort((a: any, b: any) => a.id - b.id);

      // --- key change: ensure zero slices are present up to meta.elapse ---
      this.densifyOverview();
    } catch (err) {
      console.error(err);
    }
    return this.meta;
  }

  async flat() {
    return this.overview;
  }

  async snapshotByEdge(edgeName: string) {
    // return per-edge history (not used by timebar)
    const history = await this.loader.getEdgeSnapshot(edgeName);
    if (history === "") return undefined;
    const flat = JSON.parse(history) as FlatData;
    for (let i of flat) {
      (i as any).count /= 20; // keeps legacy demo behavior; adjust if undesired
    }
    return flat;
  }

  async range(start: number, end: number) {
    // console.log(start, end);
    console.log("range2:", [start, end]);
    if (start == 0 && end == 0) {
      return {
        meta: this.meta,
        nodes: this.nodes,
        edges: await this.edgeEmptyData(), // empty initial view
      };
    } else if (end > this.meta.elapse || start >= end || start < 0) {
      throw new Error("Exceeded range in DataPort when calling `range`");
    } else {
      // Try to read the end frame; if missing, return zeros (so graph displays but shows no traffic)
      let edges: EdgeData[];
      try {
        edges = JSON.parse(
          await this.loader.getEdgeFileContent(end - 1) // [start, end)
        ) as EdgeData[];
      } catch (_) {
        edges = await this.edgeEmptyData();
      }

      const numEdges = edges.length;
      const numMsgTypes = MsgTypes.length;
      const stride = 4 * this.meta.num_hop_units * numMsgTypes;

      if (start != 0) {
        // subtract prefix at (start - 1); if that file is missing, treat it as zeros
        try {
          const redundant = JSON.parse(
            await this.loader.getEdgeFileContent(start - 1)
          ) as EdgeData[];
          for (let i = 0; i < numEdges; i++) {
            const ev = edges[i].value;
            const rv = redundant[i]?.value || new Array<number>(stride).fill(0);
            for (let j = 0; j < stride; j++) ev[j] -= rv[j] || 0;
          }
        } catch (_) {
          // nothing to subtract; it's already a delta against zero
        }
      }

      // console.log(edges);
      return { meta: this.meta, nodes: this.nodes, edges: edges };
    }
  }
}
