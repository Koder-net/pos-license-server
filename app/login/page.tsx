'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      })
      if (res.ok) {
        router.push(params.get('next') ?? '/')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Incorrect admin secret')
      }
    } catch {
      setError('Unable to reach the server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 ring-1 ring-gray-800 p-8 rounded-2xl w-full max-w-sm space-y-4"
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">KodernetPOS</h1>
        <p className="text-gray-500 text-sm">Central Admin Control Panel</p>
      </div>

      <input
        type="password"
        value={secret}
        onChange={(e) => {
          setSecret(e.target.value)
          setError('')
        }}
        placeholder="Admin secret"
        autoFocus
        className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !secret}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
