import { Tooltip as TooltipPrimitive } from 'bits-ui';
import type { ComponentProps } from 'svelte';

import Content from './tooltip-content.svelte';
import Trigger from './tooltip-trigger.svelte';

const Root = TooltipPrimitive.Root;
const Provider = TooltipPrimitive.Provider;
const Portal = TooltipPrimitive.Portal;

type TooltipProps = ComponentProps<typeof Root>;
type TooltipTriggerProps = ComponentProps<typeof Trigger>;
type TooltipProviderProps = ComponentProps<typeof Provider>;
type TooltipContentProps = ComponentProps<typeof Content>;

export {
  Content,
  Portal,
  Provider,
  Root,
  //
  Root as Tooltip,
  Content as TooltipContent,
  type TooltipContentProps,
  type TooltipProps,
  Provider as TooltipProvider,
  type TooltipProviderProps,
  Trigger as TooltipTrigger,
  type TooltipTriggerProps,
  Trigger,
};
