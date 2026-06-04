'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { Bell, Calendar, GitBranch, Home } from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'ホーム', icon: Home },
  { href: '/mindmaps', label: 'マップ', icon: GitBranch },
  { href: '/calendar', label: 'カレンダー', icon: Calendar },
  { href: '/announcements', label: 'お知らせ', icon: Bell },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex min-h-[56px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors',
                active ? 'text-indigo-600' : 'text-gray-500 active:text-indigo-500'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
