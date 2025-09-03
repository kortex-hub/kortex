<script lang="ts">
import type { V1Job } from '@kubernetes/client-node';
import { TableColumn, TableDurationColumn, TableRow } from '@podman-desktop/ui-svelte';
import moment from 'moment';

import ActionsColumn from '/@/lib/job/columns/Actions.svelte';
import CompletionsColumn from '/@/lib/job/columns/Completions.svelte';
import ConditionsColumn from '/@/lib/job/columns/Conditions.svelte';

import JobIcon from '../images/JobIcon.svelte';
import { JobUtils } from '../job/job-utils';
import JobEmptyScreen from '../job/JobEmptyScreen.svelte';
import type { JobUI } from '../job/JobUI';
import NameColumn from '../kube/column/Name.svelte';
import StatusColumn from '../kube/column/Status.svelte';
import FlowDetailsKubernetesKubeItemTable from './FlowDetailsKubernetesKubeItemTable.svelte';

interface Props {
  flowId: string;
}
let { flowId }: Props = $props();

const jobUtils = new JobUtils();

const statusColumn = new TableColumn<JobUI>('Status', {
  align: 'center',
  width: '70px',
  renderer: StatusColumn,
  comparator: (a, b): number => a.status.localeCompare(b.status),
});

const nameColumn = new TableColumn<JobUI>('Name', {
  width: '1.3fr',
  renderer: NameColumn,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

const ageColumn = new TableColumn<JobUI, Date | undefined>('Age', {
  renderMapping: (job): Date | undefined => job.created,
  renderer: TableDurationColumn,
  comparator: (a, b): number => moment(b.created).diff(moment(a.created)),
});

const conditionColumn = new TableColumn<JobUI>('Conditions', {
  renderer: ConditionsColumn,
  comparator: (a, b): number => a.condition.localeCompare(b.condition),
});

const completionColumn = new TableColumn<JobUI>('Completions', {
  renderer: CompletionsColumn,
  comparator: (a, b): number => a.succeeded.toString().localeCompare(b.succeeded.toString()),
});

const columns = [
  statusColumn,
  nameColumn,
  conditionColumn,
  completionColumn,
  ageColumn,
  new TableColumn<JobUI>('Actions', { align: 'right', renderer: ActionsColumn }),
];

const row = new TableRow<JobUI>({ selectable: (_job): boolean => false });

// keep only jobs having the right flow-id
function filterFlowidJob(job: V1Job): boolean {
  return job.metadata?.annotations?.['kortex-hub/flow-id'] === flowId;
}
</script>

<FlowDetailsKubernetesKubeItemTable
  kinds={[{
    resource: 'jobs',
    transformer: jobUtils.getJobUI,
    delete: window.kubernetesDeleteJob,
    isResource: (): boolean => true,
    filterResource: filterFlowidJob,
  }]}
  singular="Job"
  plural="Jobs"
  icon={JobIcon}
  columns={columns}
  row={row}
  >
  <!-- eslint-disable-next-line sonarjs/no-unused-vars -->
  {#snippet emptySnippet()}
    <JobEmptyScreen />
  {/snippet}
</FlowDetailsKubernetesKubeItemTable>
