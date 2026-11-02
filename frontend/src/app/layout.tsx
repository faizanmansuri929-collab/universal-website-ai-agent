import './globals.css';

export const metadata = {
  title: 'Yui AI Console — Turn Any Website Into an Intelligent AI Assistant',
  description: 'Build AI-powered conversations, automate customer support, capture qualified leads, and deliver instant answers — all grounded in your own website.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){ try { var t = localStorage.getItem('yui_theme') || localStorage.getItem('omniagent_theme');
            if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches))
              document.documentElement.classList.add('dark'); } catch(e){} })();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] selection:bg-[#E11D48]/15 antialiased">
        <main className="min-h-screen w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
