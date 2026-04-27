'use client';

const ENTITIES = [
    'CIPC', 'SARS', 'NTBA', 'CSD', 'Treasury', 'B-BBEE Commission',
    'Gauteng Tenders', 'eThekwini', 'City of CT', 'Eskom', 'Transnet', 'Department of Health',
];

export function LogoMarquee() {
    return (
        <div className="relative overflow-hidden py-8 border-y border-white/[0.06]"
            style={{
                maskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
            }}
        >
            <div className="flex gap-12 animate-marquee min-w-max">
                {[...ENTITIES, ...ENTITIES].map((e, i) => (
                    <span
                        key={`${e}-${i}`}
                        className="font-mono-pro text-[11px] uppercase tracking-[0.2em] text-white/35 whitespace-nowrap"
                    >
                        {e}
                    </span>
                ))}
            </div>
        </div>
    );
}
