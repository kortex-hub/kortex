<script lang="ts">
import type { Attachment } from '@ai-sdk/ui-utils';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import {
  faFile,
  faFileAudio,
  faFileCode,
  faFileCsv,
  faFileExcel,
  faFileLines,
  faFilePdf,
  faFileVideo,
  faFileWord,
  faFileZipper,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@podman-desktop/ui-svelte/icons';

import LoaderIcon from './icons/loader.svelte';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

let {
  attachment,
  uploading = false,
  onremove,
}: {
  attachment: Attachment;
  uploading?: boolean;
  onremove?: () => void;
} = $props();

const { url, contentType } = $derived(attachment);

function decodeAttachmentName(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const name = $derived(decodeAttachmentName(attachment.name));

function getFileIcon(mimeType?: string): IconDefinition {
  if (!mimeType) return faFile;
  if (mimeType === 'application/pdf') return faFilePdf;
  if (mimeType.startsWith('audio/')) return faFileAudio;
  if (mimeType.startsWith('video/')) return faFileVideo;
  if (mimeType === 'text/csv') return faFileCsv;
  if (
    mimeType === 'text/html' ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType === 'text/xml'
  )
    return faFileCode;
  if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') return faFileWord;
  if (mimeType.includes('spreadsheetml') || mimeType === 'application/vnd.ms-excel') return faFileExcel;
  if (
    mimeType.includes('zip') ||
    mimeType.includes('compressed') ||
    mimeType.includes('tar') ||
    mimeType.includes('gzip')
  )
    return faFileZipper;
  if (mimeType.startsWith('text/')) return faFileLines;
  return faFile;
}
</script>

<Tooltip>
	<TooltipTrigger>
		{#snippet child({ props })}
			<div
				class="group/attachment flex flex-col gap-2 pt-2 pr-2"
				{...props}
			>
				<div
					class="bg-muted relative flex aspect-video h-16 w-20 flex-col items-center justify-center overflow-visible rounded-md"
				>
					{#if contentType?.startsWith('image')}
						<img
							src={url}
							alt={name ?? 'An image attachment'}
							class="size-full rounded-md object-cover"
						/>
					{:else}
						<Icon icon={getFileIcon(contentType)} class="text-muted-foreground fa-2x" />
					{/if}

					{#if uploading}
						<div class="absolute animate-spin text-zinc-500">
							<LoaderIcon />
						</div>
					{/if}

					{#if onremove}
						<button
							class="absolute -top-1.5 -right-1.5 z-10 hidden h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-white group-hover/attachment:flex group-focus-within/attachment:flex"
							onclick={onremove}
							aria-label="Remove attachment"
						>
							<Icon icon={faXmark} class="text-[10px]" />
						</button>
					{/if}
				</div>
				<div class="max-w-16 truncate text-xs text-zinc-500">{name ?? 'Untitled'}</div>
			</div>
		{/snippet}
	</TooltipTrigger>
	{#if name}
		<TooltipContent>{name}</TooltipContent>
	{/if}
</Tooltip>
