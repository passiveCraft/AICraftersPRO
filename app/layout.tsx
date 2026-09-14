import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Crafters Pro — Operations Command',
  description: 'Monitor and operate autonomous commerce Systems through live n8n workflows.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
