<script lang="ts">
import '@xterm/xterm/css/xterm.css';

import { EmptyScreen } from '@podman-desktop/ui-svelte';
import { FitAddon } from '@xterm/addon-fit';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal } from '@xterm/xterm';
import { onDestroy, onMount } from 'svelte';
import { router } from 'tinro';

import { getTerminalTheme } from '/@/lib/terminal/terminal-theme';
import NoLogIcon from '/@/lib/ui/NoLogIcon.svelte';
import { getExistingTerminal, registerTerminal } from '/@/stores/agent-workspace-terminal-store';
import type { AgentWorkspaceStatus } from '/@/stores/agent-workspaces.svelte';
import { agentWorkspaceStatuses } from '/@/stores/agent-workspaces.svelte';
import { TerminalSettings } from '/@api/terminal/terminal-settings';

interface Props {
  workspaceId: string;
  screenReaderMode?: boolean;
}

let { workspaceId, screenReaderMode = false }: Props = $props();
let terminalXtermDiv: HTMLDivElement;
let shellTerminal: Terminal;
let currentRouterPath: string;
let sendCallbackId: number | undefined;
let serializeAddon: SerializeAddon;
let inputDisposable: { dispose: () => void } | undefined;
let handleResize: (() => void) | undefined;

const status: AgentWorkspaceStatus = $derived(agentWorkspaceStatuses.get(workspaceId) ?? 'stopped');
const isRunning = $derived(status === 'running');
let lastStatus = $state<AgentWorkspaceStatus>('stopped');

$effect(() => {
  if (lastStatus === 'starting' && status === 'running') {
    executeShellInWorkspace().catch((err: unknown) =>
      console.error(`Error starting terminal for workspace ${workspaceId}`, err),
    );
  }
  lastStatus = status;
});

router.subscribe(route => {
  currentRouterPath = route.path;
});

function createDataCallback(): (data: string) => void {
  return (data: string) => {
    shellTerminal.write(data);
  };
}

function receiveEndCallback(): void {
  if (sendCallbackId && isRunning) {
    window
      .shellInAgentWorkspace(workspaceId, createDataCallback(), () => {}, receiveEndCallback)
      .then(id => {
        sendCallbackId = id;
        inputDisposable?.dispose();
        inputDisposable = shellTerminal?.onData(async data => {
          await window.shellInAgentWorkspaceSend(id, data);
        });
      })
      .catch((err: unknown) => console.error(`Error reopening terminal for workspace ${workspaceId}`, err));
  }
}

async function executeShellInWorkspace(): Promise<void> {
  if (!isRunning) {
    return;
  }
  const callbackId = await window.shellInAgentWorkspace(
    workspaceId,
    createDataCallback(),
    () => {},
    receiveEndCallback,
  );
  await window.shellInAgentWorkspaceResize(callbackId, shellTerminal.cols, shellTerminal.rows);
  inputDisposable?.dispose();
  inputDisposable = shellTerminal?.onData(data => {
    window.shellInAgentWorkspaceSend(callbackId, data).catch((error: unknown) => console.log(String(error)));
  });
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

  if (existingTerminal) {
    shellTerminal.options = { fontSize, lineHeight };
    shellTerminal.write(existingTerminal.terminal);
  }

  const fitAddon = new FitAddon();
  serializeAddon = new SerializeAddon();
  shellTerminal.loadAddon(fitAddon);
  shellTerminal.loadAddon(serializeAddon);

  shellTerminal.open(terminalXtermDiv);

  handleResize = (): void => {
    if (currentRouterPath.includes(`/agent-workspaces/${encodeURIComponent(workspaceId)}/terminal`)) {
      fitAddon.fit();
      if (sendCallbackId) {
        window
          .shellInAgentWorkspaceResize(sendCallbackId, shellTerminal.cols, shellTerminal.rows)
          .catch((err: unknown) => console.error(`Error resizing terminal for workspace ${workspaceId}`, err));
      }
    }
  };
  window.addEventListener('resize', handleResize);
  fitAddon.fit();
}

onMount(async () => {
  await refreshTerminal();
  await executeShellInWorkspace();
});

onDestroy(() => {
  if (handleResize) {
    window.removeEventListener('resize', handleResize);
  }
  inputDisposable?.dispose();
  const terminalContent = serializeAddon?.serialize() ?? '';
  registerTerminal({
    workspaceId,
    callbackId: sendCallbackId,
    terminal: terminalContent,
  });
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
