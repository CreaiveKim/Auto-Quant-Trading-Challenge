// src/app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "2K Quant",
  description: "Quant Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
