import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Navigation } from '@/components/shared/Navigation';
import type { UserProfile } from '@/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, name, role, created_at')
    .eq('id', user.id)
    .single();

  const userProfile: UserProfile = profile ?? {
    id: user.id,
    name: user.email ?? 'Пользователь',
    role: user.user_metadata?.role ?? 'assistant',
    created_at: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation user={userProfile} />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
