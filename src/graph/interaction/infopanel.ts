import * as d3 from "d3";

export type InfoRow = { label: string; value: string | number };

class InfoPanel {
  private panel: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  private pos?: { x: number; y: number };
  private hasCustomPos: boolean = false;

  constructor() {
    let existing = d3.select<HTMLDivElement, unknown>("#info-panel");
    if (existing.empty()) {
      existing = d3
        .select("body")
        .append("div")
        .attr("id", "info-panel")
        .attr("class", "info-panel");
    }
    this.panel = existing;
  }

  show(title: string, rows: InfoRow[]) {
    this.panel.selectAll("*").remove();

    const header = this.panel.append("div").attr("class", "info-panel__header");
    header.append("div").attr("class", "info-panel__title").text(title);
    header
      .append("button")
      .attr("class", "info-panel__close")
      .text("×")
      .on("click", () => this.hide());
    this.enableDrag(header);

    const body = this.panel.append("div").attr("class", "info-panel__body");
    rows.forEach((row) => {
      const item = body.append("div").attr("class", "info-panel__row");
      item.append("div").attr("class", "info-panel__label").text(row.label);
      item.append("div").attr("class", "info-panel__value").text(row.value);
    });

    this.applyPosition();
    this.panel.style("display", "block");
  }

  hide() {
    this.panel.style("display", "none");
  }

  private applyPosition() {
    if (this.hasCustomPos && this.pos) {
      this.panel
        .style("left", `${this.pos.x}px`)
        .style("top", `${this.pos.y}px`)
        .style("right", null);
    } else {
      this.panel.style("left", null).style("right", "16px").style("top", "50px");
    }
  }

  private enableDrag(header: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>) {
    let dragging = false;
    let offset = { x: 0, y: 0 };

    header
      .on("mousedown", (event: MouseEvent) => {
        const rect = this.panel.node()?.getBoundingClientRect();
        if (!rect) return;
        dragging = true;
        offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        d3.select(window).on("mousemove.info-panel", (ev: MouseEvent) => {
          if (!dragging) return;
          this.pos = { x: ev.clientX - offset.x, y: ev.clientY - offset.y };
          this.hasCustomPos = true;
          this.applyPosition();
        });
        d3.select(window).on("mouseup.info-panel", () => {
          dragging = false;
          d3.select(window).on("mousemove.info-panel", null);
          d3.select(window).on("mouseup.info-panel", null);
        });
      })
      .style("cursor", "move");
  }
}

export default new InfoPanel();
