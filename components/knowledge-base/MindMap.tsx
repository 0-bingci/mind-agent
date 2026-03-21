import { useEffect, useRef, useState } from "react"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { Button } from "../ui/button"
import mermaid from "mermaid"



export function MindMap({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ref.current || !chart) return
    const id = `mermaid-${Date.now()}`
    mermaid.render(id, chart)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg
      })
      .catch(e => setError("图表生成失败，AI 输出格式有误"))
  }, [chart])

  if (error) return <p className="text-sm text-red-400">{error}</p>

  return (
    <div className="relative border border-border rounded-lg bg-muted/20 overflow-hidden" style={{ height: 400 }}>
      {/* 操作提示 */}
      <p className="absolute top-2 right-3 text-xs text-muted-foreground z-10 select-none">
        滚轮缩放 · 拖拽移动
      </p>

      <TransformWrapper
        initialScale={1}
        minScale={0.3}
        maxScale={3}
        centerOnInit
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* 控制按钮 */}
            <div className="absolute bottom-3 right-3 flex gap-1 z-10">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => zoomIn()}>+</Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => zoomOut()}>-</Button>
              <Button variant="outline" size="icon" className="h-7 w-7 text-xs" onClick={() => resetTransform()}>↺</Button>
            </div>

            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{ width: "100%", height: "100%" }}
            >
              <div ref={ref} className="w-full h-full flex items-center justify-center" />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}