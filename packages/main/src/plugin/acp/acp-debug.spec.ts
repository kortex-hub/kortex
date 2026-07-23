import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createAcpDebug } from './acp-debug.js';

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env['DEBUG'];
});

describe('createAcpDebug', () => {
  test('suppresses output when DEBUG is unset', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const debug = createAcpDebug('pty');
    debug('hello');
    expect(spy).not.toHaveBeenCalled();
  });

  test('suppresses output when DEBUG is empty', () => {
    process.env['DEBUG'] = '';
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const debug = createAcpDebug('pty');
    debug('hello');
    expect(spy).not.toHaveBeenCalled();
  });

  test('enables all namespaces with DEBUG=acp', () => {
    process.env['DEBUG'] = 'acp';
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const debugPty = createAcpDebug('pty');
    const debugProtocol = createAcpDebug('protocol');
    debugPty('pty msg');
    debugProtocol('protocol msg');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('enables all namespaces with DEBUG=acp:*', () => {
    process.env['DEBUG'] = 'acp:*';
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const debugPty = createAcpDebug('pty');
    const debugLifecycle = createAcpDebug('lifecycle');
    debugPty('msg1');
    debugLifecycle('msg2');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('enables only matching namespace with DEBUG=acp:pty', () => {
    process.env['DEBUG'] = 'acp:pty';
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const debugPty = createAcpDebug('pty');
    const debugProtocol = createAcpDebug('protocol');
    debugPty('should print');
    debugProtocol('should not print');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[ACP:pty'), 'should print');
  });

  test('supports comma-separated patterns', () => {
    process.env['DEBUG'] = 'acp:pty,acp:lifecycle';
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const debugPty = createAcpDebug('pty');
    const debugProtocol = createAcpDebug('protocol');
    const debugLifecycle = createAcpDebug('lifecycle');
    debugPty('a');
    debugProtocol('b');
    debugLifecycle('c');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('prefixes output with namespace and timestamp', () => {
    process.env['DEBUG'] = 'acp';
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const debug = createAcpDebug('pty');
    debug('test message');
    expect(spy).toHaveBeenCalledTimes(1);
    const prefix = spy.mock.calls[0]![0] as string;
    expect(prefix).toMatch(/^\[ACP:pty \+\d+\.\d+s\]$/);
  });

  test('passes through multiple arguments', () => {
    process.env['DEBUG'] = 'acp';
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const debug = createAcpDebug('protocol');
    debug('init', { version: 1 }, 42);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[ACP:protocol'), 'init', { version: 1 }, 42);
  });

  test('responds to DEBUG changes at call time', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const debug = createAcpDebug('pty');

    debug('before');
    expect(spy).not.toHaveBeenCalled();

    process.env['DEBUG'] = 'acp';
    debug('after');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('ignores unrelated DEBUG values', () => {
    process.env['DEBUG'] = 'express:*,http';
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const debug = createAcpDebug('pty');
    debug('hello');
    expect(spy).not.toHaveBeenCalled();
  });
});
