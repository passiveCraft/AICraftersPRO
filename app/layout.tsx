import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Operator Core — Ecommerce AI Team',
  description: 'A cinematic operator cockpit for ecommerce AI systems powered by n8n.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
