'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import {
  LayoutDashboard,
  UtensilsCrossed,
  Dumbbell,
  User,
} from 'lucide-react'
import clsx from 'clsx'

const inter = Inter({ subsets: ['latin'] })

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/refeicoes', label: 'Refeições', icon: UtensilsCrossed },
  { href: '/treinos', label: 'Treinos', icon: Dumbbell },
  { href: '/perfil', label: 'Perfil', icon: User },
]

function Navigation() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen bg-gray-900 border-r border-gray-800 fixed left-0 top-0 bottom-0 z-10">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">Fitness</h1>
              <p className="text-gray-400 text-xs">Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <p className="text-gray-500 text-xs text-center">
            Powered by Claude AI
          </p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-10">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-all',
                  isActive
                    ? 'text-primary-400'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                <Icon className={clsx('w-5 h-5', isActive && 'text-primary-400')} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // 2 minutes
            retry: 1,
          },
        },
      })
  )

  return (
    <html lang="pt-BR" className="dark">
      <head>
        <title>Fitness Dashboard</title>
        <meta name="description" content="Rastreador de déficit calórico com Samsung Health e IA" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={clsx(inter.className, 'bg-gray-950 text-white')}>
        <QueryClientProvider client={queryClient}>
          <div className="flex min-h-screen">
            <Navigation />
            {/* Main content */}
            <main className="flex-1 md:ml-64 pb-20 md:pb-0">
              <div className="min-h-screen bg-gray-950">
                {children}
              </div>
            </main>
          </div>
        </QueryClientProvider>
      </body>
    </html>
  )
}
