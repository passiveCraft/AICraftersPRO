import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Operator Core — Your AI Workspace',
  description: 'A spatial interface for your n8n workspace.',
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
