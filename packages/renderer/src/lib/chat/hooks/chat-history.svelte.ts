import { getContext, setContext } from 'svelte';
import { toast } from 'svelte-sonner';

import type { VisibilityType } from '/@/lib/chat/components/visibility-type';
import type { Chat } from '/@api/chat/schema.js';

const contextKey = Symbol('ChatHistory');

export class ChatHistory {
  #loading = $state(false);
  #revalidating = $state(false);
  chats = $state<Chat[]>([]);

  get loading(): boolean {
    return this.#loading;
  }

  get revalidating(): boolean {
    return this.#revalidating;
  }

  constructor(chatsPromise: Promise<Chat[]>) {
    this.#loading = true;
    this.#revalidating = true;
    chatsPromise
      .then(chats => (this.chats = chats))
      .finally(() => {
        this.#loading = false;
        this.#revalidating = false;
      })
      .catch((error: unknown) => {
        console.error('Failed to load chat history', error);
      });
  }

  getChatDetails = (chatId: string): Chat | undefined => {
    return this.chats.find(c => c.id === chatId);
  };

  updateVisibility = async (chatId: string, visibility: VisibilityType): Promise<void> => {
    const chat = this.chats.find(c => c.id === chatId);
    if (chat) {
      chat.visibility = visibility;
    }
    const res = await fetch('/api/chat/visibility', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chatId, visibility }),
    });
    if (!res.ok) {
      toast.error('Failed to update chat visibility');
      // try reloading data from source in case another competing mutation caused an issue
      await this.refetch();
    }
  };

  setContext(): void {
    setContext(contextKey, this);
  }

  async refetch(): Promise<void> {
    this.#revalidating = true;
    try {
      this.chats = await window.inferenceGetChats();
    } finally {
      this.#revalidating = false;
    }
  }

  static fromContext(): ChatHistory {
    return getContext(contextKey);
  }
}
