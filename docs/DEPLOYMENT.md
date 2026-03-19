# 🚀 Guía de Deployment - Vercel

Esta guía te ayudará a desplegar la plataforma en producción usando Vercel.

## 📋 Pre-requisitos

1. **Cuenta en Vercel**: [vercel.com](https://vercel.com)
2. **Base de datos PostgreSQL**: 
   - Vercel Postgres
   - Supabase
   - Neon
   - Railway
3. **Redis (Upstash)**: [upstash.com](https://upstash.com)
4. **WhatsApp Business Platform**: Configurado en Meta for Developers
5. **OpenAI API Key**: Para los agentes IA

## 🔧 Paso 1: Preparar Base de Datos

### Opción A: Vercel Postgres

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Link proyecto
vercel link

# Crear base de datos
vercel postgres create

# Obtener DATABASE_URL
vercel env pull .env.local
```

### Opción B: Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Copiar connection string
3. Agregar a variables de entorno

## 🔧 Paso 2: Configurar Upstash Redis

1. Crear cuenta en [upstash.com](https://upstash.com)
2. Crear base de datos Redis
3. Copiar credenciales REST:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## 🔧 Paso 3: Configurar Variables de Entorno en Vercel

Ve a tu proyecto en Vercel → Settings → Environment Variables y agrega:

### Base de Datos
```
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### Auth
```
NEXTAUTH_SECRET=<genera-un-secret-aleatorio-32-chars>
NEXTAUTH_URL=https://tu-dominio.vercel.app
```

### Redis
```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

### WhatsApp
```
WHATSAPP_VERIFY_TOKEN=tu-token-de-verificacion
WHATSAPP_APP_SECRET=tu-app-secret-de-meta
WHATSAPP_ACCESS_TOKEN=tu-token-de-acceso
```

### AI
```
OPENAI_API_KEY=sk-xxx
```

### Public
```
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
```

## 🔧 Paso 4: Deploy desde GitHub

### 1. Conectar Repositorio

1. Push tu código a GitHub
2. En Vercel, click "New Project"
3. Import tu repositorio
4. Vercel detectará Next.js automáticamente

### 2. Configuración del Proyecto

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm run build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install"
}
```

### 3. Root Directory

⚠️ **IMPORTANTE**: No cambies el Root Directory. El proyecto usa un monorepo.

## 🔧 Paso 5: Ejecutar Migraciones

```bash
# En tu máquina local con DATABASE_URL de producción
pnpm db:migrate

# O usar Vercel CLI
vercel env pull
pnpm db:migrate
```

## 🔧 Paso 6: Configurar Webhook de WhatsApp

1. Ve a Meta for Developers
2. Tu app → WhatsApp → Configuration
3. Webhook URL: `https://tu-dominio.vercel.app/api/webhooks/whatsapp`
4. Verify Token: El que configuraste en `WHATSAPP_VERIFY_TOKEN`
5. Subscribe to: `messages`, `message_status`

## 🔧 Paso 7: Deploy Python Agents Worker

Los agentes Python NO pueden ejecutarse en Vercel (serverless functions tienen límite de tiempo).

### Opciones de Deploy:

#### A. Railway.app (Recomendado)

```bash
cd services/agents

# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway up
```

#### B. Fly.io

```bash
cd services/agents

# Instalar flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

#### C. Render.com

1. Crear cuenta en render.com
2. New → Background Worker
3. Conectar repo
4. Build: `pip install -r requirements.txt`
5. Start: `python main.py`
6. Agregar variables de entorno

## 🔧 Paso 8: Verificación

### 1. Frontend
Visita `https://tu-dominio.vercel.app`

### 2. Webhook
Envía un mensaje de prueba a tu número de WhatsApp

### 3. Agents
Verifica logs en Railway/Fly.io para confirmar que procesan eventos

## 🔍 Troubleshooting

### Error: Database connection failed
- Verifica que DATABASE_URL sea correcta
- Confirma que la DB permite conexiones externas
- Revisa IP whitelist si aplica

### Error: Webhook verification failed
- Verifica WHATSAPP_VERIFY_TOKEN coincida
- Revisa WHATSAPP_APP_SECRET sea correcta
- Confirma URL del webhook sea HTTPS

### Error: Agents no procesan eventos
- Verifica UPSTASH_REDIS credenciales
- Confirma que Python worker esté ejecutándose
- Revisa logs del worker

## 📊 Monitoring

### Vercel Analytics
```bash
vercel analytics
```

### Logs
```bash
# Real-time logs
vercel logs

# Específico
vercel logs --follow
```

## 🔐 Seguridad

1. ✅ Usa secretos fuertes (min 32 caracteres)
2. ✅ Habilita CORS solo para tu dominio
3. ✅ Configura rate limiting en Vercel
4. ✅ Habilita Vercel Firewall (Pro plan)
5. ✅ Monitorea logs de seguridad

## 🎯 Checklist Final

- [ ] Variables de entorno configuradas
- [ ] Migraciones ejecutadas
- [ ] Webhook de WhatsApp verificado
- [ ] Python workers desplegados
- [ ] Primer login exitoso
- [ ] Mensaje de prueba funciona
- [ ] Agentes procesan eventos
- [ ] Monitoring configurado

## 📚 Recursos

- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Migration](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Upstash Docs](https://docs.upstash.com/)

---

**¿Necesitas ayuda?** Consulta el README.md o contacta soporte.
