'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import NextTopLoader from 'nextjs-toploader';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                        // Never retry 4xx errors — they won't succeed on retry.
                        retry: (failureCount, error) => {
                            const msg = error instanceof Error ? error.message : '';
                            if (/\(4\d\d\)/.test(msg)) return false;
                            return failureCount < 1;
                        },
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <NextTopLoader
                color="#6366F1"
                height={3}
                showSpinner={false}
                shadow="0 0 10px #6366F1,0 0 5px #6366F1"
            />
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
                {children}
            </ThemeProvider>
            <ReactQueryDevtools initialIsOpen={false} position="bottom" />
        </QueryClientProvider>
    );
}
