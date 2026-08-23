// app/layout.js
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata = {
  title: 'CHEW Portal',
  description: 'Your private CHEW client dashboard.',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          {/* Display: Fraunces — the closest open-source stand-in for the
              Canela/Ogg-style "presidential" serif the design spec calls
              for. Canela and Ogg are commercial foundry fonts (Colophon /
              Schick Toikka) with no free-to-embed license; Fraunces is
              built on the same idea (warm, high-contrast, "soft" old-style
              display forms) and is the standard open substitute cited for
              exactly this look. If a Canela/Ogg license gets purchased
              later, this is the one line to change. */}
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
