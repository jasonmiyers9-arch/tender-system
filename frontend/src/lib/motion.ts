import type { Variants, Transition } from 'motion/react';

export const T = {
    spring: { type: 'spring', stiffness: 380, damping: 30 } satisfies Transition,
    softSpring: { type: 'spring', stiffness: 240, damping: 26 } satisfies Transition,
    bouncySpring: { type: 'spring', stiffness: 500, damping: 24 } satisfies Transition,
    smooth: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } satisfies Transition,
    snappy: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } satisfies Transition,
    slow: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } satisfies Transition,
};

export const fadeUp: Variants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: T.smooth },
    exit: { opacity: 0, y: -8, transition: T.snappy },
};

export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: T.smooth },
    exit: { opacity: 0, transition: T.snappy },
};

export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.94 },
    show: { opacity: 1, scale: 1, transition: T.softSpring },
    exit: { opacity: 0, scale: 0.96, transition: T.snappy },
};

export const slideRight: Variants = {
    hidden: { opacity: 0, x: -16 },
    show: { opacity: 1, x: 0, transition: T.smooth },
    exit: { opacity: 0, x: -8, transition: T.snappy },
};

export const slideUpPanel: Variants = {
    hidden: { opacity: 0, y: 24, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: T.softSpring },
    exit: { opacity: 0, y: 12, scale: 0.98, transition: T.snappy },
};

export const stagger = (gap = 0.06, delayChildren = 0): Variants => ({
    hidden: {},
    show: {
        transition: { staggerChildren: gap, delayChildren },
    },
});

export const overlay: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.18 } },
    exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const dropdown: Variants = {
    hidden: { opacity: 0, y: -6, scale: 0.96 },
    show: { opacity: 1, y: 0, scale: 1, transition: T.snappy },
    exit: { opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } },
};

export const popToast: Variants = {
    hidden: { opacity: 0, y: 24, scale: 0.96 },
    show: { opacity: 1, y: 0, scale: 1, transition: T.softSpring },
    exit: { opacity: 0, y: 16, scale: 0.96, transition: T.snappy },
};

export const pressTap = { scale: 0.97 } as const;
export const liftHover = { y: -2, transition: T.snappy } as const;
