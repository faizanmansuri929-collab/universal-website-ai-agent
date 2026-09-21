import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'XYZ College AI & OmniAgent Platform - Universal Website AI Assistant',
  description: 'Turn any website into an intelligent grounded AI chatbot with citations in seconds.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}

