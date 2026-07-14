import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Materialverleih Feuerwehr Felm',
    short_name: 'Materialverleih',
    description: 'Verleih von Material für Feuerwehr Felm',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#081120',
    theme_color: '#081120',
    orientation: 'portrait',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
