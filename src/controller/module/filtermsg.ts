// src/controller/module/filtermsg.ts
import { SignalMap, ControllerModule } from "../controller";
import { DataToDisplay, EdgeDisplay } from "display/data";
import { DataPortRangeResponse, EdgeData, MetaData } from "data/data";
import {
  DataOrCommandDomain,
  DataOrCommandReverseMap,
  MsgGroupsDomain,
  MsgGroupsReverseMap,
  MsgTypesInOrderIndexMap,
  MsgTypesInOrder,
  TransferTypesInOrder,
  MsgGroupsMap,
} from "data/classification";
import * as d3 from "d3";
import Event from "event";

const ev = {
  InstTypeFilter: {
    MsgGroup: "FilterMsgGroup",
    DataOrCommand: "FilterDoC",
  },
  NoCMsgTypeFilter: "FilterNoCMsgType",
  NoCNumHopsFilter: "FilterNoCNumHops",
  NoCChannelFilter: "FilterNoCChannel", // <-- NEW: filter event for channels
};

enum InstTypeFilterMode {
  ByMsgGroup,
  ByDataOrCommand,
}

const NumHopsDomain = [...Array(4).keys()].map((i) => `${i}`);
const MapMsgTypeToIdx = MsgTypesInOrderIndexMap;

type TruthTable = { [key: string]: boolean };

export default class FilterMsg implements ControllerModule {
  public signal: SignalMap;

  protected instTypeGroupTruthTable: TruthTable;
  protected instTypeDoCTruthTable: TruthTable;
  protected instTypeFilterMode: InstTypeFilterMode;

  protected nocMsgTypeTruthTable: TruthTable;

  protected metaInfo?: MetaData;
  protected NumHopsDomain!: string[];
  protected nocNumHopsTruthTable!: TruthTable;

  // --- NEW: channel filter truth table (initialized after we see meta) ---
  protected channelTruthTable: TruthTable = {};

  constructor() {
    this.signal = {};

    // Instruction Type Filter
    this.instTypeGroupTruthTable = generateTruthTableViaSelectedDomain(
      // Turn Translation OFF by default:
      MsgGroupsDomain.filter((g) => g !== "Translation"),
      MsgGroupsDomain
    );
    this.instTypeDoCTruthTable = generateTruthTableViaSelectedDomain(
      DataOrCommandDomain,
      DataOrCommandDomain
    );
    this.instTypeFilterMode = InstTypeFilterMode.ByMsgGroup; // default

    // NoC Transferred Msg Type Filter
    this.nocMsgTypeTruthTable = generateTruthTableViaSelectedDomain(
      TransferTypesInOrder,
      TransferTypesInOrder
    );

    // NoC # Hops Filter
    this.nocNumHopsTruthTable = generateTruthTableViaSelectedDomain(
      NumHopsDomain,
      NumHopsDomain
    );

    // Register listeners
    Event.AddStepListener(ev.InstTypeFilter.MsgGroup, (g: string[]) =>
      this.updateInstTypeMsgGroupDomain(g)
    );
    Event.AddStepListener(ev.InstTypeFilter.DataOrCommand, (doc: string[]) =>
      this.updateInstTypeDoCDomain(doc)
    );
    Event.AddStepListener(ev.NoCMsgTypeFilter, (x: string[]) =>
      this.updateNoCMsgTypeDomain(x)
    );
    Event.AddStepListener(ev.NoCNumHopsFilter, (x: string[]) =>
      this.updateNoCNumHopsDomain(x)
    );

    // NEW: channel selection event (domain is list of channel indices as strings)
    Event.AddStepListener(ev.NoCChannelFilter, (chs: string[]) =>
      this.updateChannelsDomain(chs)
    );

    this.initSignalCallbacks();
  }

  protected initSignalCallbacks() {
    this.signal["msg"] = (v) => {
      if (v === "group") {
        this.instTypeFilterMode = InstTypeFilterMode.ByMsgGroup;
      } else if (v === "doc") {
        this.instTypeFilterMode = InstTypeFilterMode.ByDataOrCommand;
      } else {
        console.error("Invalid message signal for module filter");
      }
    };
  }

  decorateData(ref: DataPortRangeResponse, d: DataToDisplay) {
    let start = performance.now();

    // --- Lazy init when meta becomes available (first call) ---
    if (!this.metaInfo) {
      this.metaInfo = ref.meta;
      // initialize channel truth table to "all enabled"
      const NCH = (this.metaInfo.num_channels ?? 1);
      let fullDomain = Array.from({ length: NCH }, (_, i) => `${i}`);
      this.channelTruthTable = generateTruthTableViaSelectedDomain(
        fullDomain,
        fullDomain
      );
    }

    if (this.instTypeFilterMode == InstTypeFilterMode.ByMsgGroup) {
      this.aggregate_data(
        ref,
        d,
        (x) => this.nocMsgTypeTruthTable[x],
        (x) => this.nocNumHopsTruthTable[x],
        (x) => this.instTypeGroupTruthTable[x]
      );
    } else {
      alert("! NOT IMPLEMENTED YET");
      // If you later add DoC mode, keep the same channel-aware indexing used below.
    }

    let end = performance.now();
    console.log(`decorateData spend: ${end - start}ms`);
  }

  // --- Channel-aware aggregation with vector order:
  // transfer_type -> hop_unit -> msg_type -> channel
  aggregate_data(
    ref: DataPortRangeResponse,
    d: DataToDisplay,
    transfer_filter: (x: string) => boolean, // transfer_type
    hops_filter: (x: string) => boolean,     // hop_unit
    msg_filter: (x: string) => boolean       // msg group
  ) {
    const meta = ref.meta;
    const msg_types = MsgTypesInOrder.length;
    const NCH = (meta as any).num_channels ?? 1;

    for (let edge of ref.edges) {
      let weight = 0;
      let index = 0;

      for (let transfer_type of TransferTypesInOrder) {
        const tt_ok = transfer_filter(transfer_type);

        for (let hop_unit = 0; hop_unit < meta.num_hop_units; hop_unit++) {
          const hop_ok = hops_filter(`${hop_unit}`);

          for (let msg_type of MsgTypesInOrder) {
            const msg_ok = msg_filter(MsgGroupsMap[msg_type]);

            // NEW: iterate channels at the innermost level
            for (let ch = 0; ch < NCH; ch++) {
              const ch_ok =
                this.channelTruthTable[`${ch}`] === true;

              if (tt_ok && hop_ok && msg_ok && ch_ok) {
                weight += edge.value[index];
              }
              index++; // ALWAYS advance index to match backing vector layout
            }
          }
        }
      }

      d.edges.push({
        source: edge.source,
        target: edge.target,
        detail: edge.detail,
        weight: weight,
        label: "" /* optional label omitted */,
      });
    }
  }

  invokeController() {} // Nothing to do

  updateInstTypeMsgGroupDomain(domain: string[]) {
    this.instTypeGroupTruthTable = generateTruthTableViaSelectedDomain(
      domain,
      MsgGroupsDomain
    );
  }

  updateInstTypeDoCDomain(domain: string[]) {
    this.instTypeDoCTruthTable = generateTruthTableViaSelectedDomain(
      domain,
      DataOrCommandDomain
    );
  }

  updateNoCMsgTypeDomain(domain: string[]) {
    this.nocMsgTypeTruthTable = generateTruthTableViaSelectedDomain(
      domain,
      TransferTypesInOrder
    );
  }

  updateNoCNumHopsDomain(domain: string[]) {
    this.nocNumHopsTruthTable = generateTruthTableViaSelectedDomain(
      domain,
      NumHopsDomain
    );
  }

  // --- NEW: channel domain update ---
  updateChannelsDomain(domain: string[]) {
    const NCH = (this.metaInfo?.num_channels ?? 1);
    const fullDomain = Array.from({ length: NCH }, (_, i) => `${i}`);
    this.channelTruthTable = generateTruthTableViaSelectedDomain(
      domain,
      fullDomain
    );
  }
}

function generateTruthTableViaSelectedDomain(
  selected: string[],
  fullDomain: string[]
): TruthTable {
  let ans: TruthTable = {};
  for (let item of fullDomain) {
    ans[item] = false;
  }
  for (let item of selected) {
    ans[item] = true;
  }
  return ans;
}

export function CompressBigNumber(number: string | number): string {
  if (typeof number === "string") {
    number = Number(number);
  }
  const format = d3.format(".3s")(number);
  const len = format.length;
  const trans = Number(format);
  if (Number.isNaN(trans) === true) {
    const prefix = format.substring(0, len - 1);
    return `${Number(prefix)}${format.charAt(len - 1)}`;
  } else {
    return `${trans}`;
  }
}
