import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Materialverleih Feuerwehr Felm',
  description: 'Materialverleih für die Feuerwehr Felm',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Materialverleih Felm',
  },
};

export const viewport: Viewport = {
  themeColor: '#081120',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        {children}
        <footer className="border-t border-[#dfff00]/15 bg-[#050c17] px-4 py-5 text-center text-sm text-slate-400">
          © Feuerwehr Felm – Justus Hamkens
        </footer>
      </body>
    </html>
  );
}
