'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { 
  LayoutDashboard, 
  MessageSquare, 
  Calendar, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Bot
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Conversaciones', href: '/dashboard/conversations', icon: MessageSquare },
  { name: 'Citas', href: '/dashboard/appointments', icon: Calendar },
  { name: 'Clientes', href: '/dashboard/clients', icon: Users },
  { name: 'Agentes', href: '/dashboard/agents', icon: Bot },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Configuración', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-4rem)] p-4">
      <ul className="space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Logout */}
      <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </nav>
  )
}
