'use client';

import { useId } from 'react';
import { ShieldCheck } from 'lucide-react';

type TenderGuardStampProps = {
    size?: number;
    className?: string;
    label?: string;
};

export function TenderGuardStamp({ size = 128, className = '', label = 'VERIFIED' }: TenderGuardStampProps) {
    const uid = useId().replace(/:/g, '');
    const ringId = `${uid}-ring`;

    return (
        <div className={className} style={{ width: size, height: size }}>
            <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible" role="img" aria-label="Tender Guard Pro stamp">
                <defs>
                    <path
                        id={ringId}
                        d="M100 100 m-72 0 a72 72 0 1 1 144 0 a72 72 0 1 1 -144 0"
                    />
                </defs>

                <circle cx="100" cy="100" r="92" fill="rgba(8, 145, 178, 0.08)" />
                <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(8, 145, 178, 0.35)" strokeWidth="3" strokeDasharray="8 8" />
                <circle cx="100" cy="100" r="74" fill="rgba(15, 23, 42, 0.92)" stroke="rgba(79, 70, 229, 0.55)" strokeWidth="3" />
                <circle cx="100" cy="100" r="52" fill="rgba(79, 70, 229, 0.14)" stroke="rgba(125, 211, 252, 0.4)" strokeWidth="2" />

                <text fill="#E0E7FF" fontSize="13" fontWeight="700" letterSpacing="3.2" textAnchor="middle">
                    <textPath href={`#${ringId}`} startOffset="50%">
                        TENDER GUARD PRO
                    </textPath>
                </text>

                <g transform="translate(100 102)">
                    <circle r="27" fill="rgba(8, 145, 178, 0.18)" />
                    <ShieldCheck size={36} className="text-cyan-200" strokeWidth={2.2} />
                </g>

                <rect x="58" y="147" width="84" height="18" rx="9" fill="rgba(125, 211, 252, 0.14)" stroke="rgba(125, 211, 252, 0.45)" />
                <text x="100" y="160" fill="#F8FAFC" fontSize="11" fontWeight="800" letterSpacing="2.4" textAnchor="middle">
                    {label}
                </text>
            </svg>
        </div>
    );
}
