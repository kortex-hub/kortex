import { Dialog as SheetPrimitive } from 'bits-ui';
import type { ComponentProps } from 'svelte';

import Close from './sheet-close.svelte';
import Content from './sheet-content.svelte';
import Description from './sheet-description.svelte';
import Footer from './sheet-footer.svelte';
import Header from './sheet-header.svelte';
import Overlay from './sheet-overlay.svelte';
import Title from './sheet-title.svelte';
import Trigger from './sheet-trigger.svelte';

const Root = SheetPrimitive.Root;
const Portal = SheetPrimitive.Portal;

type SheetProps = ComponentProps<typeof Root>;
type CloseProps = ComponentProps<typeof Close>;
type TriggerProps = ComponentProps<typeof Trigger>;
type SheetPortalProps = ComponentProps<typeof Portal>;
type SheetOverlayProps = ComponentProps<typeof Overlay>;
type SheetContentProps = ComponentProps<typeof Content>;
type SheetHeaderProps = ComponentProps<typeof Header>;
type SheetFooterProps = ComponentProps<typeof Footer>;
type SheetTitleProps = ComponentProps<typeof Title>;
type SheetDescriptionProps = ComponentProps<typeof Description>;

export {
  Close,
  type CloseProps,
  Content,
  Description,
  Footer,
  Header,
  Overlay,
  Portal,
  Root,
  //
  Root as Sheet,
  Close as SheetClose,
  Content as SheetContent,
  type SheetContentProps,
  Description as SheetDescription,
  type SheetDescriptionProps,
  Footer as SheetFooter,
  type SheetFooterProps,
  Header as SheetHeader,
  type SheetHeaderProps,
  Overlay as SheetOverlay,
  type SheetOverlayProps,
  Portal as SheetPortal,
  type SheetPortalProps,
  type SheetProps,
  Title as SheetTitle,
  type SheetTitleProps,
  Trigger as SheetTrigger,
  Title,
  Trigger,
  type TriggerProps,
};
