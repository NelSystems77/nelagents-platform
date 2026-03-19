import { PrismaClient } from '@prisma/client'

// Tipo para extensión con tenant context
type TenantContext = {
  tenantId: string | null
}

// Cliente Prisma global singleton
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Cliente base
export const prismaBase = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaBase

/**
 * Cliente Prisma con Row-Level Security automático para multitenancy
 * 
 * USO:
 * const prisma = createTenantClient(tenantId)
 * const clients = await prisma.client.findMany() // Automáticamente filtrado por tenantId
 */
export function createTenantClient(tenantId: string) {
  return prismaBase.$extends({
    query: {
      // Aplicar filtro automático a todos los modelos que tengan tenantId
      $allModels: {
        async findMany({ model, operation, args, query }) {
          // Modelos que requieren tenant
          const tenantsModels = [
            'User', 'Client', 'Appointment', 'Conversation', 'Message',
            'AgentInstance', 'Campaign', 'Subscription', 'UsageRecord'
          ]
          
          if (tenantsModels.includes(model)) {
            args.where = { ...args.where, tenantId }
          }
          
          return query(args)
        },
        async findFirst({ model, operation, args, query }) {
          const tenantsModels = [
            'User', 'Client', 'Appointment', 'Conversation', 'Message',
            'AgentInstance', 'Campaign', 'Subscription', 'UsageRecord'
          ]
          
          if (tenantsModels.includes(model)) {
            args.where = { ...args.where, tenantId }
          }
          
          return query(args)
        },
        async create({ model, operation, args, query }) {
          const tenantsModels = [
            'User', 'Client', 'Appointment', 'Conversation', 'Message',
            'AgentInstance', 'Campaign', 'Subscription', 'UsageRecord'
          ]
          
          if (tenantsModels.includes(model)) {
            args.data = { ...args.data, tenantId }
          }
          
          return query(args)
        },
        async update({ model, operation, args, query }) {
          const tenantsModels = [
            'User', 'Client', 'Appointment', 'Conversation', 'Message',
            'AgentInstance', 'Campaign', 'Subscription', 'UsageRecord'
          ]
          
          if (tenantsModels.includes(model)) {
            args.where = { ...args.where, tenantId }
          }
          
          return query(args)
        },
        async delete({ model, operation, args, query }) {
          const tenantsModels = [
            'User', 'Client', 'Appointment', 'Conversation', 'Message',
            'AgentInstance', 'Campaign', 'Subscription', 'UsageRecord'
          ]
          
          if (tenantsModels.includes(model)) {
            args.where = { ...args.where, tenantId }
          }
          
          return query(args)
        },
      },
    },
  })
}

// Cliente sin tenant (para operaciones de superadmin)
export const prisma = prismaBase

// Exportar tipos
export * from '@prisma/client'
