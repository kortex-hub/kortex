import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
import type { ComponentProps } from 'svelte';

import Action from './alert-dialog-action.svelte';
import Cancel from './alert-dialog-cancel.svelte';
import Content from './alert-dialog-content.svelte';
import Description from './alert-dialog-description.svelte';
import Footer from './alert-dialog-footer.svelte';
import Header from './alert-dialog-header.svelte';
import Overlay from './alert-dialog-overlay.svelte';
import Title from './alert-dialog-title.svelte';
import Trigger from './alert-dialog-trigger.svelte';

const Root = AlertDialogPrimitive.Root;
const Portal = AlertDialogPrimitive.Portal;

type AlertDialogProps = ComponentProps<typeof Root>;
type AlertDialogTriggerProps = ComponentProps<typeof Trigger>;
type AlertDialogPortalProps = ComponentProps<typeof Portal>;
type AlertDialogTitleProps = ComponentProps<typeof Title>;
type AlertDialogActionProps = ComponentProps<typeof Action>;
type AlertDialogCancelProps = ComponentProps<typeof Cancel>;
type AlertDialogFooterProps = ComponentProps<typeof Footer>;
type AlertDialogHeaderProps = ComponentProps<typeof Header>;
type AlertDialogOverlayProps = ComponentProps<typeof Overlay>;
type AlertDialogContentProps = ComponentProps<typeof Content>;
type AlertDialogDescriptionProps = ComponentProps<typeof Description>;

export {
  Action,
  //
  Root as AlertDialog,
  Action as AlertDialogAction,
  type AlertDialogActionProps,
  Cancel as AlertDialogCancel,
  type AlertDialogCancelProps,
  Content as AlertDialogContent,
  type AlertDialogContentProps,
  Description as AlertDialogDescription,
  type AlertDialogDescriptionProps,
  Footer as AlertDialogFooter,
  type AlertDialogFooterProps,
  Header as AlertDialogHeader,
  type AlertDialogHeaderProps,
  Overlay as AlertDialogOverlay,
  type AlertDialogOverlayProps,
  Portal as AlertDialogPortal,
  type AlertDialogPortalProps,
  type AlertDialogProps,
  Title as AlertDialogTitle,
  type AlertDialogTitleProps,
  Trigger as AlertDialogTrigger,
  type AlertDialogTriggerProps,
  Cancel,
  Content,
  Description,
  Footer,
  Header,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
};
