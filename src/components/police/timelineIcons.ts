import type { LucideIcon } from 'lucide-react';
import {
  UserCheck,
  UserPlus,
  MessageSquare,
  Upload,
  Gavel,
  CheckCircle,
  XCircle,
  Ban,
  Lock,
  RotateCcw,
  ShieldCheck,
  Crown,
  Activity,
  ArrowRightLeft,
  Trash2,
  Send,
} from 'lucide-react';

type IconStyle = { Icon: LucideIcon; bg: string; text: string; label: string };

const DEFAULT: IconStyle = { Icon: Activity, bg: 'bg-slate-100', text: 'text-slate-600', label: 'Action' };

const MAP: Record<string, IconStyle> = {
  assigned: { Icon: UserCheck, bg: 'bg-blue-100', text: 'text-blue-600', label: 'Assigned' },
  self_assigned: { Icon: UserCheck, bg: 'bg-blue-100', text: 'text-blue-600', label: 'Self-assigned' },
  reassigned: { Icon: ArrowRightLeft, bg: 'bg-amber-100', text: 'text-amber-700', label: 'Reassigned' },
  claimed_by_manager: { Icon: Crown, bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Manager claim' },
  note_added: { Icon: MessageSquare, bg: 'bg-slate-100', text: 'text-slate-700', label: 'Note added' },
  evidence_added: { Icon: Upload, bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Evidence added' },
  summons_issued: { Icon: Gavel, bg: 'bg-red-100', text: 'text-red-700', label: 'Summons issued' },
  summons_attended: { Icon: CheckCircle, bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Summons attended' },
  summons_no_show: { Icon: XCircle, bg: 'bg-red-100', text: 'text-red-700', label: 'Summons no-show' },
  summons_cancelled: { Icon: Ban, bg: 'bg-slate-100', text: 'text-slate-600', label: 'Summons cancelled' },
  person_of_interest_added: { Icon: UserPlus, bg: 'bg-blue-100', text: 'text-blue-700', label: 'Person added' },
  person_of_interest_removed: { Icon: Trash2, bg: 'bg-slate-100', text: 'text-slate-600', label: 'Person removed' },
  closed: { Icon: Lock, bg: 'bg-slate-200', text: 'text-slate-700', label: 'Closed' },
  reopened: { Icon: RotateCcw, bg: 'bg-orange-100', text: 'text-orange-700', label: 'Reopened' },
  resolved: { Icon: ShieldCheck, bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Resolved' },
  status_changed: { Icon: Activity, bg: 'bg-slate-100', text: 'text-slate-600', label: 'Status changed' },
  message_sent: { Icon: Send, bg: 'bg-teal-100', text: 'text-teal-700', label: 'Message sent' },
};

export function getTimelineIcon(actionType: string): IconStyle {
  return MAP[actionType] || DEFAULT;
}
