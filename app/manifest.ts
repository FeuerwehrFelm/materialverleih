import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Materialverleih Feuerwehr Felm',
    short_name: 'Materialverleih',
    description: 'Verleih von Material für Feuerwehr Felm',
    start_url: '/',
    display: 'standalone',
    background_color: '#081120',
    theme_color: '#081120',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
