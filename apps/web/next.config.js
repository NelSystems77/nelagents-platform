const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@saas-agents/db', '@saas-agents/shared'],
  
  // Configuración de Webpack para resolver next-auth
  webpack: (config, { isServer }) => {
    // Ruta absoluta a node_modules desde la raíz del monorepo
    const rootNodeModules = path.resolve(__dirname, '../../node_modules')
    
    // Agregar resolución explícita
    config.resolve.modules.push(rootNodeModules)
    
    // Asegurar que next-auth se resuelva desde node_modules raíz
    if (!config.resolve.alias) {
      config.resolve.alias = {}
    }
    
    config.resolve.alias['next-auth'] = path.join(rootNodeModules, 'next-auth')
    config.resolve.alias['next-auth/providers/credentials'] = path.join(rootNodeModules, 'next-auth/providers/credentials')
    config.resolve.alias['next-auth/react'] = path.join(rootNodeModules, 'next-auth/react')
    config.resolve.alias['next-auth/jwt'] = path.join(rootNodeModules, 'next-auth/jwt')
    
    return config
  },
  
  // PWA Configuration
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
      ],
    },
  ],
  
  // Experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
}

module.exports = nextConfig