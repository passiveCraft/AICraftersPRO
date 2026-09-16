import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Crafters Pro — Operations Command',
  description: 'Monitor and operate autonomous commerce Systems through live n8n workflows.',
  icons: {
    icon: [
      { url: '/ai-crafters-pro-icon.svg', type: 'image/svg+xml' },
      { url: '/ai-crafters-pro-logo.png', type: 'image/png' },
    ],
    shortcut: '/ai-crafters-pro-icon.svg',
    apple: '/ai-crafters-pro-icon.svg',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
