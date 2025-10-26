import * as d3 from "d3";
import { DataPortFlatResponse, FlatData } from "data/data";
import StackedChart from "widget/standalone/stackchart";
import { SVGSelection, StackBarOptions } from "widget/standalone/stackchart";
import {
  DataOrCommandDomain,
  MsgGroupsDomain,
  NumMsgGroups,
} from "data/classification";
import { Component, Element, Module } from "global";
import Event from "event";

const ev = {
  MsgGroup: "FilterMsgGroup",
  DataOrCommand: "FilterDoC",
};

const div = d3.select("#timebar-body");

// ==== Stable colors by name (no flipping) =====================
const GROUP_COLORS: Record<string, string> = {
  Read: "#2b83ba",
  Write: "#d7191c",
  Others: "#fdae61",
  Translation: "#9e9e9e",
};

const DOC_COLORS: Record<string, string> = {
  D: "#2b83ba",
  C: "#d7191c",
};

// Hide “Translation” on the timebar
const TIMEBAR_GROUP_DOMAIN = MsgGroupsDomain.filter((g) => g !== "Translation");
const TIMEBAR_GROUP_COLORS = TIMEBAR_GROUP_DOMAIN.map(
  (g) => GROUP_COLORS[g] ?? "#999999"
);

const TIMEBAR_DOC_DOMAIN = DataOrCommandDomain.slice();
const TIMEBAR_DOC_COLORS = TIMEBAR_DOC_DOMAIN.map(
  (d) => DOC_COLORS[d] ?? "#999999"
);

// ==== Chart options (mutated at render) =======================
export const opt: StackBarOptions = {
  x: (d: any) => d.id, // numeric
  y: (d: any) => d.count,
  z: (d: any) => d.group, // or d.doc
  width: 0,
  height: 0,
  offset: d3.stackOffsetNone,
  yLabel: "BandWidth(%)",
  zDomain: TIMEBAR_GROUP_DOMAIN,
  colors: TIMEBAR_GROUP_COLORS,
  yFormat: "~s",
  yDomain: [0, 100],
};

let timebar_opt: StackBarOptions = {
  x: (d: any) => d.id, // numeric
  y: (d: any) => d.count,
  z: (d: any) => d.group, // or d.doc
  width: 0,
  height: 0,
  offset: d3.stackOffsetNone,
  yLabel: "Message Count (flits)",
  zDomain: TIMEBAR_GROUP_DOMAIN,
  colors: TIMEBAR_GROUP_COLORS,
  yFormat: "~s",
};

interface FormattedDataForChartByMsgGroups {
  id: number;     // numeric slice id
  group: string;
  count: number;
}

interface FormattedDataForChartByDoC {
  id: number;     // numeric slice id
  doc: string;
  count: number;
}

// ==== Aggregation (make ids numeric) ==========================
export function handleFlatResponseByMsgGroups(
  data: DataPortFlatResponse
): FormattedDataForChartByMsgGroups[] {
  const reduce = d3.flatRollup(
    data,
    (v) => Number(d3.sum(v, (x: any) => x.count)),
    (d: any) => Number(d.id),
    (d: any) => d.group
  );
  const arr = Array.from(reduce, ([id, group, count]) => ({
    id: Number(id),
    group,
    count: Number(count),
  }));
  arr.sort((a, b) => d3.ascending(a.id, b.id) || d3.ascending(a.group, b.group));
  return arr;
}

function handleFlatResponseByDoC(
  data: DataPortFlatResponse
): FormattedDataForChartByDoC[] {
  const reduce = d3.flatRollup(
    data,
    (v) => Number(d3.sum(v, (x: any) => x.count)),
    (d: any) => Number(d.id),
    (d: any) => d.doc
  );
  const arr = Array.from(reduce, ([id, doc, count]) => ({
    id: Number(id),
    doc,
    count: Number(count),
  }));
  arr.sort((a, b) => d3.ascending(a.id, b.id) || d3.ascending(a.doc, b.doc));
  return arr;
}

// ==== Max flits (pad to elapse) ===============================
const getMaxFlitsFromFlatResponse = (data: DataPortFlatResponse): number[] => {
  const res: number[] = [];
  for (const d of data as any[]) {
    const idx = Number(d.id) | 0;
    while (res.length <= idx) res.push(0);
    res[idx] = d.max_flits;
  }
  return res;
};

// ==== Densify to 0..elapse-1 (numeric ids) ====================
function densifyByGroups(
  compact: FormattedDataForChartByMsgGroups[],
  elapse: number,
  domain: string[]
): FormattedDataForChartByMsgGroups[] {
  const key = (s: number, g: string) => `${s}|${g}`;
  const acc = new Map<string, number>();
  for (const r of compact) {
    if (r.id < 0 || r.id >= elapse) continue;
    if (!domain.includes(r.group)) continue;
    const k = key(r.id, r.group);
    acc.set(k, (acc.get(k) ?? 0) + r.count);
  }

  const out: FormattedDataForChartByMsgGroups[] = [];
  for (let s = 0; s < elapse; s++) {
    for (const g of domain) {
      out.push({
        id: s,
        group: g,
        count: acc.get(key(s, g)) ?? 0,
      });
    }
  }
  // ensure strict ascending by id
  out.sort((a, b) => d3.ascending(a.id, b.id) || d3.ascending(a.group, b.group));
  return out;
}

function densifyByDoc(
  compact: FormattedDataForChartByDoC[],
  elapse: number,
  domain: string[]
): FormattedDataForChartByDoC[] {
  const key = (s: number, d: string) => `${s}|${d}`;
  const acc = new Map<string, number>();
  for (const r of compact) {
    if (r.id < 0 || r.id >= elapse) continue;
    if (!domain.includes(r.doc)) continue;
    const k = key(r.id, r.doc);
    acc.set(k, (acc.get(k) ?? 0) + r.count);
  }

  const out: FormattedDataForChartByDoC[] = [];
  for (let s = 0; s < elapse; s++) {
    for (const d of domain) {
      out.push({
        id: s,
        doc: d,
        count: acc.get(key(s, d)) ?? 0,
      });
    }
  }
  out.sort((a, b) => d3.ascending(a.id, b.id) || d3.ascending(a.doc, b.doc));
  return out;
}

// ==== Entry points ============================================
export async function RenderTimebar() {
  console.log("Render Timebar from flat data");
  const resp = await Component.port.flat();
  const range0 = await Component.port.range(0, 0);
  const elapse = Number(range0?.meta?.elapse) || inferElapseFromFlat(resp);
  RenderTimebarImpl(resp, elapse);
}

function inferElapseFromFlat(resp: FlatData): number {
  let maxId = 0;
  for (const r of resp as any[]) {
    const s = Number(r.id) | 0;
    if (s > maxId) maxId = s;
  }
  return maxId + 1;
}

export function RenderTimebarImpl(resp: FlatData, elapse: number) {
  const timebar = Element.timebar.loadFlatResponse(resp, elapse);

  Component.ticker.setCast((l, r) => timebar.moveBrush(l, r));
  Component.layout.timebar.afterResizing(() => timebar.render());

  Event.AddStepListener(ev.MsgGroup, (g: string[]) =>
    timebar.updateMsgGroupDomain(g)
  );
  Event.AddStepListener(ev.DataOrCommand, (doc: string[]) =>
    timebar.updateDataOrCommandDomain(doc)
  );

  timebar.render();
}

// ==== Timebar class ===========================================
export default class Timebar {
  protected chart!: StackedChart;
  protected svg!: SVGSelection;
  protected brush!: d3.BrushBehavior<unknown>;
  protected data!: any[];
  protected dataForMsgGroups!: FormattedDataForChartByMsgGroups[];
  protected dataForDoC!: FormattedDataForChartByDoC[];
  protected maxFlits!: number[];
  protected prevBrush: [number, number];
  protected elapse: number = 0;

  constructor(d?: DataPortFlatResponse, elapse?: number) {
    this.prevBrush = [0, 0];
    if (d !== undefined) {
      this.loadFlatResponse(d, elapse ?? inferElapseFromFlat(d as any));
    }
  }

  loadFlatResponse(d: DataPortFlatResponse, elapse: number): this {
    this.elapse = Number(elapse) | 0;

    const byGroups = handleFlatResponseByMsgGroups(d);
    const byDoc = handleFlatResponseByDoC(d);

    this.dataForMsgGroups = byGroups;
    this.dataForDoC = byDoc;

    const mf = getMaxFlitsFromFlatResponse(d);
    while (mf.length < this.elapse) mf.push(0);
    this.maxFlits = mf;

    const domain = TIMEBAR_GROUP_DOMAIN;
    this.data = densifyByGroups(this.dataForMsgGroups, this.elapse, domain);

    timebar_opt.x = (r: any) => r.id; // ensure numeric accessor
    timebar_opt.z = (r: any) => r.group;
    timebar_opt.zDomain = domain;
    timebar_opt.colors = domain.map((g) => GROUP_COLORS[g] ?? "#999999");

    return this;
  }

  updateMsgGroupDomain(domainInput: string[]) {
    let domain = domainInput.filter((d) => d !== "Translation");
    if (domain.length === 0) domain = TIMEBAR_GROUP_DOMAIN.slice();

    timebar_opt.x = (r: any) => r.id; // numeric
    timebar_opt.z = (r: any) => r.group;
    timebar_opt.zDomain = domain;
    timebar_opt.colors = domain.map((d) => GROUP_COLORS[d] ?? "#999999");

    this.data = densifyByGroups(this.dataForMsgGroups, this.elapse, domain);
    this.render();
  }

  updateDataOrCommandDomain(domainInput: string[]) {
    let domain =
      domainInput.length > 0 ? domainInput.slice() : TIMEBAR_DOC_DOMAIN.slice();

    timebar_opt.x = (r: any) => r.id; // numeric
    timebar_opt.z = (r: any) => r.doc;
    timebar_opt.zDomain = domain;
    timebar_opt.colors = domain.map((d) => DOC_COLORS[d] ?? "#999999");

    this.data = densifyByDoc(this.dataForDoC, this.elapse, domain);
    this.render();
  }

  render() {
    div.select("#stacked-chart").remove();
    div.select("#saturation-bar").remove();

    timebar_opt.width = (div.node() as Element).clientWidth;
    timebar_opt.height = (div.node() as Element).clientHeight - 20;

    const chart = new StackedChart(this.data, timebar_opt);
    const svg = chart.axis();
    svg.attr("id", "stacked-chart");

    const saturation_bar = ramp(ColorScheme, this.maxFlits);
    saturation_bar.id = "saturation-bar";
    saturation_bar.style["display"] = "inline-block";

    chart.bar(svg);

    const brush = chart.brush(
      svg,
      (l, r) => {
        Component.ticker.signal["state"]("pause");
        Module.setTime.signal["start"](l);
        Module.setTime.signal["end"](r);
        Module.setTime.signal["refresh"](undefined);
      },
      this.prevBrush
    );

    div.append(() => chart.node(svg));
    div.append(() => saturation_bar);

    this.chart = chart;
    this.svg = svg;
    this.brush = brush;
  }

  moveBrush(left: number, right: number) {
    this.prevBrush = [left, right];
    this.chart.moveBrush(this.svg, this.brush, this.prevBrush);
  }
}

function ColorScheme(lv: number): string {
  return d3.interpolateReds(lv / 2000);
}

const marginLeft = 40;

function ramp(color: (x: number) => string, color_value: number[]) {
  const n = color_value.length;
  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  canvas.style.width = `calc(100% - ${marginLeft}px)`;
  canvas.style.height = "20px";
  canvas.style.imageRendering = "-moz-crisp-edges";
  canvas.style.imageRendering = "pixelated";
  canvas.style.marginLeft = `${marginLeft}px`;
  for (let i = 0; i < n; ++i) {
    context!.fillStyle = color(color_value[i]);
    context!.fillRect(i, 0, 1, 1);
  }
  return canvas;
}
