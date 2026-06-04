'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MindMapNode, MindMapData, NodeDirection } from '@/types/mindmap'

const NODE_COLORS = [
  '#4F46E5', '#7C3AED', '#DB2777', '#DC2626',
  '#D97706', '#16A34A', '#0891B2', '#2563EB',
]
const NODE_W = 160
const NODE_H = 44
const BRANCH_DIST = 220
const BRANCH_VERT = 110

interface MindMapCanvasProps {
  data: MindMapData
  onChange?: (data: MindMapData) => void
  readOnly?: boolean
}

interface DragState {
  nodeId: string
  startX: number
  startY: number
  originX: number
  originY: number
}

// Returns the anchor point on a node edge based on the direction the child is in
function getAnchor(node: MindMapNode, side: 'from' | 'to', dir: NodeDirection): [number, number] {
  const cx = node.x
  const cy = node.y
  if (side === 'from') {
    if (dir === 'right') return [cx + NODE_W / 2, cy]
    if (dir === 'left') return [cx - NODE_W / 2, cy]
    if (dir === 'up') return [cx, cy - NODE_H / 2]
    return [cx, cy + NODE_H / 2]  // down
  } else {
    if (dir === 'right') return [cx - NODE_W / 2, cy]
    if (dir === 'left') return [cx + NODE_W / 2, cy]
    if (dir === 'up') return [cx, cy + NODE_H / 2]
    return [cx, cy - NODE_H / 2]  // down
  }
}

function nextPosition(parent: MindMapNode, dir: NodeDirection, siblings: MindMapNode[]): { x: number; y: number } {
  const count = siblings.length
  const spread = count * 70 - (count * 35)
  if (dir === 'right') return { x: parent.x + BRANCH_DIST, y: parent.y + spread }
  if (dir === 'left') return { x: parent.x - BRANCH_DIST, y: parent.y + spread }
  if (dir === 'up') return { x: parent.x + spread, y: parent.y - BRANCH_VERT }
  return { x: parent.x + spread, y: parent.y + BRANCH_VERT }
}

export function MindMapCanvas({ data, onChange, readOnly }: MindMapCanvasProps) {
  const [nodes, setNodes] = useState<MindMapNode[]>(data.nodes)
  const [rootId] = useState(data.rootId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [addDirNode, setAddDirNode] = useState<string | null>(null)
  const [offset, setOffset] = useState({ x: 400, y: 300 })
  const [scale, setScale] = useState(1)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null)
  const [panOrigin, setPanOrigin] = useState({ x: 400, y: 300 })
  const svgRef = useRef<SVGSVGElement>(null)
  const editRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setNodes(data.nodes) }, [data])

  const notifyChange = useCallback((updated: MindMapNode[]) => {
    onChange?.({ nodes: updated, rootId })
  }, [onChange, rootId])

  const addNode = useCallback((parentId: string, dir: NodeDirection) => {
    if (readOnly) return
    const parent = nodes.find((n) => n.id === parentId)
    if (!parent) return
    const siblings = nodes.filter((n) => n.parentId === parentId && n.direction === dir)
    const pos = nextPosition(parent, dir, siblings)
    const newId = 'node-' + Date.now()
    const newNode: MindMapNode = {
      id: newId,
      text: '新しいトピック',
      ...pos,
      color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
      parentId,
      direction: dir,
    }
    const updated = [...nodes, newNode]
    setNodes(updated)
    notifyChange(updated)
    setAddDirNode(null)
    setEditingId(newId)
    setEditText('新しいトピック')
    setSelectedId(newId)
  }, [nodes, readOnly, notifyChange])

  const deleteNode = useCallback((nodeId: string) => {
    if (readOnly || nodeId === rootId) return
    const collect = (id: string): string[] => {
      const kids = nodes.filter((n) => n.parentId === id).map((n) => n.id)
      return [id, ...kids.flatMap(collect)]
    }
    const toDelete = new Set(collect(nodeId))
    const updated = nodes.filter((n) => !toDelete.has(n.id))
    setNodes(updated)
    notifyChange(updated)
    setSelectedId(null)
    setAddDirNode(null)
  }, [nodes, readOnly, rootId, notifyChange])

  const commitEdit = useCallback(() => {
    if (!editingId) return
    const updated = nodes.map((n) =>
      n.id === editingId ? { ...n, text: editText.trim() || n.text } : n
    )
    setNodes(updated)
    notifyChange(updated)
    setEditingId(null)
  }, [editingId, editText, nodes, notifyChange])

  const commitUrl = useCallback(() => {
    if (!editingUrlId) return
    const url = editUrl.trim()
    const normalized = url && !url.startsWith('http') ? 'https://' + url : url
    const updated = nodes.map((n) =>
      n.id === editingUrlId ? { ...n, url: normalized || undefined } : n
    )
    setNodes(updated)
    notifyChange(updated)
    setEditingUrlId(null)
  }, [editingUrlId, editUrl, nodes, notifyChange])

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (editingId || editingUrlId) return
    e.stopPropagation()
    setSelectedId(nodeId)
    setAddDirNode(null)
    const node = nodes.find((n) => n.id === nodeId)!
    setDrag({ nodeId, startX: e.clientX, startY: e.clientY, originX: node.x, originY: node.y })
  }

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (editingId) commitEdit()
    if (editingUrlId) commitUrl()
    if ((e.target as Element).closest('.node-element')) return
    setSelectedId(null)
    setAddDirNode(null)
    setPanStart({ x: e.clientX, y: e.clientY })
    setPanOrigin({ ...offset })
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (drag) {
      const dx = (e.clientX - drag.startX) / scale
      const dy = (e.clientY - drag.startY) / scale
      setNodes((prev) => prev.map((n) =>
        n.id === drag.nodeId ? { ...n, x: drag.originX + dx, y: drag.originY + dy } : n
      ))
    } else if (panStart) {
      setOffset({ x: panOrigin.x + (e.clientX - panStart.x), y: panOrigin.y + (e.clientY - panStart.y) })
    }
  }, [drag, panStart, panOrigin, scale])

  const handleMouseUp = useCallback(() => {
    if (drag) notifyChange(nodes)
    setDrag(null)
    setPanStart(null)
  }, [drag, nodes, notifyChange])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setScale((s) => Math.min(Math.max(s * (e.deltaY > 0 ? 0.9 : 1.1), 0.3), 3))
  }

  const renderEdge = (child: MindMapNode) => {
    const parent = nodes.find((p) => p.id === child.parentId)
    if (!parent) return null
    const dir = child.direction ?? 'right'
    const [x1, y1] = getAnchor(parent, 'from', dir)
    const [x2, y2] = getAnchor(child, 'to', dir)
    let d: string
    if (dir === 'right' || dir === 'left') {
      const mx = (x1 + x2) / 2
      d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
    } else {
      const my = (y1 + y2) / 2
      d = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
    }
    return (
      <path
        key={`edge-${parent.id}-${child.id}`}
        d={d}
        fill="none"
        stroke={child.color || '#4F46E5'}
        strokeWidth="2"
        strokeOpacity="0.5"
      />
    )
  }

  const renderDirPicker = (node: MindMapNode) => {
    const w = NODE_W
    const h = NODE_H
    const dirs: { dir: NodeDirection; label: string; tx: number; ty: number }[] = [
      { dir: 'right', label: '→', tx: w + 34, ty: h / 2 - 12 },
      { dir: 'left',  label: '←', tx: -58,    ty: h / 2 - 12 },
      { dir: 'up',    label: '↑', tx: w / 2 - 12, ty: -34 },
      { dir: 'down',  label: '↓', tx: w / 2 - 12, ty: h + 10 },
    ]
    return dirs.map(({ dir, label, tx, ty }) => (
      <g
        key={dir}
        transform={`translate(${tx}, ${ty})`}
        onClick={(e) => { e.stopPropagation(); addNode(node.id, dir) }}
        style={{ cursor: 'pointer' }}
      >
        <rect width={24} height={24} rx={6} fill="#16A34A" />
        <text x={12} y={12} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={13} fontWeight="bold">{label}</text>
      </g>
    ))
  }

  const renderNode = (node: MindMapNode) => {
    const isSelected = selectedId === node.id
    const isEditing = editingId === node.id
    const isEditingUrl = editingUrlId === node.id
    const isShowingDirs = addDirNode === node.id
    const isRoot = node.id === rootId
    const w = NODE_W
    const h = NODE_H
    const hasUrl = !!node.url

    return (
      <g
        key={node.id}
        className="node-element"
        transform={`translate(${node.x - w / 2}, ${node.y - h / 2})`}
        onMouseDown={(e) => handleMouseDown(e, node.id)}
        onDoubleClick={() => {
          if (readOnly) return
          setEditingId(node.id)
          setEditText(node.text)
          setTimeout(() => editRef.current?.select(), 0)
        }}
        style={{ cursor: drag?.nodeId === node.id ? 'grabbing' : (readOnly ? 'default' : 'grab') }}
      >
        <rect
          width={w}
          height={h}
          rx={isRoot ? 22 : 12}
          fill={node.color || '#4F46E5'}
          opacity={isSelected ? 1 : 0.9}
          stroke={isSelected ? '#fff' : 'transparent'}
          strokeWidth={isSelected ? 2.5 : 0}
          filter={isSelected ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.35))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))'}
        />

        {/* URL indicator dot */}
        {hasUrl && (
          <circle
            cx={w - 8}
            cy={8}
            r={5}
            fill="#FCD34D"
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              if (node.url) window.open(node.url, '_blank', 'noopener,noreferrer')
            }}
          />
        )}

        {isEditing ? (
          <foreignObject x={4} y={4} width={w - 8} height={h - 8}>
            <input
              ref={editRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') setEditingId(null)
              }}
              className="w-full h-full bg-white/20 text-white text-sm text-center outline-none rounded px-1"
              autoFocus
            />
          </foreignObject>
        ) : (
          <text
            x={w / 2 - (hasUrl ? 4 : 0)}
            y={h / 2 + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={isRoot ? 14 : 13}
            fontWeight={isRoot ? '700' : '500'}
            fontFamily="system-ui, sans-serif"
          >
            {node.text.length > 17 ? node.text.slice(0, 16) + '…' : node.text}
          </text>
        )}

        {/* URL edit field */}
        {isEditingUrl && (
          <foreignObject x={-60} y={h + 6} width={w + 120} height={34}>
            <div className="flex gap-1 bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1">
              <input
                ref={urlRef}
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitUrl()
                  if (e.key === 'Escape') setEditingUrlId(null)
                }}
                placeholder="https://..."
                className="flex-1 text-xs text-gray-800 outline-none"
                autoFocus
              />
              <button onClick={(e) => { e.stopPropagation(); commitUrl() }} className="text-xs text-indigo-600 font-medium">✓</button>
              <button onClick={(e) => { e.stopPropagation(); setEditingUrlId(null) }} className="text-xs text-gray-400">✕</button>
            </div>
          </foreignObject>
        )}

        {/* Action buttons when selected */}
        {isSelected && !readOnly && !isEditing && !isEditingUrl && (
          <>
            {/* Edit text */}
            <g
              transform={`translate(-28, ${h / 2 - 12})`}
              onClick={(e) => {
                e.stopPropagation()
                setEditingId(node.id)
                setEditText(node.text)
                setTimeout(() => editRef.current?.select(), 0)
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={12} cy={12} r={12} fill="#2563EB" />
              <text x={12} y={12} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={11}>✏</text>
            </g>

            {/* Add URL link */}
            <g
              transform={`translate(-28, ${h / 2 + 14})`}
              onClick={(e) => {
                e.stopPropagation()
                setEditingUrlId(node.id)
                setEditUrl(node.url ?? '')
                setTimeout(() => urlRef.current?.focus(), 0)
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={12} cy={12} r={12} fill={hasUrl ? '#D97706' : '#64748B'} />
              <text x={12} y={12} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={10}>🔗</text>
            </g>

            {/* Add child: toggle direction picker */}
            <g
              transform={`translate(${w + 4}, ${h / 2 - 12})`}
              onClick={(e) => {
                e.stopPropagation()
                setAddDirNode(isShowingDirs ? null : node.id)
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={12} cy={12} r={12} fill={isShowingDirs ? '#059669' : '#16A34A'} />
              <text x={12} y={12} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={16} fontWeight="bold">+</text>
            </g>

            {/* Delete */}
            {node.id !== rootId && (
              <g
                transform={`translate(${w + 4}, ${h / 2 + 14})`}
                onClick={(e) => { e.stopPropagation(); deleteNode(node.id) }}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={12} cy={12} r={12} fill="#DC2626" />
                <text x={12} y={12} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={14}>×</text>
              </g>
            )}

            {/* Direction picker */}
            {isShowingDirs && renderDirPicker(node)}
          </>
        )}
      </g>
    )
  }

  const edges = nodes
    .filter((n) => n.parentId)
    .map((n) => renderEdge(n))
    .filter(Boolean)

  return (
    <div className="w-full h-full relative overflow-hidden bg-gray-50 select-none">
      <svg
        ref={svgRef}
        className="w-full h-full"
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: panStart ? 'grabbing' : 'default' }}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
          {edges}
          {nodes.map(renderNode)}
        </g>
      </svg>

      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white rounded-lg shadow px-3 py-2 text-sm text-gray-600">
        <button onClick={() => setScale((s) => Math.min(s + 0.1, 3))} className="hover:text-indigo-600 font-mono">+</button>
        <span className="w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.max(s - 0.1, 0.3))} className="hover:text-indigo-600 font-mono">−</button>
        <span className="mx-1 text-gray-300">|</span>
        <button
          onClick={() => { setScale(1); setOffset({ x: 400, y: 300 }) }}
          className="hover:text-indigo-600"
          title="中央にリセット"
        >↺</button>
      </div>

      {!readOnly && (
        <div className="absolute top-4 left-4 text-xs text-gray-400 bg-white/90 rounded-lg px-3 py-1.5 shadow-sm">
          <span className="font-medium text-gray-500">操作：</span>
          {' '}ダブルクリックで編集 · ドラッグで移動 · スクロールでズーム
          {' '}· +ボタンで方向を選んで子ノード追加 · 🔗でURLリンク設定
        </div>
      )}

      {/* URL link legend */}
      {nodes.some((n) => n.url) && (
        <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white/90 rounded-lg px-2 py-1 shadow-sm flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-300 border border-white" />
          URLリンクあり（クリックで開く）
        </div>
      )}
    </div>
  )
}
