import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GoFast Training',
  description: 'Your personalized training plan',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

