import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@saas-agents/db'
import { z } from 'zod'

const registerSchema = z.object({
  companyName: z.string().min(2).max(100),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validar datos
    const validatedData = registerSchema.parse(body)
    
    // Verificar si el email ya existe
    const existingUser = await prisma.user.findFirst({
      where: { email: validatedData.email },
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'El email ya está registrado' },
        { status: 400 }
      )
    }
    
    // Generar slug único para el tenant
    const baseSlug = validatedData.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    
    let slug = baseSlug
    let counter = 1
    
    while (await prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }
    
    // Hash de contraseña
    const passwordHash = await hash(validatedData.password, 12)
    
    // Crear tenant y usuario en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear tenant
      const tenant = await tx.tenant.create({
        data: {
          name: validatedData.companyName,
          slug,
          planType: 'TRIAL',
          status: 'ACTIVE',
          maxUsers: 5,
          maxClients: 1000,
          maxMonthlyMessages: 5000,
        },
      })
      
      // Crear usuario admin
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: validatedData.email,
          name: validatedData.name,
          passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      })
      
      // Crear agentes por defecto
      const defaultAgents = [
        { agentType: 'CONVERSATION', name: 'Agente Conversacional', description: 'Responde mensajes automáticamente' },
        { agentType: 'APPOINTMENT', name: 'Agente de Citas', description: 'Gestiona agendamiento de citas' },
        { agentType: 'REMINDER', name: 'Agente de Recordatorios', description: 'Envía recordatorios automáticos' },
      ]
      
      for (const agent of defaultAgents) {
        await tx.agentInstance.create({
          data: {
            tenantId: tenant.id,
            agentType: agent.agentType as any,
            name: agent.name,
            description: agent.description,
            enabled: true,
            permissions: [],
          },
        })
      }
      
      // Crear suscripción trial
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planType: 'TRIAL',
          status: 'ACTIVE',
          price: 0,
          currency: 'USD',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        },
      })
      
      return { tenant, user }
    })
    
    return NextResponse.json({
      success: true,
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
    })
    
  } catch (error) {
    console.error('Registration error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Error al crear la cuenta' },
      { status: 500 }
    )
  }
}
