import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'GhostWash — AI-Powered Car Wash Member Retention',
  description: 'Predict churn. Save members. Recover payments. All on autopilot.',
  metadataBase: new URL('https://ghostwash.ai'),
  openGraph: {
    title: 'GhostWash',
    description: 'Your car wash runs itself now.',
    siteName: 'GhostWash',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GhostWash',
    description: 'Your car wash runs itself now.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
