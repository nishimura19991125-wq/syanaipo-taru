'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { Bell, Calendar, GitBranch, Home, LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { BottomNav } from '@/components/layout/BottomNav'
import { Sheet } from '@/components/ui/Sheet'

const NAV = [
  { href: '/dashboard', label: 'ホーム', icon: Home },
  { href: '/mindmaps', label: 'マインドマップ', icon: GitBranch },
  { href: '/calendar', label: 'カレンダー', icon: Calendar },
  { href: '/announcements', label: 'お知らせ', icon: Bell },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'ホーム',
  '/mindmaps': 'マインドマップ',
  '/calendar': 'カレンダー',
  '/announcements': 'お知らせ',
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith('/mindmaps/')) return 'マインドマップ編集'
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === path || pathname.startsWith(path + '/')) return title
  }
  return '社内ポータル'
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const isFullBleed = pathname.startsWith('/calendar') || pathname.startsWith('/mindmaps/')

  return (
    <div className="flex min-h-[100dvh] bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-5">
          <p className="text-lg font-bold text-indigo-600">社内ポータル</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${user.role === 'admin' ? 'bg-amber-400' : 'bg-green-400'}`} />
            <p className="truncate text-sm text-gray-600">{user.name ?? user.email}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => logout()}>
            <LogOut size={16} className="mr-2" />
            ログアウト
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200"
            aria-label="メニュー"
          >
            <Menu size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-gray-900">{getPageTitle(pathname)}</p>
            <p className="truncate text-xs text-gray-500">{user.name ?? user.email}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            user.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
          }`}>
            {user.role === 'admin' ? '管理者' : 'メンバー'}
          </span>
        </header>

        <main className={clsx(
          'flex-1 overflow-auto',
          isFullBleed ? 'p-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:p-0 lg:pb-0' : 'p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 lg:p-8 lg:pb-8'
        )}>
          {children}
        </main>
      </div>

      <BottomNav />

      {/* Mobile menu sheet */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="メニュー" side="left">
        <div className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
          <hr className="my-2 border-gray-200" />
          <button
            onClick={() => { setMenuOpen(false); logout() }}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut size={20} />
            ログアウト
          </button>
        </div>
      </Sheet>
    </div>
  )
}
