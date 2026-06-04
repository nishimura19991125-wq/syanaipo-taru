'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MindMapNode, MindMapData, NodeDirection } from '@/types/mindmap'

const NODE_COLORS = [
  '#4F46E5', '#7C3AED', '#DB2777', '#DC2626',
  '#D97706', '#16A34A', '#0891B2', '#2563EB',
]
const NODE_W = 160
const NODE_H = 44
/** 親ノードからの出線・子ノードへの入線（すべて統一） */
const STEM_LEN = 48
/** 出線と入線のあいだのスパン */
const H_GAP = 56
const V_GAP = 56
/** 兄弟ノードの縦（横）間隔 */
const SIBLING_GAP = 72
const BRANCH_DIST = NODE_W + STEM_LEN * 2 + H_GAP
const BRANCH_VERT = NODE_H + STEM_LEN * 2 + V_GAP
const LINE_BLUE = '#3B82F6'
const LINE_BLUE_DARK = '#2563EB'
const TOGGLE_R = 8
const TOGGLE_HIT = 22

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

function getChildren(nodes: MindMapNode[], parentId: string) {
  return nodes.filter((n) => n.parentId === parentId)
}

function isHorizontalDirection(dir?: NodeDirection) {
  return dir === 'left' || dir === 'right'
}

function isVerticalDirection(dir?: NodeDirection) {
  return dir === 'up' || dir === 'down'
}

function countSubtree(nodes: MindMapNode[], nodeId: string): number {
  let count = 0
  const walk = (id: string) => {
    for (const child of getChildren(nodes, id)) {
      count += 1
      walk(child.id)
    }
  }
  walk(nodeId)
  return count
}

function countHorizontalSubtree(nodes: MindMapNode[], nodeId: string): number {
  let count = 0
  for (const child of getChildren(nodes, nodeId)) {
    if (isHorizontalDirection(child.direction)) {
      count += 1 + countSubtree(nodes, child.id)
    }
  }
  return count
}

function countVerticalSubtree(nodes: MindMapNode[], nodeId: string): number {
  let count = 0
  for (const child of getChildren(nodes, nodeId)) {
    if (isVerticalDirection(child.direction)) {
      count += 1 + countSubtree(nodes, child.id)
    }
  }
  return count
}

function hasHorizontalBranch(nodes: MindMapNode[], nodeId: string) {
  return countHorizontalSubtree(nodes, nodeId) > 0
}

function hasVerticalBranch(nodes: MindMapNode[], nodeId: string) {
  return countVerticalSubtree(nodes, nodeId) > 0
}

function getBranchChildOnPath(
  nodeId: string,
  ancestorId: string,
  nodes: MindMapNode[],
): MindMapNode | null {
  let current = nodes.find((n) => n.id === nodeId)
  if (!current || nodeId === ancestorId) return null

  while (current.parentId && current.parentId !== ancestorId) {
    const parent = nodes.find((n) => n.id === current!.parentId)
    if (!parent) return null
    current = parent
  }
  if (!current?.parentId || current.parentId !== ancestorId) return null
  return current
}

/** 祖先から見て「横の枝」配下（横→縦の入れ子も含む） */
function isInHorizontalSubtree(nodeId: string, ancestorId: string, nodes: MindMapNode[]): boolean {
  const branch = getBranchChildOnPath(nodeId, ancestorId, nodes)
  return branch ? isHorizontalDirection(branch.direction) : false
}

/** 祖先から見て「縦の枝」配下（縦→横の入れ子も含む） */
function isInVerticalSubtree(nodeId: string, ancestorId: string, nodes: MindMapNode[]): boolean {
  const branch = getBranchChildOnPath(nodeId, ancestorId, nodes)
  return branch ? isVerticalDirection(branch.direction) : false
}

/** 写真風: ルート=全体 / 横グループ / 縦グループを個別に切替 */
function isNodeVisible(node: MindMapNode, nodes: MindMapNode[], rootId: string): boolean {
  if (node.id === rootId) return true

  const root = nodes.find((n) => n.id === rootId)
  if (root?.collapsed) return false

  for (const parent of nodes) {
    if (parent.collapsed && isInHorizontalSubtree(node.id, parent.id, nodes)) return false
    if (parent.collapsedVertical && isInVerticalSubtree(node.id, parent.id, nodes)) return false
  }
  return true
}

/** 出線スタブの先端（線上トグルの位置） */
function getStemEnd(parent: MindMapNode, dir: NodeDirection): [number, number] {
  const [x1, y1] = getAnchor(parent, 'from', dir)
  if (dir === 'right') return [x1 + STEM_LEN, y1]
  if (dir === 'left') return [x1 - STEM_LEN, y1]
  if (dir === 'down') return [x1, y1 + STEM_LEN]
  return [x1, y1 - STEM_LEN]
}

function branchCollapsed(
  parent: MindMapNode,
  scope: 'horizontal' | 'vertical' | 'all',
): boolean {
  if (scope === 'all') return !!parent.collapsed
  if (scope === 'horizontal') return !!parent.collapsed
  return !!parent.collapsedVertical
}

/** 直角の直線（各セグメント長を固定・伸縮しない） */
function fixedEdgePath(x1: number, y1: number, x2: number, y2: number, dir: NodeDirection): string {
  if (dir === 'right') {
    const c1 = x1 + STEM_LEN
    const c2 = x1 + STEM_LEN + H_GAP
    if (Math.abs(y1 - y2) < 0.5) {
      return `M ${x1} ${y1} L ${c1} ${y1} L ${c2} ${y1} L ${x2} ${y2}`
    }
    return `M ${x1} ${y1} L ${c1} ${y1} L ${c1} ${y2} L ${x2} ${y2}`
  }
  if (dir === 'left') {
    const c1 = x1 - STEM_LEN
    const c2 = x1 - STEM_LEN - H_GAP
    if (Math.abs(y1 - y2) < 0.5) {
      return `M ${x1} ${y1} L ${c1} ${y1} L ${c2} ${y1} L ${x2} ${y2}`
    }
    return `M ${x1} ${y1} L ${c1} ${y1} L ${c1} ${y2} L ${x2} ${y2}`
  }
  if (dir === 'down') {
    const c1 = y1 + STEM_LEN
    const c2 = y1 + STEM_LEN + V_GAP
    if (Math.abs(x1 - x2) < 0.5) {
      return `M ${x1} ${y1} L ${x1} ${c1} L ${x1} ${c2} L ${x2} ${y2}`
    }
    return `M ${x1} ${y1} L ${x1} ${c1} L ${x2} ${c1} L ${x2} ${y2}`
  }
  const c1 = y1 - STEM_LEN
  const c2 = y1 - STEM_LEN - V_GAP
  if (Math.abs(x1 - x2) < 0.5) {
    return `M ${x1} ${y1} L ${x1} ${c1} L ${x1} ${c2} L ${x2} ${y2}`
  }
  return `M ${x1} ${y1} L ${x1} ${c1} L ${x2} ${c1} L ${x2} ${y2}`
}

/** ルート位置を保ちつつ全ノードを固定間隔で再配置 */
function relayoutTree(nodes: MindMapNode[], rootId: string): MindMapNode[] {
  const map = new Map(nodes.map((n) => [n.id, { ...n }]))
  const root = map.get(rootId)
  if (!root) return nodes

  const layoutChildren = (parentId: string) => {
    const parent = map.get(parentId)!
    const children = nodes.filter((n) => n.parentId === parentId)
    const byDir = new Map<NodeDirection, MindMapNode[]>()

    for (const child of children) {
      const dir = child.direction ?? 'right'
      if (!byDir.has(dir)) byDir.set(dir, [])
      byDir.get(dir)!.push(child)
    }

    for (const [dir, group] of byDir) {
      const sorted = [...group].sort((a, b) => {
        if (dir === 'right' || dir === 'left') return a.y - b.y
        return a.x - b.x
      })
      sorted.forEach((child, index) => {
        const before = sorted.slice(0, index)
        const pos = nextPosition(parent, dir, before)
        map.set(child.id, { ...map.get(child.id)!, x: pos.x, y: pos.y })
        layoutChildren(child.id)
      })
    }
  }

  layoutChildren(rootId)
  return nodes.map((n) => map.get(n.id)!)
}

function nextPosition(parent: MindMapNode, dir: NodeDirection, siblingsBefore: MindMapNode[]): { x: number; y: number } {
  const spread = siblingsBefore.length * (SIBLING_GAP / 2)
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

  useEffect(() => {
    setNodes(relayoutTree(data.nodes, data.rootId))
  }, [data])

  useEffect(() => {
    if (!selectedId) return
    const visible = nodes.filter((n) => isNodeVisible(n, nodes, rootId))
    if (!visible.some((n) => n.id === selectedId)) {
      setSelectedId(null)
      setAddDirNode(null)
    }
  }, [nodes, selectedId, rootId])

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
    const updated = relayoutTree([...nodes, newNode], rootId)
    setNodes(updated)
    notifyChange(updated)
    setAddDirNode(null)
    setEditingId(newId)
    setEditText('新しいトピック')
    setSelectedId(newId)
  }, [nodes, readOnly, notifyChange])

  const toggleCollapse = useCallback((nodeId: string, scope: 'all' | 'horizontal' | 'vertical') => {
    const updated = nodes.map((n) => {
      if (n.id !== nodeId) return n
      if (scope === 'all') return { ...n, collapsed: !n.collapsed }
      if (scope === 'horizontal') return { ...n, collapsed: !n.collapsed }
      return { ...n, collapsedVertical: !n.collapsedVertical }
    })
    const laid = relayoutTree(updated, rootId)
    setNodes(laid)
    notifyChange(laid)
  }, [nodes, rootId, notifyChange])

  const deleteNode = useCallback((nodeId: string) => {
    if (readOnly || nodeId === rootId) return
    const collect = (id: string): string[] => {
      const kids = nodes.filter((n) => n.parentId === id).map((n) => n.id)
      return [id, ...kids.flatMap(collect)]
    }
    const toDelete = new Set(collect(nodeId))
    const updated = relayoutTree(nodes.filter((n) => !toDelete.has(n.id)), rootId)
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
    if ((e.target as Element).closest('.node-control')) return
    e.stopPropagation()
    setSelectedId(nodeId)
    setAddDirNode(null)
    if (readOnly || nodeId !== rootId) return
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
      setNodes((prev) => relayoutTree(
        prev.map((n) =>
          n.id === drag.nodeId ? { ...n, x: drag.originX + dx, y: drag.originY + dy } : n
        ),
        rootId,
      ))
    } else if (panStart) {
      setOffset({ x: panOrigin.x + (e.clientX - panStart.x), y: panOrigin.y + (e.clientY - panStart.y) })
    }
  }, [drag, panStart, panOrigin, scale, rootId])

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
    if (!isNodeVisible(child, nodes, rootId) || !isNodeVisible(parent, nodes, rootId)) {
      return null
    }
    const dir = child.direction ?? 'right'
    const [x1, y1] = getAnchor(parent, 'from', dir)
    const [x2, y2] = getAnchor(child, 'to', dir)
    const d = fixedEdgePath(x1, y1, x2, y2, dir)
    return (
      <path
        key={`edge-${parent.id}-${child.id}`}
        d={d}
        fill="none"
        stroke={LINE_BLUE}
        strokeWidth={2.5}
        strokeOpacity={0.9}
        strokeLinejoin="round"
      />
    )
  }

  const stopPointer = (e: React.SyntheticEvent) => e.stopPropagation()

  const renderActionButton = (
    key: string,
    transform: string,
    onActivate: () => void,
    renderShape: () => React.ReactNode,
    size = 24,
  ) => (
    <g
      key={key}
      transform={transform}
      className="node-control"
      onMouseDown={stopPointer}
      onPointerDown={stopPointer}
      onTouchStart={stopPointer}
      onClick={(e) => { stopPointer(e); onActivate() }}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={-4}
        y={-4}
        width={size + 8}
        height={size + 8}
        fill="transparent"
        pointerEvents="all"
      />
      {renderShape()}
    </g>
  )

  /** 写真風: 展開時=中空リング / 折りたたみ時=ルートのみ実心+ */
  const renderLineToggle = (
    key: string,
    x: number,
    y: number,
    collapsed: boolean,
    isRoot: boolean,
    title: string,
    onClick: () => void,
  ) => (
    <g
      key={key}
      className="node-control"
      transform={`translate(${x}, ${y})`}
      onMouseDown={stopPointer}
      onPointerDown={stopPointer}
      onTouchStart={stopPointer}
      onClick={(e) => { stopPointer(e); onClick() }}
      style={{ cursor: 'pointer' }}
    >
      <title>{title}</title>
      <rect
        x={-TOGGLE_HIT / 2}
        y={-TOGGLE_HIT / 2}
        width={TOGGLE_HIT}
        height={TOGGLE_HIT}
        fill="transparent"
        pointerEvents="all"
      />
      {collapsed && isRoot ? (
        <>
          <circle r={TOGGLE_R} fill={LINE_BLUE_DARK} stroke={LINE_BLUE_DARK} strokeWidth={2} pointerEvents="none" />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={13}
            fontWeight="600"
            pointerEvents="none"
          >
            +
          </text>
        </>
      ) : (
        <>
          <circle r={TOGGLE_R} fill="white" stroke={LINE_BLUE} strokeWidth={2.5} pointerEvents="none" />
          <circle r={2.5} fill={LINE_BLUE} pointerEvents="none" />
        </>
      )}
    </g>
  )

  const renderBranchToggles = () => {
    if (readOnly) return null
    const toggles: React.ReactNode[] = []

    const root = nodes.find((n) => n.id === rootId)
    if (root && getChildren(nodes, rootId).length > 0) {
      const firstChild = getChildren(nodes, rootId)[0]
      const dir = firstChild.direction ?? 'right'
      const [jx, jy] = getStemEnd(root, dir)
      const collapsed = branchCollapsed(root, 'all')
      const count = countHorizontalSubtree(nodes, root.id) + countVerticalSubtree(nodes, root.id)
      toggles.push(renderLineToggle(
        `toggle-${root.id}-all`,
        jx,
        jy,
        collapsed,
        true,
        collapsed ? `${count}件を表示` : 'すべての枝を非表示',
        () => toggleCollapse(root.id, 'all'),
      ))
    }

    for (const parent of nodes) {
      if (parent.id === rootId) continue
      if (!isNodeVisible(parent, nodes, rootId)) continue

      const children = getChildren(nodes, parent.id)
      const firstH = children.find((c) => isHorizontalDirection(c.direction))
      const firstV = children.find((c) => isVerticalDirection(c.direction))

      if (hasHorizontalBranch(nodes, parent.id) && firstH) {
        const dir = firstH.direction ?? 'right'
        const [jx, jy] = getStemEnd(parent, dir)
        const collapsed = branchCollapsed(parent, 'horizontal')
        const count = countHorizontalSubtree(nodes, parent.id)
        toggles.push(renderLineToggle(
          `toggle-${parent.id}-h`,
          jx,
          jy,
          collapsed,
          false,
          collapsed ? `横の枝${count}件を表示` : '横の枝を非表示',
          () => toggleCollapse(parent.id, 'horizontal'),
        ))
      }
      if (hasVerticalBranch(nodes, parent.id) && firstV) {
        const dir = firstV.direction ?? 'down'
        const [jx, jy] = getStemEnd(parent, dir)
        const collapsed = branchCollapsed(parent, 'vertical')
        const count = countVerticalSubtree(nodes, parent.id)
        toggles.push(renderLineToggle(
          `toggle-${parent.id}-v`,
          jx,
          jy,
          collapsed,
          false,
          collapsed ? `縦の枝${count}件を表示` : '縦の枝を非表示',
          () => toggleCollapse(parent.id, 'vertical'),
        ))
      }
    }

    return toggles
  }

  const renderSelectionAddHandle = () => {
    if (readOnly || !selectedId) return null
    const node = nodes.find((n) => n.id === selectedId)
    if (!node || !isNodeVisible(node, nodes, rootId)) return null

    const dir: NodeDirection = 'right'
    const [x1, y1] = getAnchor(node, 'from', dir)
    const [jx, jy] = getStemEnd(node, dir)
    const isShowingDirs = addDirNode === node.id

    return (
      <g key={`add-${node.id}`}>
        <line
          x1={x1}
          y1={y1}
          x2={jx}
          y2={jy}
          stroke={LINE_BLUE}
          strokeWidth={2.5}
          strokeOpacity={0.7}
          strokeDasharray={isShowingDirs ? undefined : '4 3'}
        />
        <g
          className="node-control"
          transform={`translate(${jx}, ${jy})`}
          onMouseDown={stopPointer}
          onPointerDown={stopPointer}
          onTouchStart={stopPointer}
          onClick={(e) => { stopPointer(e); setAddDirNode(isShowingDirs ? null : node.id) }}
          style={{ cursor: 'pointer' }}
        >
          <title>子トピックを追加</title>
          <rect
            x={-TOGGLE_HIT / 2}
            y={-TOGGLE_HIT / 2}
            width={TOGGLE_HIT}
            height={TOGGLE_HIT}
            fill="transparent"
            pointerEvents="all"
          />
          <circle
            r={TOGGLE_R}
            fill={isShowingDirs ? LINE_BLUE : 'white'}
            stroke={LINE_BLUE}
            strokeWidth={2.5}
            pointerEvents="none"
          />
          {isShowingDirs && (
            <circle r={2.5} fill="white" pointerEvents="none" />
          )}
        </g>
        {isShowingDirs && (
          <g transform={`translate(${jx}, ${jy})`}>
            {renderDirPickerAt(node, dir)}
          </g>
        )}
      </g>
    )
  }

  const renderDirPickerAt = (node: MindMapNode, _originDir: NodeDirection) => {
    const dirs: { dir: NodeDirection; label: string; ox: number; oy: number }[] = [
      { dir: 'right', label: '→', ox: 36, oy: 0 },
      { dir: 'left', label: '←', ox: -36, oy: 0 },
      { dir: 'up', label: '↑', ox: 0, oy: -36 },
      { dir: 'down', label: '↓', ox: 0, oy: 36 },
    ]
    return dirs.map(({ dir, label, ox, oy }) =>
        renderActionButton(
          `dir-${dir}`,
          `translate(${ox - 12}, ${oy - 12})`,
          () => addNode(node.id, dir),
          () => (
            <>
              <circle cx={12} cy={12} r={12} fill="white" stroke={LINE_BLUE} strokeWidth={2} pointerEvents="none" />
              <text x={12} y={12} textAnchor="middle" dominantBaseline="middle" fill={LINE_BLUE} fontSize={13} fontWeight="bold" pointerEvents="none">{label}</text>
            </>
          ),
        )
      )
  }

  const renderNode = (node: MindMapNode) => {
    const isSelected = selectedId === node.id
    const isEditing = editingId === node.id
    const isEditingUrl = editingUrlId === node.id
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
        style={{
          cursor: drag?.nodeId === node.id
            ? 'grabbing'
            : (readOnly || !isRoot ? 'default' : 'grab'),
        }}
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
            {renderActionButton(
              'edit',
              `translate(-28, ${h / 2 - 12})`,
              () => {
                setEditingId(node.id)
                setEditText(node.text)
                setTimeout(() => editRef.current?.select(), 0)
              },
              () => (
                <>
                  <circle cx={12} cy={12} r={12} fill="#2563EB" pointerEvents="none" />
                  <text x={12} y={12} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={11} pointerEvents="none">✏</text>
                </>
              ),
            )}

            {renderActionButton(
              'link',
              `translate(-28, ${h / 2 + 14})`,
              () => {
                setEditingUrlId(node.id)
                setEditUrl(node.url ?? '')
                setTimeout(() => urlRef.current?.focus(), 0)
              },
              () => (
                <>
                  <circle cx={12} cy={12} r={12} fill={hasUrl ? '#D97706' : '#64748B'} pointerEvents="none" />
                  <text x={12} y={12} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={10} pointerEvents="none">🔗</text>
                </>
              ),
            )}

            {node.id !== rootId && renderActionButton(
              'delete',
              `translate(${w + 4}, ${h / 2 + 14})`,
              () => deleteNode(node.id),
              () => (
                <>
                  <circle cx={12} cy={12} r={12} fill="#DC2626" pointerEvents="none" />
                  <text x={12} y={12} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={14} pointerEvents="none">×</text>
                </>
              ),
            )}

          </>
        )}
      </g>
    )
  }

  const visibleNodes = nodes.filter((n) => isNodeVisible(n, nodes, rootId))

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
          {visibleNodes.map(renderNode)}
          {renderBranchToggles()}
          {renderSelectionAddHandle()}
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
          {' '}ダブルクリックで編集 · ルートをドラッグで移動 · スクロールでズーム
          {' '}· 線上の青リングで枝の表示切替 · リングをクリックで子追加
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
