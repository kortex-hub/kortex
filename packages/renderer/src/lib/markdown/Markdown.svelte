<!-- The markdown rendered has it's own style that you'll have to customize / check against podman desktop
UI guidelines -->
<style lang="postcss">
.markdown > :global(p) {
  line-height: normal;
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.markdown > :global(h1),
:global(h2),
:global(h3),
:global(h4),
:global(h5) {
  font-size: revert;
  line-height: normal;
  font-weight: revert;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}

.markdown > :global(ul) {
  line-height: normal;
  list-style: revert;
  margin: revert;
  padding: revert;
}

.markdown > :global(b),
:global(strong) {
  font-weight: 600;
}
.markdown > :global(blockquote) {
  opacity: 0.8;
  line-height: normal;
}
.markdown :global(table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 16px;
}
.markdown :global(th),
.markdown :global(td) {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 6px 12px;
  text-align: left;
}
.markdown :global(th) {
  font-weight: 600;
  background-color: var(--muted);
  border-bottom-width: 2px;
}
.markdown :global(tr:nth-child(even)) {
  background-color: var(--muted);
}
.markdown > :global(pre) {
  margin-bottom: 8px;
}
.markdown :global(a) {
  color: var(--pd-link);
  text-decoration: none;
  border-radius: 4px;
}
.markdown :global(a):hover {
  background-color: var(--pd-link-hover-bg);
}
</style>

<script lang="ts">
import './syntax-highlighting.css';

import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { micromark } from 'micromark';
import { directive, directiveHtml } from 'micromark-extension-directive';
import { gfmAutolinkLiteral, gfmAutolinkLiteralHtml } from 'micromark-extension-gfm-autolink-literal';
import { gfmTable, gfmTableHtml } from 'micromark-extension-gfm-table';
import { onDestroy, onMount } from 'svelte';

import { button } from './micromark-button-directive';
import { fallback } from './micromark-fallback-directive';
import { image } from './micromark-image-directive';
import { link } from './micromark-link-directive';
import { createListener } from './micromark-listener-handler';
import { warnings } from './micromark-warnings-directive';

let text: string;
let html: string;

// Optional attribute to specify the markdown to use
// the user can use: <Markdown>**bold</Markdown> or <Markdown markdown="**bold**" /> syntax
export let markdown = '';

// Whether to allow raw HTML tags in markdown prose.
// Safe for model responses; should be disabled for user-authored content.
export let allowDangerousHtml = false;

// Button micromark related:
//
// In progress execution callbacks for all markdown buttons.
export let inProgressMarkdownCommandExecutionCallback: (
  command: string,
  state: 'starting' | 'failed' | 'successful',
  value?: unknown,
) => void = () => {};

// Create an event listener for updating the in-progress markdown command execution callback
const eventListeners: EventListener[] = [];

// Render the markdown or the html+micromark markdown reactively
$: html = markdown ? renderMarkdown(markdown, allowDangerousHtml) : '';

function renderMarkdown(source: string, dangerousHtml: boolean): string {
  // Provide micromark + extensions
  const rendered = micromark(source, {
    allowDangerousHtml: dangerousHtml,
    extensions: [gfmAutolinkLiteral(), gfmTable(), directive()],
    htmlExtensions: [
      gfmAutolinkLiteralHtml(),
      gfmTableHtml(),
      directiveHtml({ button, image, link, warnings, '*': fallback }),
    ],
  });

  // remove href values in each anchor using # for links
  // and set the attribute data-pd-jump-in-page
  const parser = new DOMParser();
  const doc = parser.parseFromString(rendered, 'text/html');
  const links = doc.querySelectorAll('a');
  links.forEach(link => {
    const currentHref = link.getAttribute('href');
    // remove and replace href attribute if matching
    if (currentHref?.startsWith('#')) {
      // get current value of href
      link.removeAttribute('href');

      // remove from current href the #
      const withoutHashHRef = currentHref.substring(1);

      // add an attribute to handle onclick
      link.setAttribute('data-pd-jump-in-page', withoutHashHRef);

      // add a class for cursor
      link.classList.add('cursor-pointer');
    } else if (link.getAttribute('href')?.startsWith('podman-desktop://')) {
      let internalLink = '';
      internalLink = link.getAttribute('href')?.replace('podman-desktop://', '/') ?? '';
      link.setAttribute('href', internalLink);
    }
  });

  // for all h1/h2/h3/h4/h5/h6, add an id attribute being the name of the attibute all in lowercase without spaces (replaced by -)
  const headers = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headers.forEach(header => {
    const headerText = header.textContent;
    const headerId = headerText?.toLowerCase().replace(/\s/g, '-');
    if (headerId) {
      header.setAttribute('id', headerId);
    }
  });

  // Apply syntax highlighting to code blocks
  doc.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block as HTMLElement);
  });

  // Sanitize the output to prevent XSS from raw HTML (e.g. <img onerror="...">)
  return DOMPurify.sanitize(doc.body.innerHTML, {
    ADD_ATTR: ['data-pd-jump-in-page', 'data-command', 'data-args', 'data-expandable'],
  });
}

onMount(() => {
  if (markdown) {
    text = markdown;
  }

  // We create a click listener in order to execute any internal micromark commands
  // We add the clickListener here since we're unable to add it in the directive typescript file.
  const clickListener = createListener(inProgressMarkdownCommandExecutionCallback);

  // Push the click listener to the eventListeners array so we can remove it on destroy
  eventListeners.push(clickListener);
  document.addEventListener('click', clickListener);
});

// Remove on destroy / make sure we do not listen anymore.
onDestroy(() => {
  eventListeners.forEach(listener => document.removeEventListener('click', listener));
});
</script>

<!-- Placeholder to grab the content if people are using <Markdown>**bold</Markdown> -->
<span contenteditable="false" bind:textContent={text} class="hidden">
  <slot />
</span>

<section class="markdown" aria-label="markdown-content">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html html}
</section>
