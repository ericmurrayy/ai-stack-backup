// Murray's FSM - Root Page
// ==========================

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
}
