import { redirect } from 'next/navigation';

// Root page → redirect to /dashboard (AppShell handles auth guard)
export default function RootPage() {
  redirect('/dashboard');
}
