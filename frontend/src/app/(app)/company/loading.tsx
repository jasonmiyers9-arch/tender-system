import { CardSkeleton } from '@/components/ui/Skeleton';

export default function CompanyLoading() {
    return (
        <div className="space-y-6">
            <CardSkeleton />
            <CardSkeleton />
        </div>
    );
}
