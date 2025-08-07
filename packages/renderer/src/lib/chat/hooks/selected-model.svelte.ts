import { SynchronizedCookie } from '/@/lib/chat/utils/reactivity.svelte';

export class SelectedModel extends SynchronizedCookie {
  constructor(value: string) {
    super('selected-model', value);
  }

  static fromContext(): SelectedModel {
    return super.fromContext('selected-model');
  }
}
