import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@saas-agents/db'
import { eventBus, createEvent, messageReceivedEventSchema } from '@saas-agents/shared'

/**
 * Webhook de WhatsApp Business Platform
 * 
 * Procesa mensajes entrantes, notificaciones de estado y eventos del canal.
 * Debe responder en < 20 segundos o Meta reintentará.
 */

// GET - Verificación de webhook
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

// DEBUG - Agregar estas líneas
  console.log('🔍 Webhook verification:', {
    mode,
    receivedToken: token,
    expectedToken: process.env.WHATSAPP_VERIFY_TOKEN,
    match: token === process.env.WHATSAPP_VERIFY_TOKEN
  })
  
  // Verificar token
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }
  
  return new NextResponse('Forbidden', { status: 403 })
}

// POST - Procesar eventos
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256')
    
    // Validar firma (CRÍTICO para seguridad)
    if (!verifySignature(body, signature)) {
      console.error('Invalid signature')
      return new NextResponse('Unauthorized', { status: 401 })
    }
    
    const data = JSON.parse(body)
    
    // Responder rápido a Meta (acknowledge receipt)
    // El procesamiento real ocurre asíncronamente
    setImmediate(() => processWhatsAppEvent(data))
    
    return new NextResponse('EVENT_RECEIVED', { status: 200 })
    
  } catch (error) {
    console.error('Webhook error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

/**
 * Verifica la firma del webhook de Meta
 */
function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature) return false
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WHATSAPP_APP_SECRET!)
    .update(payload)
    .digest('hex')
  
  const signatureHash = signature.split('sha256=')[1]
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signatureHash)
  )
}

/**
 * Procesa eventos de WhatsApp de forma asíncrona
 */
async function processWhatsAppEvent(data: any) {
  try {
    // Meta envía un array de entries
    for (const entry of data.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'messages') {
          await processMessages(change.value)
        }
        
        if (change.field === 'message_status') {
          await processMessageStatus(change.value)
        }
      }
    }
  } catch (error) {
    console.error('Error processing WhatsApp event:', error)
    // En producción, enviar a dead letter queue
  }
}

/**
 * Procesa mensajes entrantes
 */
async function processMessages(value: any) {
  const { messages, contacts, metadata } = value
  
  if (!messages || messages.length === 0) return
  
  // Identificar tenant por número de WhatsApp
  const phoneNumberId = metadata.phone_number_id
  const tenant = await prisma.tenant.findFirst({
    where: {
      whatsappNumber: metadata.display_phone_number,
      status: 'ACTIVE',
    },
  })
  
  if (!tenant) {
    console.error('Tenant not found for phone:', metadata.display_phone_number)
    return
  }
  
  for (const message of messages) {
    try {
      // Ignorar mensajes propios
      if (message.from === metadata.display_phone_number) continue
      
      // Obtener o crear cliente
      const contact = contacts?.find((c: any) => c.wa_id === message.from)
      let client = await prisma.client.findUnique({
        where: {
          tenantId_phone: {
            tenantId: tenant.id,
            phone: message.from,
          },
        },
      })
      
      if (!client) {
        client = await prisma.client.create({
          data: {
            tenantId: tenant.id,
            phone: message.from,
            name: contact?.profile?.name || `Cliente ${message.from}`,
            whatsappId: message.from,
            source: 'whatsapp',
            status: 'LEAD',
          },
        })
        
        // Evento de nuevo lead
        await eventBus.publish(createEvent({
          eventType: 'lead.created',
          tenantId: tenant.id,
          payload: {
            clientId: client.id,
            name: client.name,
            phone: client.phone,
            source: 'whatsapp',
          },
        }))
      }
      
      // Obtener o crear conversación
      let conversation = await prisma.conversation.findUnique({
        where: {
          tenantId_channelId: {
            tenantId: tenant.id,
            channelId: message.from,
          },
        },
      })
      
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            tenantId: tenant.id,
            clientId: client.id,
            channel: 'WHATSAPP',
            channelId: message.from,
            status: 'OPEN',
          },
        })
      }
      
      // Extraer contenido según tipo
      let content = ''
      let contentType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'LOCATION' = 'TEXT'
      
      if (message.type === 'text') {
        content = message.text.body
        contentType = 'TEXT'
      } else if (message.type === 'image') {
        content = message.image.id
        contentType = 'IMAGE'
      } else if (message.type === 'video') {
        content = message.video.id
        contentType = 'VIDEO'
      } else if (message.type === 'document') {
        content = message.document.id
        contentType = 'DOCUMENT'
      } else if (message.type === 'audio') {
        content = message.audio.id
        contentType = 'AUDIO'
      } else if (message.type === 'location') {
        content = JSON.stringify(message.location)
        contentType = 'LOCATION'
      }
      
      // Guardar mensaje
      const savedMessage = await prisma.message.create({
        data: {
          tenantId: tenant.id,
          conversationId: conversation.id,
          clientId: client.id,
          direction: 'INBOUND',
          content,
          contentType,
          whatsappId: message.id,
          whatsappStatus: 'DELIVERED',
        },
      })
      
      // Actualizar conversación
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      })
      
      // Registrar uso
      await prisma.usageRecord.create({
        data: {
          tenantId: tenant.id,
          usageType: 'MESSAGE_RECEIVED',
          quantity: 1,
        },
      })
      
      // PUBLICAR EVENTO AL BUS
      const event = createEvent({
        eventType: 'message.received' as const,
        tenantId: tenant.id,
        payload: {
          messageId: savedMessage.id,
          conversationId: conversation.id,
          clientId: client.id,
          content,
          contentType,
          channel: 'WHATSAPP' as const,
          whatsappId: message.id,
          clientPhone: message.from,
          clientName: client.name,
        },
      })
      
      await eventBus.publish(event)
      
      console.log('Message processed and published:', {
        messageId: savedMessage.id,
        tenantId: tenant.id,
      })
      
    } catch (error) {
      console.error('Error processing individual message:', error)
      // Continuar con siguiente mensaje
    }
  }
}

/**
 * Procesa actualizaciones de estado de mensajes
 */
async function processMessageStatus(value: any) {
  const { statuses } = value
  
  if (!statuses || statuses.length === 0) return
  
  for (const status of statuses) {
    try {
      const message = await prisma.message.findUnique({
        where: { whatsappId: status.id },
      })
      
      if (!message) continue
      
      // Mapear estado de WhatsApp a nuestro enum
      let whatsappStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' = 'SENT'
      
      if (status.status === 'delivered') {
        whatsappStatus = 'DELIVERED'
      } else if (status.status === 'read') {
        whatsappStatus = 'READ'
      } else if (status.status === 'failed') {
        whatsappStatus = 'FAILED'
      }
      
      // Actualizar mensaje
      await prisma.message.update({
        where: { id: message.id },
        data: { whatsappStatus },
      })
      
      // Publicar evento de actualización
      await eventBus.publish(createEvent({
        eventType: 'message.delivery.updated',
        tenantId: message.tenantId,
        payload: {
          messageId: message.id,
          whatsappId: status.id,
          status: whatsappStatus,
          updatedAt: new Date().toISOString(),
        },
      }))
      
    } catch (error) {
      console.error('Error processing message status:', error)
    }
  }
}
