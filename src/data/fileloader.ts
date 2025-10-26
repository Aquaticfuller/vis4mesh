import { FileWithDirectoryAndFileHandle } from "browser-fs-access";

export class FileLoader {
  dirEnrties: FileWithDirectoryAndFileHandle[];
  edgeFiles: File[];

  // Cached text of edge_prefix_sum/-1.json if present
  private zeroEdgeCache?: string;

  // Direct lookup by slice id (e.g., "17.json" -> 17)
  private edgeFileBySlice: Map<number, File>;

  readonly dirEdges = "edge_prefix_sum/";
  readonly dirEdgeHistory = "edgehis/";

  // dirHandle: built by openDirectory() method supported by web-fs-access
  public constructor(dirHandle: FileWithDirectoryAndFileHandle[]) {
    this.edgeFiles = [];
    this.dirEnrties = dirHandle;
    this.edgeFileBySlice = new Map<number, File>();
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

    // keep deterministic order for debugging (lookup uses the map)
    this.edgeFiles.sort((a, b) => {
      return this.getFilenameIndex(a.name) - this.getFilenameIndex(b.name);
    });
  }

  // getFileContent: expected to be called for three times (meta, flat, nodes)
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

  /**
   * Slice-aware getter (use this in new code).
   * Returns the file text for {slice}.json, or undefined if that JSON is missing.
   */
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
   * Slice-aware getter with zero fallback.
   * Returns the file text for {slice}.json; if missing, tries -1.json (all-zero edge).
   * Returns "" if neither exists (caller can synthesize zeros from meta).
   */
  public async getEdgeFileContentBySliceOrZero(slice: number): Promise<string> {
    const txt = await this.getEdgeFileContentBySlice(slice);
    if (txt !== undefined) return txt;

    const zero = await this.getZeroEdgeFileContent();
    if (zero !== undefined) {
      console.warn(`Slice ${slice}.json missing; using -1.json fallback.`);
      return zero;
    }

    console.warn(
      `Slice ${slice}.json and -1.json missing; returning empty string.`
    );
    return "";
  }

  /**
   * LEGACY NAME kept for compatibility, but now interprets `idx` as a SLICE NUMBER.
   * Prefer calling getEdgeFileContentBySliceOrZero(slice) explicitly.
   */
  public async getEdgeFileContent(idx: number) {
    return this.getEdgeFileContentBySliceOrZero(idx);
  }

  /** True iff {slice}.json exists under edge_prefix_sum. */
  public hasEdgeSlice(slice: number): boolean {
    return this.edgeFileBySlice.has(slice);
  }

  public async getEdgeSnapshot(name: string) {
    // return edge snapshot
    return await this.getFileContent(name);
  }

  private getFilenameIndex(filename: string): number {
    return parseInt(filename.split(".")[0]); // "37.json" -> 37
  }

  // Read and cache edge_prefix_sum/-1.json (all-zero template) if present.
  private async getZeroEdgeFileContent(): Promise<string | undefined> {
    if (this.zeroEdgeCache !== undefined) return this.zeroEdgeCache;
    for (const entry of this.dirEnrties) {
      // look only under the edge_prefix_sum directory
      if (
        entry.webkitRelativePath.includes(this.dirEdges) &&
        entry.name === "-1.json"
      ) {
        this.zeroEdgeCache = await entry.text();
        console.log("Using zero-edge fallback: -1.json");
        return this.zeroEdgeCache;
      }
    }
    console.warn("Zero-edge fallback (-1.json) not found.");
    return undefined;
  }
}
