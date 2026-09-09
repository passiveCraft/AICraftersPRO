import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Workflow Console — n8n Operations',
  description: 'Connect, run, and monitor workflows already built in your n8n account.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
