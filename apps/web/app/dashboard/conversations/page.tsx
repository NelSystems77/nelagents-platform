import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, createTenantClient } from '@saas-agents/db'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

async function getConversations(tenantId: string) {
  const db = createTenantClient(tenantId)
  
  const conversations = await db.conversation.findMany({
    include: {
      client: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: {
      lastMessageAt: 'desc',
    },
    take: 50,
  })

  return conversations
}

export default async function ConversationsPage() {
  const session = await getServerSession(authOptions)
  const conversations = await getConversations(session!.user.tenantId)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Conversaciones
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Inbox de mensajes de WhatsApp y otros canales
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              Todas
            </button>
            <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
              No leídas
            </button>
            <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
              Abiertas
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {conversations.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No hay conversaciones aún
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Las conversaciones aparecerán cuando recibas mensajes
              </p>
            </div>
          ) : (
            conversations.map((conversation) => {
              const lastMessage = conversation.messages[0]
              
              return (
                <div
                  key={conversation.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {conversation.client.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {conversation.client.name}
                        </h3>
                        {lastMessage && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {format(new Date(lastMessage.createdAt), 'HH:mm', { locale: es })}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {conversation.client.phone}
                      </p>
                      
                      {lastMessage && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {lastMessage.direction === 'INBOUND' ? '→ ' : '← '}
                          {lastMessage.content}
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        conversation.status === 'OPEN'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {conversation.status}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
