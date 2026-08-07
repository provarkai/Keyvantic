import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Outreach — research any company, write the email',
  description:
    'Enter a company name or website. Get a grounded research brief covering what they do, their pain points, opportunities and where AI could help — then a personalised cold outreach email you can edit and send.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#07080c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
