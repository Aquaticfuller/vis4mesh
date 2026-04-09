// Channel group definition: a named toggle that controls a range of channels.
// Example: { "name": "Wide Req", "channels": [0,1,2,...,31] }
export interface ChannelGroup {
  name: string;
  channels: number[];
}

export interface MetaData {
  width: number;
  height: number;
  slice: number;
  elapse: number;
  hops_per_unit: number;
  num_hop_units: number;
  num_channels: number;
  channel_labels?: string[];
  // Optional grouping of channels for bulk toggle buttons (e.g. Req vs Resp).
  // If absent, auto-inferred from channel_labels prefixes when possible.
  channel_groups?: ChannelGroup[];
}

export interface NodeData {
  id: string;
  label?: string;
  detail: string;
}

export interface EdgeData {
  source: string;
  target: string;
  value: number[];
  label?: string;
  detail: string;
}

export interface SnapShotData {
  id: number; // frame ID
  type: string; // message type
  group: string; // group of the certain message type, e.g. Read, Write
  doc: string; // data or command message, e.g. D, C
  count: number; // count of the certain message type during this frame
  max_flits: number; // maximum channel flit number of the mesh at certain time
  hop_units: number;
  transfer_type: number;
}

export type FlatData = SnapShotData[];

export type DataPortMetaResponse = MetaData;
export type DataPortFlatResponse = FlatData;
export interface DataPortRangeResponse {
  meta: MetaData; // metadata contains graph size, definition of time slice, etc
  nodes: NodeData[];
  edges: EdgeData[];
}
