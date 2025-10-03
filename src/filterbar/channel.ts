import * as d3 from "d3";
import Event from "event";
import { Checkbox } from "widget/checkbox";

const outer = d3.select("#filterbar-noc-channels");
const title = outer.append("p").text("Filter by Physical NoC Channels").style("display","none");
const div   = outer.append("div").attr("id","filterbar-noc-channels-group").style("padding-top","4px");

const ev = { NoCChannelFilter: "FilterNoCChannel" };

class NoCChannelFilterBar {
  private boxes: Checkbox[] = [];
  private selected: boolean[] = [];
  private labels: string[] = [];
  private n = 0;

  handleSignal(meta_n: number, labels?: string[]) {
    // initialize once
    if (this.n === 0) {
      this.n = meta_n;
      this.labels = labels && labels.length===meta_n ? labels : Array.from({length:meta_n}, (_,i)=>`CH${i}`);
      title.style("display","block");
      this.selected = Array(this.n).fill(true);
      for (let i=0;i<this.n;i++) {
        const cb = new Checkbox()
          .append({ label: this.labels[i] })
          .event((checked:boolean)=>this.update(i, checked))
          .static(true);
        div.append(()=>cb.node());
        this.boxes.push(cb);
      }
      Event.FireEvent(ev.NoCChannelFilter, this.currentDomain());
    }
  }

  private update(i:number, checked:boolean) {
    this.selected[i] = checked;
    Event.FireEvent(ev.NoCChannelFilter, this.currentDomain());
  }

  private currentDomain(): string[] {
    return this.selected.map((v,i)=> v? `${i}` : "").filter(s=>s!=="");
  }
}

export default new NoCChannelFilterBar();
export { ev as NoCChannelFilterEvent };
