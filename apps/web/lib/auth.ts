import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@saas-agents/db'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
  },
  
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Credenciales inválidas')
        }

        // Buscar usuario por email (puede haber múltiples con mismo email en diferentes tenants)
        const users = await prisma.user.findMany({
          where: {
            email: credentials.email,
            status: 'ACTIVE',
          },
          include: {
            tenant: true,
          },
        })

        if (users.length === 0) {
          throw new Error('Usuario no encontrado')
        }

        // Si hay múltiples usuarios, tomar el primero activo
        // En producción, esto debería manejar selección de tenant
        const user = users[0]

        // Verificar tenant activo
        if (user.tenant.status !== 'ACTIVE') {
          throw new Error('Cuenta suspendida')
        }

        // Verificar contraseña
        const passwordMatch = await compare(
          credentials.password,
          user.passwordHash
        )

        if (!passwordMatch) {
          throw new Error('Contraseña incorrecta')
        }

        // Actualizar último login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          tenantSlug: user.tenant.slug,
        }
      },
    }),
  ],
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.tenantId = user.tenantId
        token.tenantName = user.tenantName
        token.tenantSlug = user.tenantSlug
      }
      return token
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.tenantId = token.tenantId as string
        session.user.tenantName = token.tenantName as string
        session.user.tenantSlug = token.tenantSlug as string
      }
      return session
    },
  },
  
  secret: process.env.NEXTAUTH_SECRET,
}
