// src/filterbar/filterbar.ts
import Event from "event";
import { Component, Element } from "global";
import EdgeTrafficByLegendCheckboxFilterBar from "./edgecheckboxwrapper";
import InstructionTypeFilterBar from "./insttype";
import NoCMsgTypeFilterBar from "./nocmsgtype";
import NoCNumHopsFilterBar from "./numhops";
import NoCChannelFilterBar from "./channel"; // <-- NEW

type SignalMap = { [type: string]: (v: any) => any };

const ev = {
  MsgGroup: "FilterMsgGroup",
  DataOrCommand: "FilterDoC",
  EdgeTrafficCheckbox: "FilterETCheckbox",
  NoCMsgTypeFilter: "FilterNoCMsgType",
  NoCNumHopsFilter: "FilterNoCNumHops",
  NoCChannelFilter: "FilterNoCChannel", // <-- NEW (pause ticker on channel tweaks)
};

function InitFilterEvent() {
  const t = Component.ticker;
  for (const key in ev) {
    Event.AddStartListener(ev[key], () => t.signal["state"]("pause"));
    if (key !== "EdgeTrafficCheckbox") {
      Event.AddEndListener(ev[key], () => t.signal["state"]("still"));
    }
  }
}

export function RenderFilterbar() {
  InitFilterEvent();
  const f = Element.filterbar;
  f.renderFilterEdgeTrafficByLegendCheckbox();
  f.renderFilterInstructionType();
  f.renderFilterNoCMsgType();
  f.renderFilterNoCNumHopsType();
  f.renderFilterNoCChannels(); // <-- NEW (no args; actual UI waits for signal)
}

export default class Filterbar {
  public signal: SignalMap;

  constructor() {
    this.signal = {};
    this.initSignalCallbacks();
  }

  protected initSignalCallbacks() {
    // Switch between instruction-type modes (group vs Data/Command)
    this.signal["msg"] = (v) => InstructionTypeFilterBar.handleSignal(v);

    // Edge traffic legend control (checkbox vs slider)
    this.signal["edge"] = (v) =>
      EdgeTrafficByLegendCheckboxFilterBar.handleSignal(v);

    // Provide hop bucket width from meta (required by the hops UI)
    this.signal["num_hops_per_unit"] = (v: number) =>
      NoCNumHopsFilterBar.handleSignal(v);

    // NEW: Provide number of physical NoC channels (and optional labels) from meta
    // Call this once meta is available, e.g. in src/index.ts after port.init()
    // Element.filterbar.signal["num_channels"]({ n: meta.num_channels, labels: meta.channel_labels })
    this.signal["num_channels"] = (v: { n: number; labels?: string[] }) =>
      NoCChannelFilterBar.handleSignal(v.n, v.labels);
  }

  renderFilterEdgeTrafficByLegendCheckbox() {
    EdgeTrafficByLegendCheckboxFilterBar.render();
  }

  renderFilterInstructionType() {
    InstructionTypeFilterBar.render();
  }

  renderFilterNoCMsgType() {
    NoCMsgTypeFilterBar.render();
  }

  renderFilterNoCNumHopsType() {
    NoCNumHopsFilterBar.render();
  }

  // NEW: Channel filter renders lazily when the "num_channels" signal arrives.
  // We keep this method for symmetry with others; it intentionally does nothing.
  renderFilterNoCChannels() {
    // no-op — NoCChannelFilterBar builds itself on first handleSignal(n, labels)
  }
}
