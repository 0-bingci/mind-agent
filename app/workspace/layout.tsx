// app/workspace/layout.tsx
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from 'next-themes'

// 注意：这里不需要 import 字体，也不需要定义 html/body
export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="h-screen w-full overflow-hidden bg-background text-foreground">
        {children}
      </div>
      <Analytics />
      </ThemeProvider>
    </>
  )
}