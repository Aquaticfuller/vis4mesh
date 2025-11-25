import { LabelBox } from "widget/labelbox";
import { SingleSlider } from "widget/singleslider";
import { RadioButtonGroup } from "widget/radiobutton";
import { InputBoxWithFloatingLabel } from "widget/input";
import Event from "event";

const ev = {
  GridSpacingStep: "GridSpacingStep",
  GridSpacingCover: "GridSpacingCover",
  BirdViewSize: "BirdViewSize",
  LinkDisplayMode: "LinkDisplayMode",
  ZoomPercent: "ZoomPercent",
};

export default function RenderSettingLayoutSection() {
  return new LabelBox("layout-setting").append([
    {
      label: "Grid layout",
      widgets: [
        new SingleSlider("spacing-step-slider")
          .append({
            min: 1,
            max: 100,
            default: 66,
            step: 1,
            label: "Node distance",
          })
          .event((v) => {
            Event.FireEvent(ev.GridSpacingStep, v);
          }),
        new SingleSlider("spacing-cover-slider")
          .append({
            min: 1,
            max: 100,
            default: 12,
            step: 1,
            label: "Node size",
          })
          .event((v) => {
            Event.FireEvent(ev.GridSpacingCover, v);
          }),
        new SingleSlider("birdview-height-slider")
          .append({
            min: 0,
            max: document.getElementById("graph")?.clientHeight!,
            default: Math.floor(
              document.getElementById("graph")?.clientHeight! * 0.25
            ),
            step: 1,
            label: "Bird View Size",
          })
          .event((v) => {
            Event.FireEvent(ev.BirdViewSize, v);
          }),
      ],
    },
    {
      label: "Link display",
      widgets: [
        new RadioButtonGroup("link-display-mode")
          .append([
            "Aggregate",
            "Parallel (per-channel)",
            "Parallel (all lanes)",
          ])
          .event((v) => {
            let mode = "aggregate";
            if (v === "Parallel (per-channel)") {
              mode = "physical";
            } else if (v === "Parallel (all lanes)") {
              mode = "physical_all";
            }
            Event.FireEvent(ev.LinkDisplayMode, mode);
          })
          .switch("Aggregate"),
        new InputBoxWithFloatingLabel("zoom-percent-input")
          .append({ label: "Zoom (%)", placeholder: "100" })
          .event((val: any) => {
            const num = Number(val);
            if (!Number.isNaN(num)) {
              Event.FireEvent(ev.ZoomPercent, num);
            }
          }),
      ],
    },
  ]);
}
