import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-[--color-text-primary]">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[--color-text-muted]">Tender Guard Pro · POPIA privacy notice</p>
      <div className="mt-8 space-y-6 text-sm leading-7 text-[--color-text-secondary]">
        <section><h2 className="text-lg font-semibold text-[--color-text-primary]">Information we process</h2><p>We process account, company, compliance-document, tender-application, notification, and security-audit information required to provide the service.</p></section>
        <section><h2 className="text-lg font-semibold text-[--color-text-primary]">Purpose</h2><p>Information is used for compliance tracking, supplier verification, tender readiness, security, notifications, and legally required records.</p></section>
        <section><h2 className="text-lg font-semibold text-[--color-text-primary]">Storage and access</h2><p>Production data is stored in Firebase services. Access is role-restricted and document downloads use time-limited signed URLs.</p></section>
        <section><h2 className="text-lg font-semibold text-[--color-text-primary]">Your rights</h2><p>You may export your information from Account settings and request account deletion. Deletion requests disable access immediately and enter a 30-day retention period before permanent deletion, subject to legal retention duties.</p></section>
      </div>
      <Link href="/register" className="mt-10 inline-block font-semibold text-[--color-primary]">Return to registration</Link>
    </main>
  );
}
