<script lang="ts">
  import {handleNavigation} from '/@/navigation';
  import {NavigationPage} from '/@api/navigation-page';
  import type {WorkflowInfo} from '/@api/workflow-info';

  interface Props {
    object: WorkflowInfo;
  }

  let { object }: Props = $props();

  function openDetails(workflow: WorkflowInfo): void {
    handleNavigation({
      page: NavigationPage.WORKFLOW_DETAILS,
      parameters: {
        internalId: workflow.internalProviderId,
        connectionName: workflow.connectionName,
        workflowId: btoa(workflow.path),
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
