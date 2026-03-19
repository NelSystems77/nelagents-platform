import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Limpiar datos existentes (cuidado en producción)
  await prisma.usageRecord.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.message.deleteMany()
  await prisma.conversation.deleteMany()
  await prisma.appointment.deleteMany()
  await prisma.agentInstance.deleteMany()
  await prisma.client.deleteMany()
  await prisma.user.deleteMany()
  await prisma.tenant.deleteMany()

  // Crear tenant de demo
  const demoTenant = await prisma.tenant.create({
    data: {
      name: 'Demo Company',
      slug: 'demo',
      planType: 'PRO',
      status: 'ACTIVE',
      maxUsers: 10,
      maxClients: 5000,
      maxMonthlyMessages: 50000,
      whatsappNumber: '+50612345678',
    },
  })

  console.log('✅ Created demo tenant')

  // Crear usuario admin de demo
  const adminPassword = await hash('demo123', 12)
  const adminUser = await prisma.user.create({
    data: {
      tenantId: demoTenant.id,
      email: 'admin@demo.com',
      name: 'Admin Demo',
      passwordHash: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })

  console.log('✅ Created admin user (email: admin@demo.com, password: demo123)')

  // Crear usuarios staff
  const staffPassword = await hash('staff123', 12)
  const staffUser = await prisma.user.create({
    data: {
      tenantId: demoTenant.id,
      email: 'staff@demo.com',
      name: 'Staff Demo',
      passwordHash: staffPassword,
      role: 'STAFF',
      status: 'ACTIVE',
    },
  })

  console.log('✅ Created staff user (email: staff@demo.com, password: staff123)')

  // Crear clientes de prueba
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        tenantId: demoTenant.id,
        name: 'Juan Pérez',
        phone: '+50688887777',
        email: 'juan@example.com',
        whatsappId: '+50688887777',
        status: 'ACTIVE',
        source: 'whatsapp',
        tags: ['vip', 'frecuente'],
      },
    }),
    prisma.client.create({
      data: {
        tenantId: demoTenant.id,
        name: 'María García',
        phone: '+50699998888',
        email: 'maria@example.com',
        whatsappId: '+50699998888',
        status: 'PROSPECT',
        source: 'web',
        tags: ['nuevo'],
      },
    }),
    prisma.client.create({
      data: {
        tenantId: demoTenant.id,
        name: 'Carlos Rodríguez',
        phone: '+50677776666',
        status: 'LEAD',
        source: 'referido',
      },
    }),
  ])

  console.log(`✅ Created ${clients.length} demo clients`)

  // Crear conversaciones
  for (const client of clients.slice(0, 2)) {
    const conversation = await prisma.conversation.create({
      data: {
        tenantId: demoTenant.id,
        clientId: client.id,
        channel: 'WHATSAPP',
        channelId: client.phone,
        status: 'OPEN',
        lastMessageAt: new Date(),
      },
    })

    // Crear mensajes de prueba
    await prisma.message.createMany({
      data: [
        {
          tenantId: demoTenant.id,
          conversationId: conversation.id,
          clientId: client.id,
          direction: 'INBOUND',
          content: 'Hola, necesito información',
          contentType: 'TEXT',
          whatsappStatus: 'DELIVERED',
        },
        {
          tenantId: demoTenant.id,
          conversationId: conversation.id,
          clientId: client.id,
          direction: 'OUTBOUND',
          content: '¡Hola! Con gusto te ayudo. ¿En qué puedo asistirte?',
          contentType: 'TEXT',
          whatsappStatus: 'READ',
          sentById: staffUser.id,
        },
      ],
    })
  }

  console.log('✅ Created conversations and messages')

  // Crear citas
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)

  await prisma.appointment.createMany({
    data: [
      {
        tenantId: demoTenant.id,
        clientId: clients[0].id,
        assignedToId: staffUser.id,
        title: 'Consulta General',
        description: 'Primera consulta del cliente',
        scheduledAt: tomorrow,
        duration: 30,
        status: 'CONFIRMED',
        confirmed: true,
      },
      {
        tenantId: demoTenant.id,
        clientId: clients[1].id,
        assignedToId: staffUser.id,
        title: 'Seguimiento',
        description: 'Revisión de avances',
        scheduledAt: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
        duration: 45,
        status: 'SCHEDULED',
        confirmed: false,
      },
    ],
  })

  console.log('✅ Created appointments')

  // Crear agentes
  const agents = await Promise.all([
    prisma.agentInstance.create({
      data: {
        tenantId: demoTenant.id,
        agentType: 'CONVERSATION',
        name: 'Agente Conversacional',
        description: 'Responde automáticamente a mensajes de clientes',
        enabled: true,
        permissions: ['read_messages', 'send_messages'],
      },
    }),
    prisma.agentInstance.create({
      data: {
        tenantId: demoTenant.id,
        agentType: 'APPOINTMENT',
        name: 'Agente de Citas',
        description: 'Gestiona agendamiento de citas',
        enabled: true,
        permissions: ['read_appointments', 'create_appointments'],
      },
    }),
    prisma.agentInstance.create({
      data: {
        tenantId: demoTenant.id,
        agentType: 'REMINDER',
        name: 'Agente de Recordatorios',
        description: 'Envía recordatorios automáticos',
        enabled: true,
        permissions: ['read_appointments', 'send_messages'],
      },
    }),
  ])

  console.log(`✅ Created ${agents.length} agents`)

  // Crear suscripción
  await prisma.subscription.create({
    data: {
      tenantId: demoTenant.id,
      planType: 'PRO',
      status: 'ACTIVE',
      price: 49.99,
      currency: 'USD',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  })

  console.log('✅ Created subscription')

  // Crear registros de uso
  await prisma.usageRecord.createMany({
    data: [
      {
        tenantId: demoTenant.id,
        usageType: 'MESSAGE_SENT',
        quantity: 150,
        unitCost: 0.01,
        totalCost: 1.5,
      },
      {
        tenantId: demoTenant.id,
        usageType: 'MESSAGE_RECEIVED',
        quantity: 200,
        unitCost: 0.005,
        totalCost: 1.0,
      },
      {
        tenantId: demoTenant.id,
        usageType: 'AGENT_EXECUTION',
        quantity: 50,
        unitCost: 0.02,
        totalCost: 1.0,
      },
    ],
  })

  console.log('✅ Created usage records')

  console.log('\n🎉 Seeding completed!')
  console.log('\n📝 Demo Credentials:')
  console.log('   Admin: admin@demo.com / demo123')
  console.log('   Staff: staff@demo.com / staff123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
