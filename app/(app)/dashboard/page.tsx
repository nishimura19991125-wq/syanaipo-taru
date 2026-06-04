'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell, Calendar, ChevronRight, GitBranch, Pin } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'

interface Announcement {
  id: string
  title: string
  content: string
  pinned: boolean
  authorName: string | null
  createdAt: string
}

const QUICK_LINKS = [
  {
    href: '/mindmaps',
    label: 'マインドマップ',
    desc: 'アイデアを枝分かれで整理',
    icon: GitBranch,
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    href: '/calendar',
    label: 'カレンダー',
    desc: '予定・締切を日付で管理',
    icon: Calendar,
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    href: '/announcements',
    label: 'お知らせ',
    desc: '社内掲示板・連絡事項',
    icon: Bell,
    color: 'bg-amber-100 text-amber-600',
  },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    fetch('/api/announcements')
      .then((r) => r.json())
      .then((d) => setAnnouncements((d.announcements ?? []).slice(0, 5)))
      .catch(() => {})
  }, [])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 md:gap-8">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-5 text-white shadow-lg md:p-8">
        <p className="text-sm font-medium text-indigo-200">社内ポータル</p>
        <h1 className="mt-1 text-xl font-bold md:text-2xl">
          ようこそ{user?.name ? `、${user.name}さん` : ''}
        </h1>
        <p className="mt-2 text-sm text-indigo-100 md:text-base">
          マインドマップ・カレンダー・お知らせをここからアクセスできます
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map(({ href, label, desc, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md active:scale-[0.99] md:p-5"
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
              <Icon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-gray-900">{label}</h2>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400" />
          </Link>
        ))}
      </div>

      {announcements.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">最新のお知らせ</h2>
            <Link href="/announcements" className="text-sm font-medium text-indigo-600 hover:underline">
              すべて見る
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {announcements.map((a) => (
              <li
                key={a.id}
                className={`rounded-xl border bg-white p-4 ${
                  a.pinned ? 'border-indigo-200 bg-indigo-50/40' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {a.pinned && <Pin size={14} className="mt-0.5 shrink-0 text-indigo-500" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-gray-900">{a.title}</span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {format(new Date(a.createdAt), 'M/d', { locale: ja })}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">{a.content}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
