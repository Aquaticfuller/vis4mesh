import * as d3 from "d3";
import Event from "event";
import { Checkbox } from "widget/checkbox";
import { ChannelGroup } from "data/data";

const outer = d3.select("#filterbar-noc-channels");
const title = outer.append("p").text("Filter by NoC Channels").style("display","none");

// Group-level toggle buttons container (Narrow Req / Wide Req / Resp / etc.)
const groupDiv = outer.append("div")
  .attr("id","filterbar-noc-channel-groups")
  .style("padding","4px 0")
  .style("display","flex")
  .style("flex-wrap","wrap")
  .style("gap","6px");

// Individual channel checkboxes (collapsible, hidden by default)
const detailToggle = outer.append("p")
  .style("cursor","pointer")
  .style("font-size","11px")
  .style("color","#666")
  .style("margin","2px 0")
  .style("display","none")
  .text("▶ Show individual channels");
const div = outer.append("div")
  .attr("id","filterbar-noc-channels-group")
  .style("padding-top","4px")
  .style("display","none");

let detailOpen = false;
detailToggle.on("click", () => {
  detailOpen = !detailOpen;
  div.style("display", detailOpen ? "block" : "none");
  detailToggle.text(detailOpen ? "▼ Hide individual channels" : "▶ Show individual channels");
});

const ev = { NoCChannelFilter: "FilterNoCChannel" };

// Infer channel groups from channel_labels when no explicit groups provided.
// Groups labels by their prefix before the last digit sequence.
// e.g. ["NarrowReq_T0_C0", ..., "WideReq_T0_C0", ..., "Resp_T0_C0", ...]
// -> groups: "NarrowReq", "WideReq", "Resp"
function inferGroups(labels: string[], n: number): ChannelGroup[] {
  // Try prefix-based grouping: strip trailing _T\d+_C\d+ or _\d+ or digits
  const prefixMap = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const lbl = labels[i] || `ch${i}`;
    // Extract prefix: everything before the last sequence of _T<num> or _<num>
    let prefix = lbl.replace(/_T\d+.*$/, "").replace(/_\d+$/, "").replace(/\d+$/, "");
    if (!prefix) prefix = lbl;
    if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
    prefixMap.get(prefix)!.push(i);
  }
  // Only use inferred groups if there are 2+ groups and they're meaningful
  if (prefixMap.size >= 2 && prefixMap.size <= 10) {
    return Array.from(prefixMap.entries()).map(([name, channels]) => ({ name, channels }));
  }
  return [];
}

class NoCChannelFilterBar {
  private boxes: Checkbox[] = [];
  private selected: boolean[] = [];
  private labels: string[] = [];
  private groups: ChannelGroup[] = [];
  private groupEnabled: boolean[] = [];
  private n = 0;

  handleSignal(meta_n: number, labels?: string[], groups?: ChannelGroup[]) {
    if (this.n > 0) return; // already initialized
    this.n = meta_n;
    this.labels = labels && labels.length === meta_n
      ? labels
      : Array.from({ length: meta_n }, (_, i) => `ch${i}`);
    this.selected = Array(this.n).fill(true);

    // Resolve groups: explicit from meta, or inferred from labels
    this.groups = groups && groups.length > 0
      ? groups
      : inferGroups(this.labels, this.n);
    this.groupEnabled = Array(this.groups.length).fill(true);

    title.style("display", "block");

    // Render group toggle buttons (if any groups exist)
    if (this.groups.length > 0) {
      this.renderGroupButtons();
      detailToggle.style("display", "block");
    }

    // Render individual channel checkboxes
    for (let i = 0; i < this.n; i++) {
      const cb = new Checkbox()
        .append({ label: this.labels[i] })
        .event((checked: boolean) => this.updateSingle(i, checked))
        .static(true);
      div.append(() => cb.node());
      this.boxes.push(cb);
    }

    // If no groups, show individual checkboxes directly
    if (this.groups.length === 0) {
      div.style("display", "block");
    }

    Event.FireEvent(ev.NoCChannelFilter, this.currentDomain());
  }

  private renderGroupButtons() {
    for (let gi = 0; gi < this.groups.length; gi++) {
      const g = this.groups[gi];
      const btn = groupDiv.append("button")
        .attr("class", "btn btn-sm btn-outline-primary active")
        .style("font-size", "11px")
        .style("padding", "2px 8px")
        .text(`${g.name} (${g.channels.length})`)
        .on("click", () => {
          this.toggleGroup(gi);
          const active = this.groupEnabled[gi];
          btn.classed("active", active)
             .classed("btn-outline-primary", active)
             .classed("btn-outline-secondary", !active);
        });
    }
  }

  private toggleGroup(gi: number) {
    this.groupEnabled[gi] = !this.groupEnabled[gi];
    const enabled = this.groupEnabled[gi];
    for (const ch of this.groups[gi].channels) {
      if (ch < this.n) {
        this.selected[ch] = enabled;
        if (this.boxes[ch]) {
          this.boxes[ch].static(enabled);
        }
      }
    }
    Event.FireEvent(ev.NoCChannelFilter, this.currentDomain());
  }

  private updateSingle(i: number, checked: boolean) {
    this.selected[i] = checked;
    // Sync group button state: a group is "on" if any of its channels are on
    for (let gi = 0; gi < this.groups.length; gi++) {
      const anyOn = this.groups[gi].channels.some(ch => this.selected[ch]);
      this.groupEnabled[gi] = anyOn;
      // Update button visual
      const btns = groupDiv.selectAll("button").nodes();
      if (btns[gi]) {
        d3.select(btns[gi])
          .classed("active", anyOn)
          .classed("btn-outline-primary", anyOn)
          .classed("btn-outline-secondary", !anyOn);
      }
    }
    Event.FireEvent(ev.NoCChannelFilter, this.currentDomain());
  }

  private currentDomain(): string[] {
    return this.selected.map((v, i) => v ? `${i}` : "").filter(s => s !== "");
  }
}

export default new NoCChannelFilterBar();
export { ev as NoCChannelFilterEvent };
