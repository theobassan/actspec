// Minimal vscode mock for unit tests running outside the extension host.

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position,
  ) {}
}

export class Location {
  constructor(
    public readonly uri: Uri,
    public readonly range: Position | Range,
  ) {}
}

export class Uri {
  private constructor(
    public readonly scheme: string,
    public readonly fsPath: string,
  ) {}

  static file(fsPath: string): Uri {
    return new Uri('file', fsPath);
  }

  toString(): string {
    return `file://${this.fsPath}`;
  }
}

export class TestMessage {
  location?: Location;
  constructor(public message: string) {}
}

export class Disposable {
  constructor(private _dispose: () => void) {}
  dispose(): void {
    this._dispose();
  }
  static from(...disposables: { dispose(): void }[]): Disposable {
    return new Disposable(() => disposables.forEach((d) => d.dispose()));
  }
}

export class RelativePattern {
  constructor(
    public readonly base: WorkspaceFolder | Uri | string,
    public readonly pattern: string,
  ) {}
}

export enum TestRunProfileKind {
  Run = 1,
  Debug = 2,
  Coverage = 3,
}

export interface WorkspaceFolder {
  uri: Uri;
  name: string;
  index: number;
}

export interface TestItemCollection {
  readonly size: number;
  add(item: TestItem): void;
  delete(id: string): void;
  get(id: string): TestItem | undefined;
  forEach(cb: (item: TestItem) => void): void;
}

function makeItemCollection(): TestItemCollection {
  const map = new Map<string, TestItem>();
  return {
    get size() {
      return map.size;
    },
    add(item) {
      map.set(item.id, item);
    },
    delete(id) {
      map.delete(id);
    },
    get(id) {
      return map.get(id);
    },
    forEach(cb) {
      map.forEach(cb);
    },
  };
}

export interface TestItem {
  id: string;
  label: string;
  uri?: Uri;
  range?: Range;
  canResolveChildren: boolean;
  parent?: TestItem;
  children: TestItemCollection;
}

export interface TestController {
  items: TestItemCollection;
  createTestItem(id: string, label: string, uri?: Uri): TestItem;
  createRunProfile(
    label: string,
    kind: TestRunProfileKind,
    handler: (request: TestRunRequest, token: CancellationToken) => void | Promise<void>,
    isDefault?: boolean,
  ): void;
  createTestRun(request: TestRunRequest): TestRun;
  resolveHandler: ((item: TestItem | undefined) => void | Promise<void>) | undefined;
}

export interface TestRunRequest {
  include?: TestItem[];
  exclude?: TestItem[];
}

export interface CancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): Disposable;
}

export interface TestRun {
  started(item: TestItem): void;
  passed(item: TestItem, duration?: number): void;
  failed(item: TestItem, message: TestMessage | TestMessage[], duration?: number): void;
  skipped(item: TestItem): void;
  errored(item: TestItem, message: TestMessage | TestMessage[], duration?: number): void;
  appendOutput(output: string): void;
  end(): void;
}

export const tests = {
  createTestController(_id: string, _label: string): TestController {
    const items = makeItemCollection();
    return {
      items,
      createTestItem(itemId: string, itemLabel: string, uri?: Uri): TestItem {
        const children = makeItemCollection();
        const item: TestItem = {
          id: itemId,
          label: itemLabel,
          uri,
          canResolveChildren: false,
          children,
          parent: undefined,
        };
        const origAdd = children.add.bind(children);
        children.add = (child: TestItem) => {
          (child as { parent: TestItem }).parent = item;
          origAdd(child);
        };
        return item;
      },
      resolveHandler: undefined,
      createRunProfile() {},
      createTestRun() {
        return {
          started() {},
          passed() {},
          failed() {},
          skipped() {},
          errored() {},
          appendOutput() {},
          end() {},
        };
      },
    };
  },
};

export const workspace = {
  workspaceFolders: undefined as WorkspaceFolder[] | undefined,
  findFiles: async (_pattern: RelativePattern, _exclude?: string) => [] as Uri[],
  createFileSystemWatcher(_pattern: string) {
    return {
      onDidCreate(_cb: (uri: Uri) => void) {
        return new Disposable(() => {});
      },
      onDidChange(_cb: (uri: Uri) => void) {
        return new Disposable(() => {});
      },
      onDidDelete(_cb: (uri: Uri) => void) {
        return new Disposable(() => {});
      },
      dispose() {},
    };
  },
  fs: {
    readFile: async (_uri: Uri): Promise<Uint8Array> => new Uint8Array(),
  },
  getConfiguration(_section: string) {
    return {
      get<T>(_key: string, fallback?: T): T | undefined {
        return fallback;
      },
    };
  },
};
