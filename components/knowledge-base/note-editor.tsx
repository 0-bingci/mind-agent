"use client"

import { useState, useEffect } from "react" // ✅ 引入 useState, useEffect
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Button } from "@/components/ui/button"
import { Save, X, Bold, Italic, List, ListOrdered, Undo, Redo } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
// 注意：确保你安装了 tiptap-markdown，如果没有，请先 npm install tiptap-markdown
import { Markdown } from "tiptap-markdown"

// ✅ 修改接口：定义保存时的数据结构
interface NoteData {
  title: string
  content: string
}

interface NoteEditorProps {
  initialMarkdown: string 
  initialTitle?: string // ✅ 新增：接收初始标题
  onSave: (data: NoteData) => void // ✅ 修改：回调现在接收对象而不是纯字符串
  onCancel: () => void
}

export function NoteEditor({ initialMarkdown, initialTitle = "未命名笔记", onSave, onCancel }: NoteEditorProps) {
  // ✅ 新增：标题状态
  const [title, setTitle] = useState(initialTitle)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Markdown.configure({
        html: true,
        transformCopiedText: true,
        transformPastedText: true,
      }),
    ],
    content: initialMarkdown,
    onCreate: ({ editor }) => {
      if (initialMarkdown && editor.storage.markdown) {
        editor.commands.setContent(initialMarkdown);
      }
    },
  })

  // ✅ 同步：如果外部传入的 initialTitle 变化，更新本地状态（可选）
  useEffect(() => {
    setTitle(initialTitle)
  }, [initialTitle])

  if (!editor) {
    return null
  }

  const handleSave = () => {
    const markdownContent = editor.storage.markdown 
      ? editor.storage.markdown.getMarkdown() 
      : editor.getHTML()
    
    // ✅ 返回包含标题和内容的对象
    onSave({
      title: title.trim() || "未命名笔记", // 防止空标题
      content: markdownContent
    })
  }

  const ToolbarBtn = ({ onClick, active, icon: Icon, title: tooltip }: any) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-8 w-8 p-0 ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}
      onClick={onClick}
      title={tooltip}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between border-b border-border px-6 py-2 bg-muted/20 sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-1">
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={Bold} title="加粗" />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={Italic} title="斜体" />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={List} title="无序列表" />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={ListOrdered} title="有序列表" />
          <div className="w-px h-4 bg-border mx-2" />
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} active={false} icon={Undo} title="撤销" />
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} active={false} icon={Redo} title="重做" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4 mr-2" /> 取消</Button>
          <Button size="sm" onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"><Save className="h-4 w-4 mr-2" /> 保存</Button>
        </div>
      </div>

      {/* 滚动区域 */}
      <ScrollArea className="flex-1 min-h-0 w-full"> 
        <div className="max-w-4xl mx-auto w-full min-h-full pb-20">
          
          {/* CSS 样式 (保持不变) */}
          <style jsx global>{`
            .ProseMirror:focus { outline: none !important; box-shadow: none !important; }
            .ProseMirror::selection { background: rgba(59, 130, 246, 0.3); }
            .ProseMirror h1 { font-size: 2.25rem; line-height: 2.5rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem; }
            .ProseMirror h2 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; }
            .ProseMirror p { margin-top: 0.5rem; margin-bottom: 0.5rem; line-height: 1.75; }
            .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; }
            .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; }
            .ProseMirror blockquote { border-left: 4px solid #e2e8f0; padding-left: 1rem; font-style: italic; color: #64748b; margin: 1rem 0; }
            .dark .ProseMirror blockquote { border-left-color: #475569; color: #94a3b8; }
            .ProseMirror code { background-color: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-size: 0.875em; color: #ef4444; }
            .dark .ProseMirror code { background-color: #334155; color: #fca5a5; }
            .ProseMirror pre { background-color: #1e293b; color: #f8fafc; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 1rem 0; }
            .ProseMirror pre code { background-color: transparent; padding: 0; color: inherit; font-size: 0.875rem; }
            
            /* ✅ 新增：标题输入框样式 */
            .note-title-input {
              width: 100%;
              border: none;
              background: transparent;
              font-size: 2.25rem;
              font-weight: 700;
              line-height: 2.5rem;
              padding: 2rem 2rem 1rem 2rem; /* 上右下左 */
              color: inherit;
            }
            .note-title-input:focus {
              outline: none;
            }
            .note-title-input::placeholder {
              color: #cbd5e1;
            }
            .dark .note-title-input::placeholder {
              color: #475569;
            }
          `}</style>

          {/* ✅ 标题输入区 */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="无标题笔记"
            className="note-title-input"
            autoFocus // 打开编辑器时光标默认不在这里，如果需要可以去掉
          />

          {/* 正文编辑区 */}
          <div className="px-8"> 
             <EditorContent editor={editor} className="min-h-[500px]" />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}