<script lang="ts">
import { handleNavigation } from '/@/navigation';
import type { FlowInfo } from '/@api/flow-info';
import { NavigationPage } from '/@api/navigation-page';

interface Props {
  object: FlowInfo;
}

let { object }: Props = $props();

function openDetails(workflow: FlowInfo): void {
  handleNavigation({
    page: NavigationPage.FLOW_DETAILS,
    parameters: {
      providerId: workflow.providerId,
      connectionName: workflow.connectionName,
      flowId: workflow.id,
    },
  });
}
</script>

<button class="flex flex-col whitespace-nowrap max-w-full" onclick={openDetails.bind(undefined, object)}>
  <div class="flex items-center max-w-full">
    <div class="max-w-full">
      <div class="flex flex-nowrap max-w-full">
        <div
          class="text-[var(--pd-table-body-text-highlight)] overflow-hidden text-ellipsis group-hover:text-[var(--pd-link)]"
          title={object.path}>
          {object.path}
        </div>
      </div>
    </div>
  </div>
</button>
