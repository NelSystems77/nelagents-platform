import { getAuthTenantId } from '@/lib/auth-server'
import { prisma } from '@saas-agents/db'
import { MessageSquare, Calendar, Users, TrendingUp } from 'lucide-react'

async function getDashboardMetrics(tenantId: string) {
  const [
    totalClients,
    totalMessages,
    upcomingAppointments,
    todayMessages,
  ] = await Promise.all([
    prisma.client.count({ where: { tenantId } }),
    prisma.message.count({ where: { tenantId } }),
    prisma.appointment.count({
      where: {
        tenantId,
        scheduledAt: { gte: new Date() },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    }),
    prisma.message.count({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ])

  return {
    totalClients,
    totalMessages,
    upcomingAppointments,
    todayMessages,
  }
}

export default async function DashboardPage() {
  const tenantId = await getAuthTenantId()
  const metrics = await getDashboardMetrics(tenantId)

  const stats = [
    {
      name: 'Mensajes Hoy',
      value: metrics.todayMessages,
      icon: MessageSquare,
      color: 'blue',
    },
    {
      name: 'Citas Próximas',
      value: metrics.upcomingAppointments,
      icon: Calendar,
      color: 'green',
    },
    {
      name: 'Total Clientes',
      value: metrics.totalClients,
      icon: Users,
      color: 'purple',
    },
    {
      name: 'Total Mensajes',
      value: metrics.totalMessages,
      icon: TrendingUp,
      color: 'orange',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Bienvenido a NEL SYSTEMS
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.name}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 bg-${stat.color}-50 dark:bg-${stat.color}-900/20 rounded-lg`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-600 dark:text-${stat.color}-400`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Actividad Reciente
          </h2>
          <div className="space-y-4">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No hay actividad reciente
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Acciones Rápidas
          </h2>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              Ver Conversaciones
            </button>
            <button className="w-full text-left px-4 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
              Agendar Cita
            </button>
            <button className="w-full text-left px-4 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
              Agregar Cliente
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}