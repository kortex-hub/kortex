<script lang="ts">
import type { V1Pod } from '@kubernetes/client-node';
import { TableColumn, TableDurationColumn, TableRow } from '@podman-desktop/ui-svelte';
import moment from 'moment';

import PodIcon from '../images/PodIcon.svelte';
import NameColumn from '../kube/column/Name.svelte';
import StatusColumn from '../kube/column/Status.svelte';
import { PodUtils } from '../kube/pods/pod-utils';
import PodColumnActions from '../kube/pods/PodColumnActions.svelte';
import PodColumnContainers from '../kube/pods/PodColumnContainers.svelte';
import PodEmptyScreen from '../kube/pods/PodEmptyScreen.svelte';
import type { PodUI } from '../kube/pods/PodUI';
import FlowDetailsKubernetesKubeItemTable from './FlowDetailsKubernetesKubeItemTable.svelte';

interface Props {
  flowId: string;
}
let { flowId }: Props = $props();

// keep only jobs having the right flow-id
function filterFlowidPod(job: V1Pod): boolean {
  return job.metadata?.annotations?.['kortex-hub/flow-id'] === flowId;
}

const podUtils = new PodUtils();

let statusColumn = new TableColumn<PodUI>('Status', {
  align: 'center',
  width: '70px',
  renderer: StatusColumn,
  comparator: (a, b): number => b.status.localeCompare(a.status),
});

let nameColumn = new TableColumn<PodUI>('Name', {
  width: '2fr',
  renderer: NameColumn,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

let containersColumn = new TableColumn<PodUI>('Containers', {
  renderer: PodColumnContainers,
  comparator: (a, b): number => a.containers.length - b.containers.length,
  initialOrder: 'descending',
  overflow: true,
});

let ageColumn = new TableColumn<PodUI, Date | undefined>('Age', {
  renderMapping: (pod): Date | undefined => pod.created,
  renderer: TableDurationColumn,
  comparator: (a, b): number => moment(b.created).diff(moment(a.created)),
});

const columns = [
  statusColumn,
  nameColumn,
  containersColumn,
  ageColumn,
  new TableColumn<PodUI>('Actions', { align: 'right', width: '150px', renderer: PodColumnActions, overflow: true }),
];

const row = new TableRow<PodUI>({ selectable: (_pod): boolean => true });
</script>

<FlowDetailsKubernetesKubeItemTable
  kinds={[{
    resource: 'pods',
    transformer: podUtils.getPodUI.bind(podUtils),
    delete: window.kubernetesDeletePod,
    isResource: (): boolean => true,
    filterResource: filterFlowidPod,
  }]}
  singular="pod"
  plural="pods"
  icon={PodIcon}
  columns={columns}
  row={row}
>
  <!-- eslint-disable-next-line sonarjs/no-unused-vars -->
  {#snippet emptySnippet()}
    <PodEmptyScreen />
  {/snippet}
</FlowDetailsKubernetesKubeItemTable>
