// Suppress TS7016 for lucide-react when moduleResolution:"bundler" picks the
// CJS bundle without an adjacent .d.ts file.  Named icon imports remain typed
// as React functional components via the wildcard re-export below.
declare module 'lucide-react' {
    import type { FC, SVGProps } from 'react';
    type LucideProps = SVGProps<SVGSVGElement> & {
        size?: number | string;
        absoluteStrokeWidth?: boolean;
    };
    type LucideIcon = FC<LucideProps>;
    // Every named export (AlertTriangle, Bell, etc.) is a LucideIcon component
    export const Activity: LucideIcon;
    export const AlertTriangle: LucideIcon;
    export const ArrowRight: LucideIcon;
    export const BarChart2: LucideIcon;
    export const Bell: LucideIcon;
    export const Building2: LucideIcon;
    export const Calendar: LucideIcon;
    export const Check: LucideIcon;
    export const CheckCheck: LucideIcon;
    export const CheckCircle2: LucideIcon;
    export const ChevronDown: LucideIcon;
    export const ChevronLeft: LucideIcon;
    export const ChevronRight: LucideIcon;
    export const ClipboardList: LucideIcon;
    export const Clock: LucideIcon;
    export const Download: LucideIcon;
    export const ExternalLink: LucideIcon;
    export const Eye: LucideIcon;
    export const FileSearch: LucideIcon;
    export const FileX2: LucideIcon;
    export const FolderLock: LucideIcon;
    export const Info: LucideIcon;
    export const LayoutDashboard: LucideIcon;
    export const LogOut: LucideIcon;
    export const Menu: LucideIcon;
    export const MoreHorizontal: LucideIcon;
    export const Moon: LucideIcon;
    export const Plus: LucideIcon;
    export const RefreshCw: LucideIcon;
    export const Save: LucideIcon;
    export const Search: LucideIcon;
    export const Settings: LucideIcon;
    export const Shield: LucideIcon;
    export const ShieldCheck: LucideIcon;
    export const Sun: LucideIcon;
    export const TrendingUp: LucideIcon;
    export const Upload: LucideIcon;
    export const User: LucideIcon;
    export const UserCheck: LucideIcon;
    export const Users: LucideIcon;
    export const X: LucideIcon;
    export const XCircle: LucideIcon;
}
