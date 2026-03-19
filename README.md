# 🤖 NEL SYSTEMS - Plataforma SaaS de Agentes Inteligentes

> Plataforma multitenant moderna para automatización comercial mediante agentes de IA, con WhatsApp Business Platform, gestión de agenda, CRM y arquitectura event-driven escalable.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Arquitectura](#-arquitectura)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Desarrollo](#-desarrollo)
- [Deployment](#-deployment)
- [Documentación](#-documentación)
- [Licencia](#-licencia)

## ✨ Características

### 🎯 Core Features

- **Multitenancy Robusto**: Aislamiento completo por tenant con row-level security
- **WhatsApp Business Platform**: Integración nativa con Meta Business API
- **Gestión de Agenda**: Sistema completo de citas con confirmaciones y recordatorios automáticos
- **CRM Operativo**: Gestión de clientes, leads y seguimiento comercial
- **Agentes Inteligentes**: 
  - Agente conversacional (OpenAI/Anthropic)
  - Agente de citas
  - Agente de recordatorios
  - Agente de seguimiento comercial
  - Agente de reactivación
- **PWA**: Aplicación web progresiva instalable en móviles y desktop
- **Event-Driven Architecture**: Redis Streams para escalabilidad masiva
- **Analytics**: Dashboard con métricas operativas en tiempo real
- **Billing**: Sistema de suscripciones y medición por uso

### 🔐 Seguridad

- Autenticación con NextAuth.js
- JWT con refresh tokens
- Validación de webhooks con firma HMAC
- Sanitización de inputs
- Rate limiting
- Secretos en variables de entorno
- Row-level security en base de datos

### 📊 Escalabilidad

- Event mesh con Redis Streams
- Consumer groups para procesamiento paralelo
- Arquitectura preparada para millones de eventos
- Soporte para múltiples workers
- Optimizada para Vercel (edge functions)

## 🏗️ Arquitectura

### Stack Tecnológico

#### Frontend
- **Next.js 14+** (App Router)
- **TypeScript**
- **Tailwind CSS** + shadcn/ui
- **PWA** (Service Worker + Manifest)

#### Backend
- **Next.js API Routes**
- **NextAuth.js** (autenticación)
- **Prisma** (ORM)
- **PostgreSQL** (base de datos)
- **Upstash Redis** (event bus)

#### Agentes (Python)
- **FastAPI**
- **OpenAI SDK**
- **Redis Streams**
- **SQLAlchemy**

### Estructura del Monorepo

```
saas-agents-platform/
├── apps/
│   ├── web/                 # Next.js PWA
│   │   ├── app/            # App Router
│   │   ├── components/     # Componentes React
│   │   ├── lib/           # Utilidades
│   │   └── public/        # Assets estáticos
│   └── api/               # API adicional (opcional)
│
├── packages/
│   ├── db/                # Prisma + Database
│   │   ├── prisma/       # Schema y migrations
│   │   └── index.ts      # Cliente con multitenancy
│   ├── shared/           # Código compartido
│   │   ├── schemas/     # Zod schemas de eventos
│   │   └── utils/       # Event bus, helpers
│   └── ui/              # Componentes UI compartidos
│
├── services/
│   ├── agents/          # Workers Python
│   │   ├── agents/     # Agentes especializados
│   │   ├── workers/    # Event consumers
│   │   └── utils/      # Config, DB
│   └── webhooks/       # Servicio de webhooks (opcional)
│
└── scripts/            # Scripts de utilidad
```

### Flujo de Eventos

```
WhatsApp → Webhook → Event Bus → Orchestrator → Agentes
                                      ↓
                                 Analytics
                                      ↓
                                   Billing
```

## 🚀 Requisitos

- **Node.js** 18+ 
- **pnpm** 8+
- **Python** 3.11+
- **PostgreSQL** 14+
- **Redis** (Upstash recomendado para serverless)

### Servicios Externos

- **Vercel** (hosting frontend)
- **Upstash Redis** (event bus serverless)
- **Meta WhatsApp Business Platform** (mensajería)
- **OpenAI** o **Anthropic** (IA)

## 📦 Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-org/saas-agents-platform.git
cd saas-agents-platform
```

### 2. Instalar Dependencias

```bash
# Instalar dependencias de Node.js
pnpm install

# Instalar dependencias de Python (agentes)
cd services/agents
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configurar Base de Datos

```bash
# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales

# Generar cliente Prisma
pnpm db:generate

# Ejecutar migraciones
pnpm db:migrate
```

## ⚙️ Configuración

### Variables de Entorno

Edita el archivo `.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/saas_agents"

# Auth
NEXTAUTH_SECRET="generate-random-32-chars"
NEXTAUTH_URL="http://localhost:3000"

# Redis
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"

# WhatsApp
WHATSAPP_VERIFY_TOKEN="your-verify-token"
WHATSAPP_APP_SECRET="your-app-secret"
WHATSAPP_ACCESS_TOKEN="your-access-token"

# AI
OPENAI_API_KEY="sk-..."
```

### Configurar WhatsApp Business Platform

1. Crear app en [Meta for Developers](https://developers.facebook.com/)
2. Agregar producto "WhatsApp"
3. Configurar webhook:
   - URL: `https://tu-dominio.com/api/webhooks/whatsapp`
   - Verify Token: el definido en `WHATSAPP_VERIFY_TOKEN`
   - Suscribirse a: `messages`, `message_status`
4. Obtener token de acceso permanente
5. Verificar número de teléfono

### Upstash Redis

1. Crear cuenta en [Upstash](https://upstash.com/)
2. Crear base de datos Redis
3. Copiar credenciales REST a `.env`

## 🛠️ Desarrollo

### Iniciar Servicios

```bash
# Terminal 1 - Frontend (Next.js)
pnpm dev

# Terminal 2 - Agentes (Python)
cd services/agents
python main.py

# Terminal 3 - Prisma Studio (opcional)
pnpm db:studio
```

La aplicación estará disponible en:
- Frontend: http://localhost:3000
- Prisma Studio: http://localhost:5555

### Comandos Útiles

```bash
# Desarrollo
pnpm dev              # Iniciar todos los servicios
pnpm build            # Build de producción
pnpm lint             # Linter
pnpm type-check       # Type checking

# Base de datos
pnpm db:generate      # Generar cliente Prisma
pnpm db:migrate       # Ejecutar migraciones
pnpm db:studio        # Abrir Prisma Studio
pnpm db:seed          # Seed de datos de prueba

# Testing
pnpm test             # Ejecutar tests
pnpm test:watch       # Tests en modo watch
```

## 🚢 Deployment

### Vercel (Frontend)

1. Conectar repositorio en Vercel
2. Configurar variables de entorno en Vercel Dashboard
3. Deploy automático en cada push a `main`

```bash
# Deploy manual
pnpm vercel --prod
```

### Python Agents Worker

Opciones de deployment:

#### Railway.app
```bash
cd services/agents
railway up
```

#### Fly.io
```bash
cd services/agents
fly deploy
```

#### Docker
```bash
cd services/agents
docker build -t saas-agents-worker .
docker run -d --env-file .env saas-agents-worker
```

### Base de Datos

Opciones recomendadas:
- **Vercel Postgres**
- **Supabase**
- **Neon**
- **Railway PostgreSQL**

## 📚 Documentación

### Arquitectura de Eventos

El sistema usa Redis Streams para comunicación asíncrona entre componentes:

```typescript
// Publicar evento
await eventBus.publish(createEvent({
  eventType: 'message.received',
  tenantId: 'tenant_123',
  payload: {
    messageId: 'msg_456',
    content: 'Hola',
    clientId: 'client_789'
  }
}))
```

### Agentes

Crear un nuevo agente:

```python
from workers.event_consumer import EventConsumer

class MyAgent:
    def handle_event(self, event):
        # Tu lógica aquí
        pass

# Registrar
consumer = EventConsumer("my-group", "worker-1")
agent = MyAgent()
consumer.register_handler("my.event", agent.handle_event)
consumer.consume(["my.event"])
```

### API Routes

- `POST /api/auth/register` - Registro de tenant
- `POST /api/auth/login` - Login
- `POST /api/webhooks/whatsapp` - Webhook de WhatsApp
- `GET /api/webhooks/whatsapp` - Verificación de webhook

### Multitenancy

Usar el cliente con tenant context:

```typescript
import { createTenantClient } from '@saas-agents/db'

const db = createTenantClient(tenantId)
const clients = await db.client.findMany() // Automáticamente filtrado
```

## 🔒 Seguridad

- Todas las contraseñas se hashean con bcrypt (12 rounds)
- Webhooks validados con firma HMAC SHA-256
- JWT con rotación automática
- Secretos en variables de entorno (nunca en código)
- Row-level security en todas las queries
- Rate limiting en endpoints públicos
- Sanitización de inputs con Zod

## 📈 Roadmap

### Fase 1 (MVP) ✅
- [x] Multitenancy
- [x] Auth
- [x] WhatsApp webhook
- [x] Event bus
- [x] Agente conversacional
- [x] Dashboard PWA
- [x] CRM básico
- [x] Gestión de citas

### Fase 2 (En desarrollo)
- [ ] Campañas automatizadas
- [ ] Analytics avanzado
- [ ] Múltiples canales (Web Chat, Email)
- [ ] Templates de respuestas
- [ ] Agente de ventas avanzado

### Fase 3 (Futuro)
- [ ] Marketplace de agentes
- [ ] Verticalización por industria
- [ ] Multi-idioma
- [ ] Integraciones (Shopify, HubSpot, etc.)
- [ ] Mobile apps nativas

## 🤝 Contribución

Contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y propiedad de NEL SYSTEMS.

## 🆘 Soporte

- **Email**: soporte@nelsystems.com
- **Documentación**: [docs.nelsystems.com](https://docs.nelsystems.com)
- **Issues**: [GitHub Issues](https://github.com/tu-org/saas-agents-platform/issues)

---

**Desarrollado con ❤️ por NEL SYSTEMS**
