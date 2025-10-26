import { FileWithDirectoryAndFileHandle } from "browser-fs-access";

export class FileLoader {
  dirEnrties: FileWithDirectoryAndFileHandle[];
  edgeFiles: File[];

  // New: direct lookup by slice id (e.g., "17.json" -> 17)
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

    // make sure edge files are in order
    this.edgeFiles.sort((a, b) => {
      return this.getFilenameIndex(a.name) - this.getFilenameIndex(b.name);
    });
  }

  // getFileContent: expected to be called for three times (meta, flat, nodes)
  public async getFileContent(filename: string) {
    filename += ".json";

    for (const entry of this.dirEnrties) {
      if (entry.name === filename) {
        console.log("Get file content succeed: " + filename);
        return await entry.text();
      }
    }
    console.log(filename + " not found");
    return "";
  }

  /**
   * Original index-based getter (kept for compatibility).
   * NOTE: this indexes into the *present* files list, not the real slice id.
   * Prefer getEdgeFileContentBySlice for sparse timelines.
   */
  public async getEdgeFileContent(idx: number) {
    if (this.edgeFiles.length <= idx) {
      throw new Error("Unreacheable! Edge Files are not loaded or index OOB");
    }
    console.log("idx: " + idx);
    const content = await this.edgeFiles[idx].text();
    console.log("Get edge file content succeed: " + this.edgeFiles[idx].name);
    // console.log(content);
    return content;
  }

  /**
   * New: fetch an edge file by its *slice number* (e.g., 17 -> "17.json").
   * Returns undefined if that JSON is missing.
   */
  public async getEdgeFileContentBySlice(slice: number): Promise<string | undefined> {
    const f = this.edgeFileBySlice.get(slice);
    if (!f) return undefined;
    return await f.text();
  }

  public async getEdgeSnapshot(name: string) {
    // return edge snapshot
    return await this.getFileContent(name);
  }

  private getFilenameIndex(filename: string): number {
    return parseInt(filename.split(".")[0]);
  }
}
