import { Redis } from '@upstash/redis'
import { randomUUID } from 'crypto'
import type { DomainEvent } from '../schemas/events'

// Cliente Redis (Upstash compatible con serverless)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

/**
 * Event Bus para arquitectura event-driven
 * Usa Redis Streams para publicación/subscripción durable
 */
export class EventBus {
  private readonly streamPrefix = 'events:'
  
  /**
   * Publica un evento al stream correspondiente
   */
  async publish(event: DomainEvent): Promise<void> {
    const streamName = this.getStreamName(event.eventType)
    
    try {
      // Publicar al stream de Redis
      await redis.xadd(streamName, '*', {
        event: JSON.stringify(event),
      })
      
      // También publicar al canal pub/sub para consumidores en tiempo real
      await redis.publish(streamName, JSON.stringify(event))
      
      console.log(`Event published: ${event.eventType}`, {
        eventId: event.id,
        tenantId: event.tenantId,
      })
    } catch (error) {
      console.error('Failed to publish event:', error)
      throw error
    }
  }
  
  /**
   * Publica múltiples eventos en batch
   */
  async publishBatch(events: DomainEvent[]): Promise<void> {
    const pipeline = redis.pipeline()
    
    for (const event of events) {
      const streamName = this.getStreamName(event.eventType)
      pipeline.xadd(streamName, '*', {
        event: JSON.stringify(event),
      })
    }
    
    await pipeline.exec()
  }
  
  /**
   * Lee eventos de un stream (para procesadores)
   * Usa consumer groups para garantizar procesamiento único
   */
  async consume(
    eventType: string,
    consumerGroup: string,
    consumerName: string,
    count: number = 10
  ): Promise<DomainEvent[]> {
    const streamName = this.getStreamName(eventType)
    
    try {
      // Crear consumer group si no existe
      try {
        await (redis as any).xgroup('CREATE', streamName, consumerGroup, '0', 'MKSTREAM')
      } catch (error) {
        // Group ya existe, continuar
      }
      
      // Leer eventos pendientes
      const results = await (redis as any).xreadgroup(
  'GROUP',
  consumerGroup,
  consumerName,
  'COUNT',
  count,
  'BLOCK',
  0,
  'STREAMS',
  streamName,
  '>'
)
      
      if (!results || results.length === 0) {
        return []
      }
      
      const events: DomainEvent[] = []
      
      for (const [, messages] of results) {
        for (const [id, fields] of messages) {
          const eventData = fields.event as string
          const event = JSON.parse(eventData) as DomainEvent
          events.push(event)
        }
      }
      
      return events
    } catch (error) {
      console.error('Failed to consume events:', error)
      return []
    }
  }
  
  /**
   * Confirma que un evento fue procesado exitosamente
   */
  async acknowledge(
    eventType: string,
    consumerGroup: string,
    eventId: string
  ): Promise<void> {
    const streamName = this.getStreamName(eventType)
    await redis.xack(streamName, consumerGroup, eventId)
  }
  
  /**
   * Obtiene nombre del stream basado en el tipo de evento
   */
  private getStreamName(eventType: string): string {
    // Agrupar por dominio para mejor escalabilidad
    const domain = eventType.split('.')[0] // message, appointment, agent, etc.
    return `${this.streamPrefix}${domain}`
  }
  
  /**
   * Guarda evento en base de datos para auditoría
   * (llamar después de publicar al bus)
   */
  async persistEvent(event: DomainEvent, prisma: any): Promise<void> {
    await prisma.event.create({
      data: {
        eventType: event.eventType,
        tenantId: event.tenantId,
        payload: event.payload as any,
        correlationId: event.correlationId,
        causationId: event.causationId,
        status: 'PENDING',
      },
    })
  }
}

// Singleton instance
export const eventBus = new EventBus()

/**
 * Helper para crear eventos con id y timestamp automáticos
 */
export function createEvent<T extends DomainEvent>(
  data: Omit<T, 'id' | 'timestamp'>
): T {
  return {
    ...data,
    id: randomUUID(),
    timestamp: new Date(),
  } as T
}

/**
 * Helper para publicar evento y persistir en DB de forma atómica
 */
export async function publishAndPersist(
  event: DomainEvent,
  prisma: any
): Promise<void> {
  await Promise.all([
    eventBus.publish(event),
    eventBus.persistEvent(event, prisma),
  ])
}