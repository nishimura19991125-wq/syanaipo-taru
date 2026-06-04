'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GitBranch, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

interface MindMapItem {
  id: string
  title: string
  permission: string
  updatedAt: string
}

export default function MindMapsPage() {
  const [maps, setMaps] = useState<MindMapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    const res = await fetch('/api/mindmaps')
    if (res.ok) {
      const data = await res.json()
      setMaps(data.mindMaps)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const createMap = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    const res = await fetch('/api/mindmaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() }),
    })
    setCreating(false)
    if (res.ok) {
      setShowNew(false)
      setNewTitle('')
      await load()
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">マインドマップ</h1>
          <p className="mt-1 text-sm text-gray-500">アイデアを視覚的に整理</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="w-full sm:w-auto">
          <Plus size={16} className="mr-1" />
          新規作成
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : maps.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
            <GitBranch size={28} />
          </div>
          <p className="font-medium text-gray-900">マインドマップがありません</p>
          <p className="mt-1 text-sm text-gray-500">新規作成してアイデア整理を始めましょう</p>
          <Button onClick={() => setShowNew(true)} className="mt-6">
            <Plus size={16} className="mr-1" />
            最初のマップを作成
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {maps.map((m) => (
            <li key={m.id}>
              <Link
                href={`/mindmaps/${m.id}`}
                className="group block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md active:scale-[0.99] md:p-5"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                  <GitBranch size={20} />
                </div>
                <h2 className="truncate font-semibold text-gray-900">{m.title}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  更新: {new Date(m.updatedAt).toLocaleDateString('ja-JP')}
                </p>
                {m.permission !== 'owner' && (
                  <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                    {m.permission === 'edit' ? '編集可' : '閲覧のみ'}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="新しいマインドマップ">
        <div className="flex flex-col gap-4">
          <Input
            label="タイトル"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="プロジェクト名など"
            onKeyDown={(e) => e.key === 'Enter' && createMap()}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setShowNew(false)} className="w-full sm:w-auto">
              キャンセル
            </Button>
            <Button onClick={createMap} loading={creating} className="w-full sm:w-auto">
              作成
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
