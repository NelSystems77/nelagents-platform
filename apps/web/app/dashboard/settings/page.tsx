import { getAuthTenantId } from '@/lib/auth-server'
import { createTenantClient } from '@saas-agents/db'
import { User, Building2, Bell, Shield, CreditCard, Palette } from 'lucide-react'


async function getTenantSettings(tenantId: string) {
  const db = createTenantClient(tenantId)
  
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      users: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  return tenant
}

export default async function SettingsPage() {
  const tenantId = await getAuthTenantId()
  const tenant = await getTenantSettings(tenantId)

  if (!tenant) {
    return (
      <div className="p-8">
        <p>Tenant no encontrado</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Configuración
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gestiona las preferencias de tu cuenta y organización
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Información de la Cuenta
          </h2>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre de la Empresa
              </label>
              <input
                type="text"
                defaultValue={tenant.name}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Slug
              </label>
              <input
                type="text"
                defaultValue={tenant.slug}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Plan Actual
              </label>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-sm font-medium">
                  {tenant.planType}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  tenant.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {tenant.status}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Zona Horaria
              </label>
              <input
                type="text"
                defaultValue={tenant.timezone}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                readOnly
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Límites del Plan
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Usuarios Máximos
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tenant.maxUsers}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {tenant.users.length} en uso
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Clientes Máximos
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tenant.maxClients.toLocaleString()}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Mensajes Mensuales
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tenant.maxMonthlyMessages.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Guardar Cambios
            </button>
            <button className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}