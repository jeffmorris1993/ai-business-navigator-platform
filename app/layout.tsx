import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "@fontsource-variable/fraunces";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sirrom Intelligence — Business AI Navigator", template: "%s · Sirrom" },
  description: "Tell us about your business. We'll help you understand where AI can help, get your information ready, and put AI to work.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="bottom-right" toastOptions={{ classNames: { toast: "!rounded-lg !border !border-line !bg-surface !text-ink !shadow-pop !font-sans", description: "!text-ink-3", success: "[&_[data-icon]]:!text-teal", error: "[&_[data-icon]]:!text-red" } }} />
      </body>
    </html>
  );
}
