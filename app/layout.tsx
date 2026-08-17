import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, DM_Serif_Display } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { PWARegistrar } from '@/components/pwa/PWARegistrar';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  variable: '--font-dm-serif',
  display: 'swap',
  weight: ['400'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'UDGOK CMS',
  description: 'Internal construction management CMS for UDGOK Construction',
  applicationName: 'UDGOK CMS',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UDGOK',
  },
  icons: {
    icon: '/icon-192.svg',
    apple: '/icon-192.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1e2a3a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${inter.variable} ${jetbrainsMono.variable} ${dmSerif.variable}`}
      >
        <body className="antialiased">
          <PWARegistrar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
