import { getAuthTenantId } from '@/lib/auth-server'
import { createTenantClient } from '@saas-agents/db'
import { Bot, CheckCircle, XCircle, Settings } from 'lucide-react'


async function getAgents(tenantId: string) {
  const db = createTenantClient(tenantId)
  
  const agents = await db.agentInstance.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  })

  return agents
}

export default async function AgentsPage() {
  const tenantId = await getAuthTenantId()


  const agents = await getAgents(tenantId)

  const activeAgents = agents.filter((a: any) => a.enabled)
  const inactiveAgents = agents.filter((a: any) => !a.enabled)

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Agentes Inteligentes
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configura y gestiona tus agentes de IA
          </p>
        </div>
        
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
          Nuevo Agente
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Activos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeAgents.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
              <XCircle className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Inactivos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{inactiveAgents.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{agents.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agents List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Mis Agentes
          </h2>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {agents.length === 0 ? (
            <div className="p-8 text-center">
              <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No hay agentes configurados
              </p>
              <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Crear Primer Agente
              </button>
            </div>
          ) : (
            agents.map((agent: any) => (
              <div
                key={agent.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {agent.name}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        agent.enabled
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {agent.enabled ? 'Activo' : 'Inactivo'}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {agent.agentType}
                      </span>
                    </div>

                    {agent.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {agent.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                      <span>Versión {agent.version}</span>
                      <span>•</span>
                      <span>Creado {new Date(agent.createdAt).toLocaleDateString('es')}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                      <Settings className="w-4 h-4" />
                    </button>
                    <button className={`px-3 py-1 text-sm rounded-lg font-medium ${
                      agent.enabled
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {agent.enabled ? 'Desactivar' : 'Activar'}
                    </button>
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