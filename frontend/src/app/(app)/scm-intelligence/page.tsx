import {
    COMPETITOR_CAPABILITIES,
    DOCUMENT_LIFECYCLE,
    SBD_FORMS,
    SCM_SECTORS,
    SCM_UNIQUE_SELLING_POINTS,
} from '@/lib/scmIntelligence';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { BarChart3, FileCheck2, GitBranch, Landmark, ListChecks, Scale, ShieldCheck } from 'lucide-react';

const stats = [
    { label: 'SCM sectors', value: '28' },
    { label: 'Core documents', value: '6' },
    { label: 'SBD forms tracked', value: '7' },
    { label: 'Lifecycle stages', value: '7' },
];

function CapabilityValue({ value, winner = false }: { value: string; winner?: boolean }) {
    return (
        <span className={winner ? 'font-semibold text-emerald-700' : 'text-[--color-text-muted]'}>
            {winner ? 'Yes - ' : ''}
            {value}
        </span>
    );
}
export default function ScmIntelligencePage() {
    return (
        <div className="mx-auto max-w-7xl space-y-8">
            <PageHeader
                title="SCM Intelligence"
                subtitle="Sector checklists, tender qualification gaps, SBD forms, and the positioning layer behind TenderGuard Pro."
                icon={<Scale size={22} />}
                iconColor="#0F766E"
            />

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((item) => (
                    <div key={item.label} className="rounded-xl border border-[--color-border] bg-[--color-surface] px-4 py-3">
                        <p className="text-2xl font-bold text-[--color-text-primary]">{item.value}</p>
                        <p className="text-xs font-medium text-[--color-text-muted]">{item.label}</p>
                    </div>
                ))}
            </section>

            <Card
                header={
                    <div className="flex items-center gap-2">
                        <BarChart3 size={18} className="text-teal-700" />
                        <h2 className="text-sm font-semibold text-[--color-text-primary]">Competitor Gap</h2>
                    </div>
                }
                padding="none"
            >
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-[--color-surface-raised] text-left text-xs uppercase tracking-wide text-[--color-text-muted]">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Capability</th>
                                <th className="px-4 py-3 font-semibold">TenderGuard Pro</th>
                                <th className="px-4 py-3 font-semibold">TenderFlow</th>
                                <th className="px-4 py-3 font-semibold">Ariscu / Generic</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[--color-border]">
                            {COMPETITOR_CAPABILITIES.map((row) => (
                                <tr key={row.capability}>
                                    <td className="px-4 py-3 font-medium text-[--color-text-primary]">{row.capability}</td>
                                    <td className="px-4 py-3"><CapabilityValue value={row.tenderGuard} winner /></td>
                                    <td className="px-4 py-3 text-[--color-text-muted]">{row.tenderFlow}</td>
                                    <td className="px-4 py-3 text-[--color-text-muted]">{row.ariscu}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <section className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2" header={<h2 className="text-sm font-semibold text-[--color-text-primary]">The Core Gap</h2>}>
                    <p className="text-sm leading-relaxed text-[--color-text-secondary]">
                        TenderFlow helps teams manage tenders they have already decided to pursue. TenderGuard Pro answers the
                        question that comes before that: are we qualified to bid for this tender right now? That answer is produced
                        before bid preparation time is spent.
                    </p>
                </Card>
                <Card header={<h2 className="text-sm font-semibold text-[--color-text-primary]">Positioning Line</h2>}>
                    <p className="text-sm font-semibold leading-relaxed text-teal-800">
                        TenderGuard Pro is the only compliance intelligence platform built for South Africa&apos;s SCM framework.
                        It does not manage tenders. It tells you whether you are ready to win them.
                    </p>
                </Card>
            </section>

            <section>
                <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-teal-700" />
                    <h2 className="text-base font-semibold text-[--color-text-primary]">Six SCM Unique Selling Points</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {SCM_UNIQUE_SELLING_POINTS.map((point, index) => (
                        <Card key={point.title} padding="sm">
                            <div className="flex items-start gap-3">
                                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-700">
                                    {index + 1}
                                </span>
                                <div>
                                    <h3 className="text-sm font-semibold text-[--color-text-primary]">{point.title}</h3>
                                    <p className="mt-1 text-xs leading-relaxed text-[--color-text-muted]">{point.summary}</p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <Card
                    header={
                        <div className="flex items-center gap-2">
                            <FileCheck2 size={18} className="text-teal-700" />
                            <h2 className="text-sm font-semibold text-[--color-text-primary]">Standard Bidding Documents</h2>
                        </div>
                    }
                >
                    <div className="space-y-3">
                        {SBD_FORMS.map((form) => (
                            <div key={form.form} className="rounded-lg border border-[--color-border] bg-[--color-bg] p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="accent" size="sm">{form.form}</Badge>
                                    <h3 className="text-sm font-semibold text-[--color-text-primary]">{form.title}</h3>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-[--color-text-muted]">{form.value}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card
                    header={
                        <div className="flex items-center gap-2">
                            <GitBranch size={18} className="text-teal-700" />
                            <h2 className="text-sm font-semibold text-[--color-text-primary]">Document Lifecycle</h2>
                        </div>
                    }
                >
                    <ol className="space-y-3">
                        {DOCUMENT_LIFECYCLE.map((stage, index) => (
                            <li key={stage.stage} className="flex gap-3">
                                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                                    {index + 1}
                                </span>
                                <div>
                                    <h3 className="text-sm font-semibold text-[--color-text-primary]">{stage.stage}</h3>
                                    <p className="text-xs text-[--color-text-muted]">{stage.description}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </Card>
            </section>

            <section>
                <div className="mb-3 flex items-center gap-2">
                    <ListChecks size={18} className="text-teal-700" />
                    <h2 className="text-base font-semibold text-[--color-text-primary]">28 Sector Document Checklists</h2>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                    {SCM_SECTORS.map((sector) => (
                        <Card key={sector.code} padding="sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="default" size="sm">{sector.code}</Badge>
                                        <h3 className="text-sm font-semibold text-[--color-text-primary]">{sector.name}</h3>
                                    </div>
                                    <p className="mt-1 text-xs text-[--color-text-muted]">
                                        Expected scoring groups: {sector.expectedDocumentGroups.join(', ')}
                                    </p>
                                </div>
                                <Landmark size={16} className="text-teal-700" />
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">Core and standard</p>
                                    <ul className="mt-2 space-y-1.5">
                                        {sector.standardDocuments.slice(0, 8).map((doc) => (
                                            <li key={doc} className="text-xs leading-relaxed text-[--color-text-secondary]">{doc}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">Sector-specific</p>
                                    <ul className="mt-2 space-y-1.5">
                                        {sector.sectorDocuments.map((doc) => (
                                            <li key={doc} className="text-xs leading-relaxed text-[--color-text-secondary]">{doc}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    );
}
