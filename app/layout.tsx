import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Materialverleih Feuerwehr Felm',
  description: 'Materialverleih für die Feuerwehr Felm',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#081120',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
