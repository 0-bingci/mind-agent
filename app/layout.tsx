import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 配置 Geist Sans (无衬线字体)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"], // 如果主要面向中文用户，也可以考虑添加 'latin' 即可，Geist 对中文回退处理较好
});

// 配置 Geist Mono (等宽字体)
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mind Agent - 个人知识库",
  description: "基于 AI 的个人知识管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // ✅ 修改 1: lang 改为 zh-CN
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning >
      {/* ✅ 修改 2: 添加 font-sans 类，确保 Tailwind 使用上面定义的字体变量 */}
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}