'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode } from 'react'

const NAV = [
  { href: '/', label: 'Dashboard', icon: '◈' },
  { href: '/installations', label: 'Installations', icon: '▤' },
  { href: '/licenses', label: 'Licenses', icon: '🔑' },
  { href: '/logs', label: 'Live Logs', icon: '≣' },
  { href: '/commands', label: 'Commands', icon: '⌘' },
]

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-800 bg-gray-900/50 flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-gray-800">
          <p className="font-bold text-white leading-tight">KodernetPOS</p>
          <p className="text-xs text-gray-500">Control Panel</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="w-4 text-center opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  )
}
