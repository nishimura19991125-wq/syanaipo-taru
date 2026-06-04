'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LoginForm } from '@/components/auth/LoginForm'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

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

  if (user) return null

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-indigo-50 to-gray-50 p-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <LoginForm />
    </div>
  )
}
