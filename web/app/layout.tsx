import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '@/lib/hooks/useAuth';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'MSDEV — Project Management for Teams',
  description: 'Developer-focused project management platform with Kanban, issue tracking, and GitHub integration.',
  keywords: 'project management, kanban, github integration, developer productivity, team collaboration',
  authors: [{ name: 'MSDEV Team' }],
  openGraph: {
    title: 'MSDEV',
    description: 'Project Management for Teams',
    type: 'website',
  },
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" media="(prefers-color-scheme: dark)"  content="#0a0f1e" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f0fdf9" />
      </head>
      <body>
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('theme');
                if (!theme) theme = 'system';
                
                if (theme === 'dark' || theme === 'light') {
                  document.documentElement.setAttribute('data-theme', theme);
                } else {
                  document.documentElement.removeAttribute('data-theme');
                }
              } catch (e) {}
            `,
          }}
        />
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--bg-elevated)',
                color: 'var(--text-1)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                fontSize: '13.5px',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
