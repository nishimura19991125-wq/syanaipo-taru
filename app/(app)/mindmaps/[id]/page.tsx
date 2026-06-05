'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Share2, Users, Globe, Lock } from 'lucide-react'
import type { Channel } from 'pusher-js'
import { getPusherClient } from '@/lib/pusher-client'
import { MindMapCanvas } from '@/components/mindmap/MindMapCanvas'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import type { MindMapData } from '@/types/mindmap'

interface ShareUser {
  id: string
  name: string | null
  email: string
  permission: string
}

interface ActiveUser {
  userId: string
  name: string
}

export default function MindMapEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [data, setData] = useState<MindMapData | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [showShare, setShowShare] = useState(false)
  const [shares, setShares] = useState<ShareUser[]>([])
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('edit')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')
  const channelRef = useRef<Channel | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRemoteUpdate = useRef(false)

  useEffect(() => {
    fetch(`/api/mindmaps/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.mindMap) {
          setTitle(json.mindMap.title)
          setData(JSON.parse(json.mindMap.data))
          setReadOnly(json.permission === 'view')
          setIsOwner(json.permission === 'owner')
          setIsPublic(json.mindMap.isPublic)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!user || !id) return

    const pusher = getPusherClient()
    const channel = pusher.subscribe(`presence-mindmap-${id}`)
    channelRef.current = channel

    channel.bind('pusher:subscription_succeeded', (members: {
      count: number
      members: Record<string, { name: string }>
      me: { id: string; info: { name: string } }
    }) => {
      const users: ActiveUser[] = Object.entries(members.members).map(([uid, info]) => ({
        userId: uid,
        name: info.name,
      }))
      setActiveUsers(users)
    })

    channel.bind('pusher:member_added', (member: { id: string; info: { name: string } }) => {
      setActiveUsers((prev) => [...prev, { userId: member.id, name: member.info.name }])
    })

    channel.bind('pusher:member_removed', (member: { id: string }) => {
      setActiveUsers((prev) => prev.filter((u) => u.userId !== member.id))
    })

    channel.bind('map_update', (newData: MindMapData) => {
      isRemoteUpdate.current = true
      setData(newData)
      setTimeout(() => { isRemoteUpdate.current = false }, 0)
    })

    return () => {
      pusher.unsubscribe(`presence-mindmap-${id}`)
      channelRef.current = null
    }
  }, [id, user])

  const save = useCallback(
    (newData: MindMapData) => {
      if (readOnly) return

      if (!isRemoteUpdate.current) {
        const pusher = getPusherClient()
        fetch('/api/pusher/event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-socket-id': pusher.connection.socket_id ?? '',
          },
          body: JSON.stringify({ mindMapId: id, data: newData }),
        })
      }

      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        fetch(`/api/mindmaps/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: JSON.stringify(newData) }),
        })
      }, 800)
    },
    [id, readOnly]
  )

  const loadShares = async () => {
    const res = await fetch(`/api/mindmaps/${id}/share`)
    if (res.ok) {
      const data = await res.json()
      setShares(data.shares.map((s: { user: ShareUser; permission: string }) => ({
        ...s.user,
        permission: s.permission,
      })))
    }
  }

  const openShare = async () => {
    await loadShares()
    setShowShare(true)
    setShareError('')
    setShareEmail('')
  }

  const handleShare = async () => {
    if (!shareEmail.trim()) return
    setSharing(true)
    setShareError('')
    const res = await fetch(`/api/mindmaps/${id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: shareEmail.trim(), permission: sharePermission }),
    })
    const data = await res.json()
    if (!res.ok) {
      setShareError(data.error || '共有に失敗しました')
    } else {
      setShareEmail('')
      await loadShares()
    }
    setSharing(false)
  }

  const handleRemoveShare = async (userId: string) => {
    await fetch(`/api/mindmaps/${id}/share`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    await loadShares()
  }

  const togglePublic = async () => {
    const res = await fetch(`/api/mindmaps/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: !isPublic }),
    })
    if (res.ok) setIsPublic(!isPublic)
  }

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col lg:h-[calc(100dvh-0px)]">
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <Link href="/mindmaps" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 active:bg-gray-200">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-gray-900 sm:text-lg">{title}</h1>
        {readOnly && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 sm:text-xs">閲覧のみ</span>
        )}

        {activeUsers.length > 1 && (
          <div className="flex shrink-0 items-center gap-1 text-xs text-gray-500 sm:text-sm">
            <Users size={16} />
            <span>{activeUsers.length}</span>
          </div>
        )}

        {isOwner && (
          <button
            onClick={openShare}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <Share2 size={16} />
            <span className="hidden sm:inline">共有</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden bg-gray-50">
        <MindMapCanvas data={data} onChange={save} readOnly={readOnly} />
      </div>

      <Modal open={showShare} onClose={() => setShowShare(false)} title="マインドマップを共有">
        <div className="flex flex-col gap-4">
          {isOwner && (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                {isPublic ? (
                  <Globe size={16} className="text-green-600" />
                ) : (
                  <Lock size={16} className="text-gray-400" />
                )}
                {isPublic ? '全体公開（リンクを知っている人全員）' : '非公開（招待者のみ）'}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={togglePublic}
              >
                {isPublic ? '非公開にする' : '公開にする'}
              </Button>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">メールアドレスで招待</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="user@example.com"
                type="email"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
              />
              <div className="flex gap-2">
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value as 'view' | 'edit')}
                  className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:flex-none sm:text-sm"
                >
                  <option value="edit">編集可</option>
                  <option value="view">閲覧のみ</option>
                </select>
                <Button onClick={handleShare} loading={sharing} size="sm" className="shrink-0">
                  招待
                </Button>
              </div>
            </div>
            {shareError && <p className="mt-1 text-xs text-red-600">{shareError}</p>}
          </div>

          {shares.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">共有中のユーザー</p>
              <ul className="flex flex-col gap-2">
                {shares.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.name || s.email}</p>
                      <p className="text-xs text-gray-500">{s.email} · {s.permission === 'edit' ? '編集可' : '閲覧のみ'}</p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => handleRemoveShare(s.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
