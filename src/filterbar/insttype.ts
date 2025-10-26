// src/filterbar/insttype.ts
import * as d3 from "d3";
import Event from "event";
import { ColoredCheckbox } from "widget/colorcheckbox";
import {
  DataOrCommandDomain,
  MsgGroupsDomain,
  DataOrCommandDomainNameExtend,
} from "data/classification";

const HIDDEN_GROUP = "Translation";

// Stable, name-based colors (do not recompute by length)
const GROUP_COLOR: Record<string, string> = {
  Read:  "#2b83ba", // blue
  Write: "#d7191c", // red
  Others:"#fdae61", // orange
  // "Translation" intentionally omitted/hidden
};

// Data/Command colors (stable)
const DOC_COLOR: Record<string, string> = {
  D: "#2b83ba", // Data -> blue
  C: "#d7191c", // Command -> red
};

const outerDiv = d3.select("#filterbar-inst-type");

const title = outerDiv
  .append("p")
  .text("Filter by Instruction Types")
  .style("display", "none");

// Only show visible groups in the UI
const VisibleMsgGroups = MsgGroupsDomain.filter((g) => g !== HIDDEN_GROUP);

const div = {
  MsgGroup: outerDiv
    .append("div")
    .attr("id", "filter-msg-group")
    .style("display", "none"),
  DataOrCommand: outerDiv
    .append("div")
    .attr("id", "filter-data-or-command")
    .style("display", "none"),
};

// Init selection: visible groups true; hidden group false.
let SelectedMsgGroup: Record<string, boolean> = {};
MsgGroupsDomain.forEach((g) => {
  SelectedMsgGroup[g] = g !== HIDDEN_GROUP;
});

let SelectedDataOrCommand = DataOrCommandDomain.reduce(
  (a, group) => ({ ...a, [group]: true }),
  {} as Record<string, boolean>
);

const ev = {
  MsgGroup: "FilterMsgGroup",
  DataOrCommand: "FilterDoC",
};

class InstructionTypeFilterBar {
  constructor() {}

  handleSignal(filterMode: /* "group" or "doc" */ string) {
    title.style("display", "block");
    if (filterMode === "group") {
      div.DataOrCommand.style("display", "none");
      div.MsgGroup.style("display", "inline-block");
      const now = VisibleMsgGroups.filter((g) => SelectedMsgGroup[g]);
      Event.FireEvent(ev.MsgGroup, now);
    } else if (filterMode === "doc") {
      div.DataOrCommand.style("display", "inline-block");
      div.MsgGroup.style("display", "none");
      const now = DataOrCommandDomain.filter((g) => SelectedDataOrCommand[g]);
      Event.FireEvent(ev.DataOrCommand, now);
    }
  }

  render() {
    this.renderFilterMsgGroup();
    this.renderFilterDataOrCommand();
  }

  // Msg group filter (render only visible groups)
  protected renderFilterMsgGroup() {
    VisibleMsgGroups.forEach((group) => {
      const color = GROUP_COLOR[group] ?? "#888"; // fallback gray if unknown
      const box = new ColoredCheckbox()
        .append({ label: group, color })
        .event((val) => this.updateMsgGroup(group, val))
        .static(true);
      div.MsgGroup.append(() => box.node());
    });
  }

  protected updateMsgGroup(group: string, checked: boolean) {
    SelectedMsgGroup[group] = checked;
    const groups = VisibleMsgGroups.filter((g) => SelectedMsgGroup[g]);
    Event.FireEvent(ev.MsgGroup, groups);
  }

  // Data/Command filter
  protected renderFilterDataOrCommand() {
    DataOrCommandDomain.forEach((group) => {
      const color = DOC_COLOR[group] ?? "#888";
      const box = new ColoredCheckbox()
        .append({
          label: DataOrCommandDomainNameExtend(group),
          color,
        })
        .event((val) => this.updateDataOrCommand(group, val))
        .static(true);
      div.DataOrCommand.append(() => box.node());
    });
  }

  protected updateDataOrCommand(group: string, checked: boolean) {
    SelectedDataOrCommand[group] = checked;
    const groups = DataOrCommandDomain.filter((g) => SelectedDataOrCommand[g]);
    Event.FireEvent(ev.DataOrCommand, groups);
  }
}

export default new InstructionTypeFilterBar();
