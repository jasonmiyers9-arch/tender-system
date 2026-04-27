import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans-pro' });
const mono = JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-mono' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-serif' });

export const metadata: Metadata = {
  title: 'TenderGuard Pro — Compliance Made Simple',
  description:
    'Enterprise compliance vault and tender readiness platform for South African businesses.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.className} ${inter.variable} ${mono.variable} ${serif.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
