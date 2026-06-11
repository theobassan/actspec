import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tests, Uri, Disposable, workspace } from 'vscode';
import { createWatcher } from '../src/watcher.js';

vi.mock('../src/discover.js', () => ({
  discoverWorkspace: vi.fn().mockResolvedValue(undefined),
  discoverFile: vi.fn().mockResolvedValue(undefined),
}));

import { discoverFile, discoverWorkspace } from '../src/discover.js';

function makeCtrl() {
  return tests.createTestController('test', 'test');
}

type WatcherCallback = (uri: Uri) => void;

function makeWatcherFactory() {
  const instances: {
    pattern: string;
    onCreate: WatcherCallback | null;
    onChange: WatcherCallback | null;
    onDelete: WatcherCallback | null;
  }[] = [];

  vi.spyOn(workspace, 'createFileSystemWatcher').mockImplementation((pattern) => {
    const entry = { pattern: String(pattern), onCreate: null, onChange: null, onDelete: null };
    instances.push(entry);
    return {
      onDidCreate(cb: WatcherCallback) { entry.onCreate = cb; return new Disposable(() => {}); },
      onDidChange(cb: WatcherCallback) { entry.onChange = cb; return new Disposable(() => {}); },
      onDidDelete(cb: WatcherCallback) { entry.onDelete = cb; return new Disposable(() => {}); },
      dispose() {},
    } as never;
  });

  return instances;
}

describe('createWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Disposable', () => {
    makeWatcherFactory();
    const ctrl = makeCtrl();
    const disposable = createWatcher(ctrl);
    expect(typeof disposable.dispose).toBe('function');
  });

  it('calls discoverFile on test file create', () => {
    const instances = makeWatcherFactory();
    const ctrl = makeCtrl();
    createWatcher(ctrl);

    const testWatcher = instances.find((i) => i.pattern.includes('actharness,test'));
    const uri = Uri.file('/ws/new.test.ts');
    testWatcher!.onCreate!(uri);

    expect(discoverFile).toHaveBeenCalledWith(ctrl, uri);
  });

  it('calls discoverFile on test file change', () => {
    const instances = makeWatcherFactory();
    const ctrl = makeCtrl();
    createWatcher(ctrl);

    const testWatcher = instances.find((i) => i.pattern.includes('actharness,test'));
    const uri = Uri.file('/ws/greet.test.ts');
    testWatcher!.onChange!(uri);

    expect(discoverFile).toHaveBeenCalledWith(ctrl, uri);
  });

  it('deletes item on test file delete', () => {
    const instances = makeWatcherFactory();
    const ctrl = makeCtrl();
    const uri = Uri.file('/ws/gone.test.ts');
    const item = ctrl.createTestItem(uri.toString(), 'gone.test.ts', uri);
    ctrl.items.add(item);
    createWatcher(ctrl);

    const testWatcher = instances.find((i) => i.pattern.includes('actharness,test'));
    testWatcher!.onDelete!(uri);

    expect(ctrl.items.get(uri.toString())).toBeUndefined();
  });

  it('calls discoverWorkspace on config file create', () => {
    const instances = makeWatcherFactory();
    const ctrl = makeCtrl();
    createWatcher(ctrl);

    const configWatcher = instances.find((i) => i.pattern.includes('actharness.config'));
    configWatcher!.onCreate!(Uri.file('/ws/actharness.config.json'));

    expect(discoverWorkspace).toHaveBeenCalledWith(ctrl);
  });

  it('calls discoverWorkspace on config file change', () => {
    const instances = makeWatcherFactory();
    const ctrl = makeCtrl();
    createWatcher(ctrl);

    const configWatcher = instances.find((i) => i.pattern.includes('actharness.config'));
    configWatcher!.onChange!(Uri.file('/ws/actharness.config.ts'));

    expect(discoverWorkspace).toHaveBeenCalledWith(ctrl);
  });

  it('calls discoverWorkspace on config file delete', () => {
    const instances = makeWatcherFactory();
    const ctrl = makeCtrl();
    createWatcher(ctrl);

    const configWatcher = instances.find((i) => i.pattern.includes('actharness.config'));
    configWatcher!.onDelete!(Uri.file('/ws/actharness.config.ts'));

    expect(discoverWorkspace).toHaveBeenCalledWith(ctrl);
  });
});
