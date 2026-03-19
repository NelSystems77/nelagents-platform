import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  
  if (session) {
    redirect('/dashboard')
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-8">
            <img 
              src="/android-chrome-192x192.png" 
              alt="NEL SYSTEMS" 
              className="mx-auto h-32 w-32"
            />
          </div>
          
          {/* Hero */}
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Plataforma de Agentes Inteligentes
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
            Automatiza tu operación comercial con agentes de IA. 
            Gestiona conversaciones, agenda citas y escala tu negocio.
          </p>
          
          {/* CTA */}
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/login"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
            >
              Iniciar Sesión
            </Link>
            
            <Link
              href="/auth/register"
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-lg border-2 border-blue-600"
            >
              Crear Cuenta
            </Link>
          </div>
          
          {/* Features */}
          <div className="mt-20 grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-semibold mb-2">WhatsApp Business</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Automatiza conversaciones y atención al cliente 24/7
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-xl font-semibold mb-2">Gestión de Agenda</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Agenda, confirma y gestiona citas automáticamente
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold mb-2">Agentes IA</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Agentes especializados para cada tarea de tu negocio
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
