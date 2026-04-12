import { cn } from '@/lib/utils';
import type { MeetingStatus } from '@/types';

const STATUS_CONFIG: Record<MeetingStatus, { label: string; className: string }> = {
  preparation: { label: 'Подготовка', className: 'bg-blue-100 text-blue-700' },
  conducted: { label: 'Проведена', className: 'bg-yellow-100 text-yellow-700' },
  processed: { label: 'Обработана', className: 'bg-orange-100 text-orange-700' },
  closed: { label: 'Закрыта', className: 'bg-gray-100 text-gray-500' },
};

interface StatusBadgeProps {
  status: MeetingStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
