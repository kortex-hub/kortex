import { MediaQuery } from 'svelte/reactivity';

import { BREAKPOINTS } from '/@/lib/chat/utils/constants';

export class IsMobile extends MediaQuery {
  constructor() {
    super(`max-width: ${BREAKPOINTS.md.value - 1}${BREAKPOINTS.md.unit}`);
  }
}
