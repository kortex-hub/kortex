<script lang="ts">
import '@xterm/xterm/css/xterm.css';

import { EmptyScreen } from '@podman-desktop/ui-svelte';
import { FitAddon } from '@xterm/addon-fit';
import { SerializeAddon } from '@xterm/addon-serialize';
import type { IDisposable } from '@xterm/xterm';
import { Terminal } from '@xterm/xterm';
import { onDestroy, onMount } from 'svelte';
import { router } from 'tinro';

import { getTerminalTheme } from '/@/lib/terminal/terminal-theme';
import NoLogIcon from '/@/lib/ui/NoLogIcon.svelte';
import { getExistingTerminal, registerTerminal } from '/@/stores/agent-workspace-terminal-store';
import { allOpenshellSandboxes } from '/@/stores/openshell-sandboxes';
import { AGENT_LABEL } from '/@api/openshell-gateway-info';
import { TerminalSettings } from '/@api/terminal/terminal-settings';

const MAX_RECONNECT_ATTEMPTS = 30;

interface Props {
  workspaceId: string;
  screenReaderMode?: boolean;
  reconnectExhausted?: boolean;
  reconnect?: () => void;
}

let {
  workspaceId,
  screenReaderMode = false,
  reconnectExhausted = $bindable(false),
  reconnect = $bindable(),
}: Props = $props();
let terminalXtermDiv: HTMLDivElement;
let shellTerminal: Terminal;
let currentRouterPath: string;
let sendCallbackId: number | undefined;
let serializeAddon: SerializeAddon;
let fitAddon: FitAddon;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let onDataDisposable: IDisposable | undefined;
let reconnecting = false;
let reconnectCount = 0;

const workspaceSummary = $derived($allOpenshellSandboxes.find(ws => ws.id === workspaceId));
const status = $derived(workspaceSummary?.phase ?? 'Provisioning');
const isRunning = $derived(status === 'Ready');
const hasAgent = $derived(Boolean(workspaceSummary?.labels?.[AGENT_LABEL]));
let lastStatus = $state('');

function registerInputHandler(callbackId: number): void {
  onDataDisposable?.dispose();
  onDataDisposable = shellTerminal?.onData(data => {
    window.shellInAgentWorkspaceSend(callbackId, data).catch((error: unknown) => console.log(String(error)));
  });
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  if (reconnectCount >= MAX_RECONNECT_ATTEMPTS) {
    reconnectExhausted = true;
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    if (isRunning) {
      restartTerminal().catch((err: unknown) => {
        console.error(`Error reopening terminal for workspace ${workspaceId}`, err);
        scheduleReconnect();
      });
    }
  }, 2000);
}

async function restartTerminal(): Promise<void> {
  if (reconnecting) return;
  if (reconnectCount >= MAX_RECONNECT_ATTEMPTS) {
    reconnectExhausted = true;
    return;
  }
  reconnectCount++;
  reconnecting = true;
  try {
    clearReconnectTimer();
    await executeShellInWorkspace();
    window.dispatchEvent(new Event('resize'));
  } finally {
    reconnecting = false;
  }
}

function manualReconnect(): void {
  reconnectCount = 0;
  reconnectExhausted = false;
  restartTerminal().catch((err: unknown) => {
    console.error(`Error reconnecting terminal for workspace ${workspaceId}`, err);
    scheduleReconnect();
  });
}

$effect(() => {
  if (lastStatus !== '' && lastStatus !== 'Ready' && status === 'Ready') {
    reconnectCount = 0;
    reconnectExhausted = false;
    restartTerminal().catch((err: unknown) => {
      console.error(`Error starting terminal for workspace ${workspaceId}`, err);
      scheduleReconnect();
    });
  }
  lastStatus = status;
});

router.subscribe(route => {
  currentRouterPath = route.path;
});

function handleResize(): void {
  if (currentRouterPath.includes(`/agent-workspaces/${encodeURIComponent(workspaceId)}/terminal`)) {
    fitAddon.fit();
    if (sendCallbackId) {
      window
        .shellInAgentWorkspaceResize(sendCallbackId, shellTerminal.cols, shellTerminal.rows)
        ?.catch((err: unknown) => console.error(`Error resizing terminal for workspace ${workspaceId}`, err));
    }
  }
}

let skipBeforeUnload = false;

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (sendCallbackId !== undefined && hasAgent && !skipBeforeUnload) {
    event.preventDefault();
  }
}

function handleConfirmReload(): void {
  window
    .showMessageBox({
      title: 'Reload Application',
      message:
        'If an agent session is active, reloading will disconnect it and the agent terminal will be lost. Do you want to continue?',
      type: 'warning',
      buttons: ['Reload', 'Cancel'],
    })
    .then(result => {
      if (result?.response === 0) {
        skipBeforeUnload = true;
        location.reload();
      }
    })
    .catch((err: unknown) => console.error('Error showing reload confirmation', err));
}

function createDataCallback(): (data: string) => void {
  return (data: string) => {
    shellTerminal.write(data);
  };
}

function receiveEndCallback(): void {
  const callbackId = sendCallbackId;
  sendCallbackId = undefined;

  let content = '';
  try {
    content = serializeAddon?.serialize() ?? '';
  } catch {
    /* addon disposed */
  }
  registerTerminal({ workspaceId, callbackId: undefined, terminal: content });

  if (!callbackId) return;

  if (reconnecting) {
    scheduleReconnect();
    return;
  }

  if (isRunning) {
    restartTerminal().catch((err: unknown) => {
      console.error(`Error reopening terminal for workspace ${workspaceId}`, err);
      scheduleReconnect();
    });
  } else {
    scheduleReconnect();
  }
}

async function executeShellInWorkspace(): Promise<void> {
  if (!isRunning) {
    return;
  }

  const existing = getExistingTerminal(workspaceId);
  if (existing?.callbackId !== undefined) {
    sendCallbackId = existing.callbackId;
    window.shellInAgentWorkspaceReattach(existing.callbackId, createDataCallback(), () => {}, receiveEndCallback);
    registerInputHandler(existing.callbackId);
    await window.shellInAgentWorkspaceResize(existing.callbackId, shellTerminal.cols, shellTerminal.rows);
    return;
  }

  const callbackId = await window.shellInAgentWorkspace(
    workspaceId,
    createDataCallback(),
    () => {},
    receiveEndCallback,
  );
  await window.shellInAgentWorkspaceResize(callbackId, shellTerminal.cols, shellTerminal.rows);
  registerInputHandler(callbackId);
  sendCallbackId = callbackId;
}

async function refreshTerminal(): Promise<void> {
  if (!terminalXtermDiv) {
    return;
  }

  const fontSize = await window.getConfigurationValue<number>(
    TerminalSettings.SectionName + '.' + TerminalSettings.FontSize,
  );
  const lineHeight = await window.getConfigurationValue<number>(
    TerminalSettings.SectionName + '.' + TerminalSettings.LineHeight,
  );
  const scrollback = await window.getConfigurationValue<number>(
    TerminalSettings.SectionName + '.' + TerminalSettings.Scrollback,
  );

  const existingTerminal = getExistingTerminal(workspaceId);

  shellTerminal = new Terminal({
    fontSize,
    lineHeight,
    screenReaderMode,
    theme: getTerminalTheme(),
    scrollback,
  });

  if (existingTerminal?.callbackId !== undefined) {
    shellTerminal.options = { fontSize, lineHeight };
    shellTerminal.write(existingTerminal.terminal);
  }

  fitAddon = new FitAddon();
  serializeAddon = new SerializeAddon();
  shellTerminal.loadAddon(fitAddon);
  shellTerminal.loadAddon(serializeAddon);

  shellTerminal.open(terminalXtermDiv);
  fitAddon.fit();
  window.dispatchEvent(new Event('resize'));
}

let confirmReloadDisposable: { dispose: () => void } | undefined;

onMount(async () => {
  reconnect = manualReconnect;
  reconnectExhausted = false;
  reconnectCount = 0;
  await refreshTerminal();
  window.addEventListener('resize', handleResize);
  window.addEventListener('beforeunload', handleBeforeUnload);
  confirmReloadDisposable = window.events?.receive('agent-terminal:confirm-reload', handleConfirmReload);
  await executeShellInWorkspace();
});

onDestroy(() => {
  clearReconnectTimer();
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  confirmReloadDisposable?.dispose();
  onDataDisposable?.dispose();
  const terminalContent = serializeAddon?.serialize() ?? '';
  registerTerminal({ workspaceId, callbackId: sendCallbackId, terminal: terminalContent });
  serializeAddon?.dispose();
  shellTerminal?.dispose();
  sendCallbackId = undefined;
});
</script>

<div
  class="h-full p-[5px] pr-0 bg-[var(--pd-terminal-background)]"
  bind:this={terminalXtermDiv}
  class:hidden={!isRunning}>
</div>

<EmptyScreen
  hidden={isRunning}
  icon={NoLogIcon}
  title="No Terminal"
  message="Workspace is not running" />
