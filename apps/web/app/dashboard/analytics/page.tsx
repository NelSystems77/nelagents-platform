import { getAuthTenantId } from '@/lib/auth-server'
import { createTenantClient } from '@saas-agents/db'
import { BarChart3, TrendingUp, Users, MessageSquare } from 'lucide-react'


async function getAnalytics(tenantId: string) {
  const db = createTenantClient(tenantId)
  
  // Últimos 30 días
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const [
    totalMessages,
    totalClients,
    totalAppointments,
    activeConversations,
  ] = await Promise.all([
    db.message.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.client.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.appointment.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.conversation.count({
      where: {
        status: 'OPEN',
      },
    }),
  ])

  return {
    totalMessages,
    totalClients,
    totalAppointments,
    activeConversations,
  }
}

export default async function AnalyticsPage() {
  const tenantId = await getAuthTenantId()
  const analytics = await getAnalytics(tenantId)

  const stats = [
    {
      name: 'Mensajes (30 días)',
      value: analytics.totalMessages,
      icon: MessageSquare,
      change: '+12%',
      positive: true,
    },
    {
      name: 'Nuevos Clientes',
      value: analytics.totalClients,
      icon: Users,
      change: '+8%',
      positive: true,
    },
    {
      name: 'Citas Creadas',
      value: analytics.totalAppointments,
      icon: BarChart3,
      change: '+15%',
      positive: true,
    },
    {
      name: 'Conversaciones Activas',
      value: analytics.activeConversations,
      icon: TrendingUp,
      change: '-3%',
      positive: false,
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Métricas y estadísticas de tu negocio
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.name}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className={`text-sm font-medium ${
                  stat.positive 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.name}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stat.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* Charts Placeholder */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Mensajes por Día
          </h2>
          <div className="h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Gráfica disponible próximamente</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tasa de Conversión
          </h2>
          <div className="h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Gráfica disponible próximamente</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}