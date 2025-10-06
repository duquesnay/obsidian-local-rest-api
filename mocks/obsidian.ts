export interface DataWriteOptions {
  /**
   * Time of creation, represented as a unix timestamp, in milliseconds.
   * Omit this if you want to keep the default behaviour.
   * @public
   * */
  ctime?: number;
  /**
   * Time of last modification, represented as a unix timestamp, in milliseconds.
   * Omit this if you want to keep the default behaviour.
   * @public
   */
  mtime?: number;

}
class Stat {
  type: "file" | "folder" = "file";
}

class DataAdapter {
  _exists = true;
  _read = "";
  _readBinary = new ArrayBuffer(0);
  _write: [string, string];
  _writeBinary : [string, ArrayBuffer];
  _remove: [string];
  _stat = new Stat();
  _listResult: { files: string[]; folders: string[] } = { files: [], folders: [] };

  async exists(path: string): Promise<boolean> {
    return this._exists;
  }

  async stat(path: string): Promise<Stat> {
    return this._stat;
  }

  async read(path: string): Promise<string> {
    return this._read;
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    return this._readBinary;
  }

  async write(path: string, content: string, option?:DataWriteOptions): Promise<void> {
    this._write = [path, content];
  }

  async writeBinary(path: string, content: ArrayBuffer, option?:DataWriteOptions): Promise<void> {
    this._writeBinary = [path,content]
  }

  async remove(path: string): Promise<void> {
    this._remove = [path];
  }

  async list(path: string): Promise<{ files: string[]; folders: string[] }> {
    return this._listResult;
  }
}

export class Vault {
  _getAbstractFileByPath: TFile | null = new TFile();
  _read = "";
  _cachedRead = "";
  _files: TFile[] = [new TFile()];
  _markdownFiles: TFile[] = [];
  _readMap: Record<string, string> = {};

  adapter = new DataAdapter();

  async read(file: TFile): Promise<string> {
    // Check if we have a specific read value for this file path
    if (this._readMap && this._readMap[file.path]) {
      return this._readMap[file.path];
    }
    return this._read;
  }

  async cachedRead(file: TFile): Promise<string> {
    // Check if we have a specific read value for this file path
    if (this._readMap && this._readMap[file.path]) {
      return this._readMap[file.path];
    }
    return this._cachedRead;
  }

  async createFolder(path: string): Promise<void> {}

  async trash(file: TFile, system?: boolean): Promise<void> {}

  getFiles(): TFile[] {
    return this._files;
  }

  getMarkdownFiles(): TFile[] {
    return this._markdownFiles;
  }

  getAbstractFileByPath(path: string): TFile | null {
    // Look for a file with the exact path in our files array
    const foundFile = this._files.find(file => file.path === path);
    if (foundFile) {
      return foundFile;
    }
    // If null is set, return null (for testing "file not found")
    if (this._getAbstractFileByPath === null) {
      return null;
    }
    // Otherwise return the default file
    return this._getAbstractFileByPath;
  }
}

export class Loc {
  line = -1;
}

export class Pos {
  start = new Loc();
  end = new Loc();
}

export class HeadingCache {
  level = 1;
  heading = "";
  position = new Pos();
}

export class LinkCache {
  link = "";
  original = "";
  displayText?: string;
  position = new Pos();
}

export class CachedMetadata {
  headings: HeadingCache[] = [];
  frontmatter: Record<string, unknown> = {};
  tags: { tag: string }[] = [];
  links: LinkCache[] = [];
}

export class MetadataCache {
  _getFileCache = new CachedMetadata();
  _fileCacheMap: Record<string, CachedMetadata> = {};

  getFileCache(file: TFile): CachedMetadata {
    // Check if we have a specific cache for this file path
    if (this._fileCacheMap && this._fileCacheMap[file.path]) {
      return this._fileCacheMap[file.path];
    }
    return this._getFileCache;
  }
}

export class Workspace {
  async openLinkText(
    path: string,
    base: string,
    newLeaf: boolean
  ): Promise<void> {
    return new Promise((resolve, reject) => resolve());
  }

  getActiveFile(): TFile {
    return new TFile();
  }
}

export class App {
  _executeCommandById: [string];

  vault = new Vault();
  workspace = new Workspace();
  metadataCache = new MetadataCache();
  commands = {
    commands: {} as Record<string, Command>,

    executeCommandById: (id: string) => {
      this._executeCommandById = [id];
    },
  };
}

export class Command {
  id = "";
  name = "";
}

export class FileStats {
  ctime = 0;
  mtime = 0;
  size = 0;
}

export class TFile {
  path = "somefile.md";
  stat: FileStats = new FileStats();
}

export class PluginManifest {
  version = "";
}

export class SettingTab {}

export const apiVersion = "1.0.0";

export class SearchResult {
  score = -10;
  matches: [number, number][] = [];
}

export function prepareSimpleSearch(
  query: string
): (value: string) => null | SearchResult {
  // Return a simple search function that checks if the query is in the value
  return (value: string) => {
    const index = value.indexOf(query);
    if (index >= 0) {
      return {
        score: 1,
        matches: [[index, index + query.length]]
      };
    }
    return null;
  };
}
