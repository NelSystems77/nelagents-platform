import { getAuthTenantId } from '@/lib/auth-server'
import { createTenantClient } from '@saas-agents/db'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Clock, User } from 'lucide-react'


async function getAppointments(tenantId: string) {
  const db = createTenantClient(tenantId)
  
  const appointments = await db.appointment.findMany({
    where: {
      scheduledAt: {
        gte: new Date(),
      },
    },
    include: {
      client: true,
      assignedTo: true,
    },
    orderBy: {
      scheduledAt: 'asc',
    },
    take: 100,
  })

  return appointments
}

export default async function AppointmentsPage() {
  // Por ahora usar tenantId hardcoded del seed
  // TODO: Obtener de la sesión cuando se resuelva el problema de next-auth
  const tenantId = await getAuthTenantId()
  
  const appointments = await getAppointments(tenantId)

  // Agrupar por estado
  const scheduled = appointments.filter(a => a.status === 'SCHEDULED')
  const confirmed = appointments.filter(a => a.status === 'CONFIRMED')

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Citas
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestiona y agenda citas con tus clientes
          </p>
        </div>
        
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
          Nueva Cita
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{scheduled.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Confirmadas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{confirmed.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{appointments.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Próximas Citas
          </h2>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {appointments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No hay citas programadas
              </p>
            </div>
          ) : (
            appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {appointment.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        appointment.status === 'CONFIRMED'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {appointment.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{appointment.client.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(appointment.scheduledAt), "dd 'de' MMMM 'a las' HH:mm", { locale: es })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{appointment.duration} min</span>
                      </div>
                    </div>

                    {appointment.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {appointment.description}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button className="px-3 py-1 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30">
                      Editar
                    </button>
                    {!appointment.confirmed && (
                      <button className="px-3 py-1 text-sm bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30">
                        Confirmar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}