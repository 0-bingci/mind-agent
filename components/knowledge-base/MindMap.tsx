"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
  Background,
  BackgroundVariant,
  Controls,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import Dagre from "@dagrejs/dagre"

/* ================================================================
   Types — LLM 输出的 JSON 结构
   ================================================================ */
export interface MindMapNodeData {
  id: string
  label: string
  type: "root" | "branch" | "leaf"
  icon?: string
  tags?: { text: string; color?: string }[]
  details?: string[]
}

export interface MindMapEdgeData {
  source: string
  target: string
  style?: "solid" | "dashed"
  color?: string
}

export interface MindMapData {
  nodes: MindMapNodeData[]
  edges: MindMapEdgeData[]
}

/* ================================================================
   Color Palette
   ================================================================ */
const BRANCH_COLORS = [
  { bg: "rgba(129,140,248,0.15)", border: "#818cf8", text: "#c7d2fe" },
  { bg: "rgba(251,146,60,0.15)", border: "#fb923c", text: "#fed7aa" },
  { bg: "rgba(52,211,153,0.15)", border: "#34d399", text: "#a7f3d0" },
  { bg: "rgba(251,113,133,0.15)", border: "#fb7185", text: "#fecdd3" },
  { bg: "rgba(56,189,248,0.15)", border: "#38bdf8", text: "#bae6fd" },
  { bg: "rgba(168,85,247,0.15)", border: "#a855f7", text: "#d8b4fe" },
  { bg: "rgba(250,204,21,0.15)", border: "#facc15", text: "#fef08a" },
]

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  pink: { bg: "rgba(251,113,133,0.25)", text: "#fda4af" },
  blue: { bg: "rgba(56,189,248,0.25)", text: "#7dd3fc" },
  green: { bg: "rgba(52,211,153,0.25)", text: "#6ee7b7" },
  orange: { bg: "rgba(251,146,60,0.25)", text: "#fdba74" },
  purple: { bg: "rgba(168,85,247,0.25)", text: "#c4b5fd" },
  yellow: { bg: "rgba(250,204,21,0.25)", text: "#fde047" },
  red: { bg: "rgba(239,68,68,0.25)", text: "#fca5a5" },
}

function getTagStyle(color?: string) {
  if (color && TAG_COLORS[color]) return TAG_COLORS[color]
  return { bg: "rgba(148,163,184,0.25)", text: "#cbd5e1" }
}

/* ================================================================
   Custom Nodes
   ================================================================ */

// 根节点 — 中心大圆
function RootNode({ data }: NodeProps) {
  const d = data as unknown as MindMapNodeData & { _colorIdx?: number }
  return (
    <div className="relative flex items-center justify-center">
      <Handle type="source" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      <div
        className="flex items-center gap-2 px-6 py-4 rounded-2xl font-bold text-lg select-none"
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
          color: "#fff",
          boxShadow: "0 4px 24px rgba(99,102,241,0.4)",
          minWidth: 120,
          justifyContent: "center",
        }}
      >
        {d.icon && <span className="text-xl">{d.icon}</span>}
        {d.label}
      </div>
    </div>
  )
}

// 分支节点 — 带颜色的圆角卡片
function BranchNode({ data }: NodeProps) {
  const d = data as unknown as MindMapNodeData & { _colorIdx?: number }
  const color = BRANCH_COLORS[(d._colorIdx ?? 0) % BRANCH_COLORS.length]
  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm select-none"
        style={{
          background: color.bg,
          border: `1.5px solid ${color.border}`,
          color: color.text,
          minWidth: 80,
        }}
      >
        {d.icon && <span className="text-base">{d.icon}</span>}
        {d.label}
      </div>
    </div>
  )
}

// 叶子节点 — 细节卡片，支持 tags 和 details
function LeafNode({ data }: NodeProps) {
  const d = data as unknown as MindMapNodeData & { _colorIdx?: number }
  const color = BRANCH_COLORS[(d._colorIdx ?? 0) % BRANCH_COLORS.length]
  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
      <div className="flex flex-col gap-1.5" style={{ minWidth: 60 }}>
        <div className="flex items-center gap-1.5">
          {d.icon && <span className="text-sm">{d.icon}</span>}
          <span className="text-sm select-none" style={{ color: color.text }}>
            {d.label}
          </span>
        </div>
        {/* Tags */}
        {d.tags && d.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {d.tags.map((tag, i) => {
              const ts = getTagStyle(tag.color)
              return (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded-md select-none"
                  style={{ background: ts.bg, color: ts.text }}
                >
                  {tag.text}
                </span>
              )
            })}
          </div>
        )}
        {/* Detail items */}
        {d.details && d.details.length > 0 && (
          <div className="flex flex-col gap-0.5 ml-1">
            {d.details.map((item, i) => (
              <span key={i} className="text-xs text-slate-400 select-none">
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const nodeTypes = {
  root: RootNode,
  branch: BranchNode,
  leaf: LeafNode,
}

/* ================================================================
   Auto Layout (Dagre)
   ================================================================ */
function layoutGraph(data: MindMapData): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: "LR",
    ranksep: 80,
    nodesep: 30,
    marginx: 40,
    marginy: 40,
  })

  // 计算每个 branch 的 colorIdx
  const branchIds = data.nodes.filter((n) => n.type === "branch").map((n) => n.id)
  const branchColorMap: Record<string, number> = {}
  branchIds.forEach((id, i) => (branchColorMap[id] = i))

  // 建立 parent→branch 映射（叶子继承父分支的颜色）
  const parentMap: Record<string, string> = {}
  for (const e of data.edges) {
    parentMap[e.target] = e.source
  }
  function getColorIdx(nodeId: string): number {
    if (branchColorMap[nodeId] !== undefined) return branchColorMap[nodeId]
    const parent = parentMap[nodeId]
    if (parent) return getColorIdx(parent)
    return 0
  }

  // 估算节点尺寸
  function estimateSize(n: MindMapNodeData): { w: number; h: number } {
    const charW = 14
    const labelW = n.label.length * charW
    if (n.type === "root") return { w: Math.max(labelW + 60, 160), h: 56 }
    if (n.type === "branch") return { w: Math.max(labelW + 48, 100), h: 40 }
    let h = 28
    if (n.tags?.length) h += 22
    if (n.details?.length) h += n.details.length * 18
    return { w: Math.max(labelW + 32, 80), h: Math.max(h, 28) }
  }

  for (const n of data.nodes) {
    const size = estimateSize(n)
    g.setNode(n.id, { width: size.w, height: size.h })
  }
  for (const e of data.edges) {
    g.setEdge(e.source, e.target)
  }

  Dagre.layout(g)

  const nodes: Node[] = data.nodes.map((n) => {
    const pos = g.node(n.id)
    return {
      id: n.id,
      type: n.type,
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
      data: { ...n, _colorIdx: getColorIdx(n.id) },
      draggable: true,
    }
  })

  const edges: Edge[] = data.edges.map((e, i) => {
    const sourceColorIdx = getColorIdx(e.source)
    const edgeColor = e.color || BRANCH_COLORS[sourceColorIdx % BRANCH_COLORS.length].border
    return {
      id: `e${i}`,
      source: e.source,
      target: e.target,
      type: "default",
      style: {
        stroke: edgeColor,
        strokeWidth: 2,
        strokeDasharray: e.style === "dashed" ? "6 3" : undefined,
      },
      animated: false,
    }
  })

  return { nodes, edges }
}

/* ================================================================
   MindMap Component
   ================================================================ */
export function MindMap({ chart }: { chart: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!chart) return
    try {
      // 兼容 LLM 返回的 markdown 代码块包裹的 JSON
      let raw = chart.trim()
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) raw = jsonMatch[1].trim()

      const data: MindMapData = JSON.parse(raw)
      if (!data.nodes?.length) {
        setError("思维导图数据为空")
        return
      }
      const layout = layoutGraph(data)
      setNodes(layout.nodes)
      setEdges(layout.edges)
      setError(null)
    } catch {
      setError("思维导图数据解析失败")
    }
  }, [chart])

  if (error) return <p className="text-sm text-red-400">{error}</p>

  return (
    <div
      className="mindmap-container rounded-xl overflow-hidden"
      style={{ height: 500, background: "linear-gradient(135deg, #0f172a 0%, #1a1033 50%, #0f172a 100%)" }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(148,163,184,0.08)" />
        <Controls
          showInteractive={false}
          className="!bg-slate-800/80 !border-slate-700 !rounded-lg !shadow-lg [&>button]:!bg-transparent [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700"
        />
      </ReactFlow>
    </div>
  )
}
