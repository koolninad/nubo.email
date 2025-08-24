'use client';

// import type { Metadata } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/ui/toast";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Move metadata to a separate file for client components
// export const metadata: Metadata = {
//   title: "Nubo.email - All your inboxes, one place",
//   description: "Open-source, ultra-modern webmail client",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hydrate = useStore((state) => state.hydrate);
  
  useEffect(() => {
    // Set page title
    document.title = "Nubo.email - All your inboxes, one place";
    
    // Set dark mode as default
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme !== 'light') {
      // Default to dark mode unless explicitly set to light
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Initialize auth state from stored tokens
    hydrate();
  }, [hydrate]);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
