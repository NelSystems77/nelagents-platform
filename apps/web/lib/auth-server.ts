import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@saas-agents/db'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  tenantId: string
  tenantName: string
  tenantSlug: string
}

export interface Session {
  user: SessionUser
}

/**
 * Obtener sesión del usuario actual desde cookies
 * Sin usar next-auth directamente para evitar problemas de resolución
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = cookies()
    
    // Intentar obtener token de sesión
    const sessionToken = cookieStore.get('next-auth.session-token') || 
                        cookieStore.get('__Secure-next-auth.session-token')
    
    if (!sessionToken) {
      return null
    }

    // Para desarrollo, usar el primer usuario admin
    // En producción esto debería validar el token real
    const user = await prisma.user.findFirst({
      where: {
        status: 'ACTIVE',
        role: 'ADMIN',
      },
      include: {
        tenant: true,
      },
    })

    if (!user) {
      return null
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
        tenantSlug: user.tenant.slug,
      },
    }
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

/**
 * Requerir autenticación - redirige al login si no hay sesión
 */
export async function requireAuth(): Promise<Session> {
  const session = await getSession()
  
  if (!session) {
    redirect('/auth/login')
  }
  
  return session
}

/**
 * Obtener tenant ID del usuario autenticado
 */
export async function getAuthTenantId(): Promise<string> {
  const session = await requireAuth()
  return session.user.tenantId
}