const startTime = performance.now();

function isEnabled(namespace: string): boolean {
  const debug = process.env['DEBUG'] ?? '';
  if (!debug) return false;

  const patterns = debug.split(',').map(p => p.trim());
  const full = `acp:${namespace}`;

  return patterns.some(pattern => {
    if (pattern === 'acp' || pattern === 'acp:*') return true;
    return pattern === full;
  });
}

export function createAcpDebug(namespace: string): (...args: unknown[]) => void {
  return (...args: unknown[]): void => {
    if (!isEnabled(namespace)) return;
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);
    console.debug(`[ACP:${namespace} +${elapsed}s]`, ...args);
  };
}
