'use client';

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { T } from '@/lib/motion';

const variants: Variants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: T.smooth },
    exit: { opacity: 0, y: -4, transition: T.snappy },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={pathname}
                variants={variants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="min-h-full"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
