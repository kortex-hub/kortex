import { getContext, setContext } from 'svelte';

import type { Chat } from '../../../../../main/src/chat/db/schema';

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
      .catch((e: unknown) => console.error(e))
      .finally(() => {
        this.#loading = false;
        this.#revalidating = false;
      });
  }

  getChatDetails = (chatId: string): Chat | undefined => {
    return this.chats.find(c => c.id === chatId);
  };

  setContext(): void {
    setContext(contextKey, this);
  }

  async refetch(): Promise<void> {
    this.#revalidating = true;
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        this.chats = await res.json();
      }
    } finally {
      this.#revalidating = false;
    }
  }

  static fromContext(): ChatHistory {
    return getContext(contextKey);
  }
}
