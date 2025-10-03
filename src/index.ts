// src/index.ts
import "../public/index.scss";
import Controller from "controller/controller";
import { Component, Element, Module } from "global";

import { RenderTimebar } from "./timebar/timebar";
import { RenderFilterbar } from "./filterbar/filterbar";
import { RenderTopbar } from "topbar/topbar";

import { supported } from "browser-fs-access";
import { daisen_button, register_daisen_insight } from "./topbar/daisen";
import { MainView } from "./graph/graph";

const port = Component.port;

const chooseDirButton = document.querySelector("#open-directory-btn")!;

if (supported) {
  console.log("Using the File System Access API.");
} else {
  console.log("Using the fallback implementation.");
}

chooseDirButton.addEventListener("click", async () => {
  try {
    const meta: any = await port.init(); // meta.json from uploaded directory
    chooseDirButton.remove();

    console.log(meta);
    const graph = new MainView(meta["width"], meta["height"]);

    register_daisen_insight(daisen_button, graph);

    const c = new Controller(port, graph).loadModules([
      Module.filterMsg,
      Module.setTime,
    ]);

    Component.ticker.setMaxTime(+meta["elapse"]).bindController(c);

    // c.requestDataPort(); // render initial view if you want a 0..0 frame

    RenderTopbar();
    RenderTimebar();
    RenderFilterbar();

    // --- pass meta-derived signals to filter bars ---
    // 1) Tell the hops filter how wide each hop bucket is
    Element.filterbar.signal["num_hops_per_unit"](meta.hops_per_unit);

    // 2) Tell the (new) channel filter how many physical NoC channels exist
    //    and (optionally) their labels if provided by meta.json
    Element.filterbar.signal["num_channels"]?.({
      n: meta.num_channels ?? 1,
      labels: meta.channel_labels,
    });
    // ------------------------------------------------
  } catch (err) {
    console.error(err);
  }
});
