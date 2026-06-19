import { Loader2 } from 'lucide-react';

/** Lightweight route-transition loading state for the dashboard. */
export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-gray-400 dark:text-gray-600">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
}
