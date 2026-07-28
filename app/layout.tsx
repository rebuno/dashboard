import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Rebuno",
  description: "Rebuno dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden bg-gray-50 text-gray-900">
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
