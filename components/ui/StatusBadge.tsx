import { Badge } from './Badge';

export type StatusVariant =
  | 'active'
  | 'inactive'
  | 'archived'
  | 'lead'
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'acknowledged'
  | 'paid'
  | 'disputed'
  | 'won'
  | 'lost'
  | 'blocked'
  | 'todo'
  | 'in_progress'
  | 'done'
  | 'cancelled'
  | 'overdue';

const labelByStatus: Record<StatusVariant, string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
  lead: 'Lead',
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  acknowledged: 'Acknowledged',
  paid: 'Paid',
  disputed: 'Disputed',
  won: 'Won',
  lost: 'Lost',
  blocked: 'Blocked',
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
  overdue: 'Overdue',
};

const variantByStatus: Record<StatusVariant, 'success' | 'warn' | 'error' | 'copper' | 'neutral' | 'navy'> = {
  active: 'success',
  inactive: 'neutral',
  archived: 'neutral',
  lead: 'copper',
  draft: 'neutral',
  sent: 'copper',
  viewed: 'copper',
  acknowledged: 'copper',
  paid: 'success',
  disputed: 'error',
  won: 'success',
  lost: 'neutral',
  blocked: 'error',
  todo: 'neutral',
  in_progress: 'copper',
  done: 'success',
  cancelled: 'neutral',
  overdue: 'error',
};

export function StatusBadge({
  status,
  prefix,
}: {
  status: StatusVariant;
  /** Optional prefix dot, e.g. "● ACTIVE" — matches the UDGOK pay app status style. */
  prefix?: string;
}) {
  return (
    <Badge variant={variantByStatus[status]}>
      {prefix ? `${prefix} ` : ''}
      {labelByStatus[status]}
    </Badge>
  );
}
