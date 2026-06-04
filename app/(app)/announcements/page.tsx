'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Bell, Pin, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'

interface Announcement {
  id: string
  title: string
  content: string
  pinned: boolean
  authorId: string
  authorName: string | null
  createdAt: string
  updatedAt: string
}

interface AnnouncementForm {
  title: string
  content: string
  pinned: boolean
}

const EMPTY: AnnouncementForm = { title: '', content: '', pinned: false }

export default function AnnouncementsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState<AnnouncementForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const res = await fetch('/api/announcements')
    if (res.ok) {
      const data = await res.json()
      setAnnouncements(data.announcements)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY)
    setError('')
    setShowForm(true)
  }

  const openEdit = (a: Announcement) => {
    setEditing(a)
    setForm({ title: a.title, content: a.content, pinned: a.pinned })
    setError('')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      setError('タイトルと内容を入力してください')
      return
    }
    setSaving(true)
    setError('')
    try {
      const url = editing ? `/api/announcements/${editing.id}` : '/api/announcements'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存に失敗しました')
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このお知らせを削除しますか？')) return
    const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">お知らせ</h1>
          <p className="mt-1 text-sm text-gray-500">社内の連絡事項・掲示板</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="w-full sm:w-auto">
            <Plus size={16} className="mr-1" />
            新規投稿
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <Bell size={28} />
          </div>
          <p className="font-medium text-gray-900">お知らせがありません</p>
          {isAdmin && (
            <Button onClick={openNew} className="mt-6">
              <Plus size={16} className="mr-1" />
              最初のお知らせを投稿
            </Button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {announcements.map((a) => (
            <li
              key={a.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm md:p-5 ${
                a.pinned ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {a.pinned && (
                  <Pin size={16} className="mt-1 shrink-0 text-indigo-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-gray-900">{a.title}</h2>
                    {isAdmin && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => openEdit(a)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 active:bg-indigo-100"
                          title="編集"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 active:bg-red-100"
                          title="削除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 md:text-base">{a.content}</p>
                  <p className="mt-3 text-xs text-gray-400">
                    {a.authorName ?? '管理者'} ·{' '}
                    {format(new Date(a.createdAt), 'yyyy年M月d日', { locale: ja })}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'お知らせを編集' : 'お知らせを投稿'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="タイトル"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="お知らせのタイトル"
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">内容</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 md:text-sm"
              placeholder="お知らせの内容"
              required
            />
          </div>
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <Pin size={14} className="text-indigo-500" />
            上部に固定する
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)} className="w-full sm:w-auto">
              キャンセル
            </Button>
            <Button type="submit" loading={saving} className="w-full sm:w-auto">
              {editing ? '更新' : '投稿'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
