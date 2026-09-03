import type { UIMessage } from '@ai-sdk/svelte';
import { getContext, setContext } from 'svelte';

const contextKey = Symbol('EditState');

export class EditState {
  editingMessage = $state<UIMessage | undefined>(undefined);

  get isEditing(): boolean {
    return this.editingMessage !== undefined;
  }

  startEditing(message: UIMessage): void {
    this.editingMessage = message;
  }

  cancelEditing(): void {
    this.editingMessage = undefined;
  }

  isAfterEditingMessage(messages: UIMessage[], message: UIMessage): boolean {
    if (!this.editingMessage) return false;
    const editIndex = messages.findIndex(m => m.id === this.editingMessage!.id);
    const messageIndex = messages.findIndex(m => m.id === message.id);
    return messageIndex > editIndex;
  }

  static fromContext(): EditState {
    return getContext<EditState>(contextKey);
  }

  static toContext(): EditState {
    const state = new EditState();
    setContext(contextKey, state);
    return state;
  }
}
