import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      {/* 背景装饰 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-primary-foreground"
          >
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44l-1.44-8.65A2.5 2.5 0 0 1 7.9 7.5" />
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44l1.44-8.65A2.5 2.5 0 0 0 16.1 7.5" />
          </svg>
        </div>

        {/* 标题 */}
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Mind Agent
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          AI 驱动的个人知识库
        </p>

        {/* 分隔线 */}
        <div className="my-8 h-px w-24 bg-border" />

        {/* 特性列表 */}
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-5 shadow-sm"
            >
              <span className="text-2xl">{f.icon}</span>
              <span className="text-sm font-medium text-foreground">{f.title}</span>
              <span className="text-xs text-muted-foreground">{f.desc}</span>
            </div>
          ))}
        </div>

        {/* CTA 按钮 */}
        <Link
          href="/workspace"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:brightness-110 hover:shadow-lg hover:shadow-primary/30 active:scale-95"
        >
          进入工作区
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

const features = [
  {
    icon: "📝",
    title: "Markdown 笔记",
    desc: "富文本编辑，随时记录想法",
  },
  {
    icon: "🔍",
    title: "语义搜索",
    desc: "向量检索，精准找到相关内容",
  },
  {
    icon: "🤖",
    title: "AI 对话",
    desc: "Agent 联动笔记与网络知识",
  },
];
