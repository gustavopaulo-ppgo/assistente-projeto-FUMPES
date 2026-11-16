import { STATUS_LABELS, STATUS_TONE } from '@/features/workflow/config'
import type { ProjectStatus } from '@/types/domain'
import { Badge } from './ui'

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
}
