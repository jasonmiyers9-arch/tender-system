import { Shield } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    /** Icon background color (hex). Falls back to indigo. */
    iconColor?: string;
}

/**
 * Consistent page header with gradient banner matching the home-page style.
 * Use on every top-level (app) page for visual consistency.
 */
export function PageHeader({ title, subtitle, icon, actions, iconColor = '#4F46E5' }: PageHeaderProps) {
    return (
        <div
            className="relative rounded-2xl overflow-hidden px-6 py-5 sm:px-8 sm:py-6"
            style={{
                background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E3A5C 100%)',
            }}
        >
            {/* Watermark */}
            <Shield
                size={120}
                className="absolute -right-4 -bottom-4 opacity-[0.06]"
                color="white"
            />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-4">
                    {icon && (
                        <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${iconColor}30`, color: 'white' }}
                        >
                            {icon}
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="mt-0.5 text-sm" style={{ color: '#C7D2FE' }}>
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
                {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
            </div>
        </div>
    );
}
