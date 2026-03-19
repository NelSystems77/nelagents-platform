import { z } from 'zod'

// ==========================================
// BASE EVENT SCHEMA
// ==========================================

export const baseEventSchema = z.object({
  id: z.string().cuid(),
  eventType: z.string(),
  tenantId: z.string().optional(),
  timestamp: z.date().or(z.string()),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

export type BaseEvent = z.infer<typeof baseEventSchema>

// ==========================================
// CHANNEL EVENTS (WhatsApp, Web, etc.)
// ==========================================

export const messageReceivedEventSchema = baseEventSchema.extend({
  eventType: z.literal('message.received'),
  payload: z.object({
    messageId: z.string(),
    conversationId: z.string(),
    clientId: z.string(),
    content: z.string(),
    contentType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'LOCATION']),
    channel: z.enum(['WHATSAPP', 'WEB_CHAT', 'APP', 'EMAIL']),
    whatsappId: z.string().optional(),
    clientPhone: z.string(),
    clientName: z.string().optional(),
  }),
})

export const messageNormalizedEventSchema = baseEventSchema.extend({
  eventType: z.literal('message.normalized'),
  payload: z.object({
    messageId: z.string(),
    conversationId: z.string(),
    clientId: z.string(),
    normalizedContent: z.string(),
    detectedIntent: z.string().optional(),
    entities: z.record(z.any()).optional(),
  }),
})

export const messageOutboundRequestedEventSchema = baseEventSchema.extend({
  eventType: z.literal('message.outbound.requested'),
  payload: z.object({
    conversationId: z.string(),
    clientId: z.string(),
    content: z.string(),
    contentType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'LOCATION', 'TEMPLATE']),
    templateName: z.string().optional(),
    templateParams: z.record(z.any()).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  }),
})

export const messageSentEventSchema = baseEventSchema.extend({
  eventType: z.literal('message.sent'),
  payload: z.object({
    messageId: z.string(),
    whatsappId: z.string().optional(),
    sentAt: z.date().or(z.string()),
  }),
})

export const messageDeliveryUpdatedEventSchema = baseEventSchema.extend({
  eventType: z.literal('message.delivery.updated'),
  payload: z.object({
    messageId: z.string(),
    whatsappId: z.string(),
    status: z.enum(['SENT', 'DELIVERED', 'READ', 'FAILED']),
    updatedAt: z.date().or(z.string()),
  }),
})

// ==========================================
// APPOINTMENT EVENTS
// ==========================================

export const appointmentRequestedEventSchema = baseEventSchema.extend({
  eventType: z.literal('appointment.requested'),
  payload: z.object({
    clientId: z.string(),
    requestedDate: z.string().optional(),
    requestedTime: z.string().optional(),
    service: z.string().optional(),
    notes: z.string().optional(),
  }),
})

export const appointmentCreatedEventSchema = baseEventSchema.extend({
  eventType: z.literal('appointment.created'),
  payload: z.object({
    appointmentId: z.string(),
    clientId: z.string(),
    scheduledAt: z.date().or(z.string()),
    duration: z.number(),
    title: z.string(),
  }),
})

export const appointmentConfirmedEventSchema = baseEventSchema.extend({
  eventType: z.literal('appointment.confirmed'),
  payload: z.object({
    appointmentId: z.string(),
    confirmedAt: z.date().or(z.string()),
    confirmedBy: z.enum(['CLIENT', 'STAFF', 'SYSTEM']),
  }),
})

export const appointmentRescheduledEventSchema = baseEventSchema.extend({
  eventType: z.literal('appointment.rescheduled'),
  payload: z.object({
    appointmentId: z.string(),
    oldScheduledAt: z.date().or(z.string()),
    newScheduledAt: z.date().or(z.string()),
    rescheduledBy: z.string(),
  }),
})

export const appointmentCancelledEventSchema = baseEventSchema.extend({
  eventType: z.literal('appointment.cancelled'),
  payload: z.object({
    appointmentId: z.string(),
    reason: z.string().optional(),
    cancelledBy: z.string(),
  }),
})

export const appointmentReminderDueEventSchema = baseEventSchema.extend({
  eventType: z.literal('appointment.reminder.due'),
  payload: z.object({
    appointmentId: z.string(),
    clientId: z.string(),
    scheduledAt: z.date().or(z.string()),
    reminderType: z.enum(['24H_BEFORE', '2H_BEFORE', '30M_BEFORE']),
  }),
})

// ==========================================
// CLIENT EVENTS
// ==========================================

export const leadCreatedEventSchema = baseEventSchema.extend({
  eventType: z.literal('lead.created'),
  payload: z.object({
    clientId: z.string(),
    name: z.string(),
    phone: z.string(),
    source: z.string().optional(),
  }),
})

export const clientReactivatedEventSchema = baseEventSchema.extend({
  eventType: z.literal('client.reactivated'),
  payload: z.object({
    clientId: z.string(),
    inactiveDays: z.number(),
    reactivationReason: z.string().optional(),
  }),
})

// ==========================================
// AGENT EVENTS
// ==========================================

export const agentExecutionRequestedEventSchema = baseEventSchema.extend({
  eventType: z.literal('agent.execution.requested'),
  payload: z.object({
    agentType: z.enum([
      'APPOINTMENT',
      'REMINDER',
      'CONVERSATION',
      'SALES_FOLLOWUP',
      'CAMPAIGN',
      'ANALYTICS',
      'REACTIVATION'
    ]),
    input: z.record(z.any()),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  }),
})

export const agentExecutionStartedEventSchema = baseEventSchema.extend({
  eventType: z.literal('agent.execution.started'),
  payload: z.object({
    executionId: z.string(),
    agentId: z.string(),
    agentType: z.string(),
    startedAt: z.date().or(z.string()),
  }),
})

export const agentExecutionCompletedEventSchema = baseEventSchema.extend({
  eventType: z.literal('agent.execution.completed'),
  payload: z.object({
    executionId: z.string(),
    output: z.record(z.any()),
    completedAt: z.date().or(z.string()),
    duration: z.number(),
  }),
})

export const agentExecutionFailedEventSchema = baseEventSchema.extend({
  eventType: z.literal('agent.execution.failed'),
  payload: z.object({
    executionId: z.string(),
    error: z.string(),
    failedAt: z.date().or(z.string()),
    retriable: z.boolean(),
  }),
})

// ==========================================
// BILLING EVENTS
// ==========================================

export const usageRecordedEventSchema = baseEventSchema.extend({
  eventType: z.literal('usage.recorded'),
  payload: z.object({
    usageType: z.enum([
      'MESSAGE_SENT',
      'MESSAGE_RECEIVED',
      'TEMPLATE_SENT',
      'AGENT_EXECUTION',
      'CAMPAIGN_SENT',
      'STORAGE'
    ]),
    quantity: z.number(),
    unitCost: z.number().optional(),
  }),
})

export const limitExceededEventSchema = baseEventSchema.extend({
  eventType: z.literal('limit.exceeded'),
  payload: z.object({
    limitType: z.enum(['MESSAGES', 'CLIENTS', 'USERS', 'STORAGE']),
    currentValue: z.number(),
    limitValue: z.number(),
  }),
})

// ==========================================
// CAMPAIGN EVENTS
// ==========================================

export const campaignScheduledEventSchema = baseEventSchema.extend({
  eventType: z.literal('campaign.scheduled'),
  payload: z.object({
    campaignId: z.string(),
    scheduledAt: z.date().or(z.string()),
    targetCount: z.number(),
  }),
})

// ==========================================
// UNION TYPE FOR ALL EVENTS
// ==========================================

export type DomainEvent = 
  | z.infer<typeof messageReceivedEventSchema>
  | z.infer<typeof messageNormalizedEventSchema>
  | z.infer<typeof messageOutboundRequestedEventSchema>
  | z.infer<typeof messageSentEventSchema>
  | z.infer<typeof messageDeliveryUpdatedEventSchema>
  | z.infer<typeof appointmentRequestedEventSchema>
  | z.infer<typeof appointmentCreatedEventSchema>
  | z.infer<typeof appointmentConfirmedEventSchema>
  | z.infer<typeof appointmentRescheduledEventSchema>
  | z.infer<typeof appointmentCancelledEventSchema>
  | z.infer<typeof appointmentReminderDueEventSchema>
  | z.infer<typeof leadCreatedEventSchema>
  | z.infer<typeof clientReactivatedEventSchema>
  | z.infer<typeof agentExecutionRequestedEventSchema>
  | z.infer<typeof agentExecutionStartedEventSchema>
  | z.infer<typeof agentExecutionCompletedEventSchema>
  | z.infer<typeof agentExecutionFailedEventSchema>
  | z.infer<typeof usageRecordedEventSchema>
  | z.infer<typeof limitExceededEventSchema>
  | z.infer<typeof campaignScheduledEventSchema>

// Helper para crear eventos con ID y timestamp automáticos
export function createEvent<T extends DomainEvent>(
  event: Omit<T, 'id' | 'timestamp'>
): T {
  return {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  } as T
}
