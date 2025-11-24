import { FileWithDirectoryAndFileHandle } from "browser-fs-access";

export class FileLoader {
  dirEnrties: FileWithDirectoryAndFileHandle[];
  edgeFiles: File[];

  // Direct lookup by exact slice id (e.g., "17.json" -> 17)
  private edgeFileBySlice: Map<number, File>;
  // Sorted list of available slice ids for fast nearest-prior lookup
  private sliceList: number[];

  readonly dirEdges = "edge_prefix_sum/";
  readonly dirEdgeHistory = "edgehis/";

  // dirHandle: built by openDirectory() method supported by web-fs-access
  public constructor(dirHandle: FileWithDirectoryAndFileHandle[]) {
    this.edgeFiles = [];
    this.dirEnrties = dirHandle;
    this.edgeFileBySlice = new Map<number, File>();
    this.sliceList = [];
    console.log("constructor FileLoader");
  }

  // getEdgeFiles: must be called and awaited before MeshInfo
  public async getEdgeFiles() {
    if (this.edgeFiles.length > 0) {
      return;
    }
    for (const entry of this.dirEnrties) {
      if (
        entry.webkitRelativePath.includes(this.dirEdges) &&
        !entry.webkitRelativePath.endsWith(this.dirEdges)
      ) {
        this.edgeFiles.push(entry);

        // build slice map
        const idx = this.getFilenameIndex(entry.name);
        if (!Number.isNaN(idx)) {
          this.edgeFileBySlice.set(idx, entry);
        }
      }
    }

    // keep deterministic order for debugging
    this.edgeFiles.sort((a, b) => {
      return this.getFilenameIndex(a.name) - this.getFilenameIndex(b.name);
    });

    // build the sorted slice list once
    this.sliceList = Array.from(this.edgeFileBySlice.keys()).sort((a, b) => a - b);
    console.log(`Edge slices detected: [${this.sliceList.join(", ")}]`);
  }

  // getFileContent: used for meta/flat/nodes & snapshots
  public async getFileContent(filename: string) {
    const needle = filename + ".json";
    for (const entry of this.dirEnrties) {
      if (entry.name === needle) {
        console.log("Get file content succeed: " + needle);
        return await entry.text();
      }
    }
    console.log(needle + " not found");
    return "";
  }

  /** Exact slice getter: returns the file text for {slice}.json if present. */
  public async getEdgeFileContentBySlice(
    slice: number
  ): Promise<string | undefined> {
    const f = this.edgeFileBySlice.get(slice);
    if (!f) return undefined;
    const txt = await f.text();
    console.log(`Loaded edge slice ${slice}: ${f.name}`);
    return txt;
  }

  /**
   * Nearest-prior getter:
   * returns the file text for the largest slice s <= {slice} that exists.
   * Returns undefined if there is no slice <= {slice}.
   */
  public async getEdgeFileContentNearestLE(
    slice: number
  ): Promise<string | undefined> {
    const s = this.nearestSliceLE(slice);
    if (s === undefined) return undefined;
    return this.getEdgeFileContentBySlice(s);
  }

  /**
   * LEGACY NAME kept for compatibility.
   * Now it returns the nearest-prior content for `idx` (or "" if none).
   */
  public async getEdgeFileContent(idx: number) {
    const txt = await this.getEdgeFileContentNearestLE(idx);
    return txt ?? "";
  }

  /** True iff {slice}.json exists under edge_prefix_sum. */
  public hasEdgeSlice(slice: number): boolean {
    return this.edgeFileBySlice.has(slice);
  }

  /** Useful for building a zero-shaped template (pick the earliest available). */
  public async getAnyEdgeTemplate(): Promise<string | undefined> {
    if (this.sliceList.length === 0) return undefined;
    const s = this.sliceList[0];
    return this.getEdgeFileContentBySlice(s);
  }

  public async getEdgeSnapshot(name: string) {
    // return edge snapshot
    return await this.getFileContent(name);
  }

  private getFilenameIndex(filename: string): number {
    return parseInt(filename.split(".")[0]); // "37.json" -> 37
  }

  private nearestSliceLE(x: number): number | undefined {
    const arr = this.sliceList;
    if (arr.length === 0) return undefined;
    let lo = 0, hi = arr.length - 1, ans = -1;
    while (lo <= hi) {
      const md = (lo + hi) >> 1;
      if (arr[md] <= x) {
        ans = md;
        lo = md + 1;
      } else {
        hi = md - 1;
      }
    }
    return ans >= 0 ? arr[ans] : undefined;
  }
}
