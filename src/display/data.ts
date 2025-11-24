export interface NodeDisplay {
  id: string;
  label?: string;
  detail: string;
}

export interface EdgeDisplay {
  source: string;
  target: string;
  weight: number;
  channelWeights?: number[];
  label: string;
  detail: string;
}

export interface DataToDisplay {
  meta: Object;
  nodes: NodeDisplay[];
  edges: EdgeDisplay[];
}
