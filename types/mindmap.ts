export type NodeDirection = 'right' | 'left' | 'up' | 'down'

export interface MindMapNode {
  id: string
  text: string
  x: number
  y: number
  color?: string
  parentId?: string | null
  direction?: NodeDirection
  url?: string
  /** 横（→←）の派生を非表示 */
  collapsed?: boolean
  /** 縦（↑↓）の派生を非表示（写真の分岐リスト用） */
  collapsedVertical?: boolean
}

export interface MindMapData {
  nodes: MindMapNode[]
  rootId: string
}

export interface MindMapMeta {
  id: string
  title: string
  isPublic: boolean
  ownerId: string
  ownerName: string | null
  createdAt: string
  updatedAt: string
  permission?: 'view' | 'edit' | 'owner'
}
