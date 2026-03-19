"""
Agente de Recordatorios - Envía recordatorios automáticos de citas
"""
import logging
from typing import Dict, Any
from datetime import datetime, timedelta
from sqlalchemy import text
from utils.config import settings, get_db

logger = logging.getLogger(__name__)


class ReminderAgent:
    """Agente que gestiona recordatorios automáticos"""
    
    def __init__(self):
        self.reminder_windows = {
            '24H_BEFORE': 24 * 60,  # 24 horas en minutos
            '2H_BEFORE': 2 * 60,    # 2 horas
            '30M_BEFORE': 30,        # 30 minutos
        }
        
    def handle_reminder_due(self, event: Dict[str, Any]):
        """
        Procesa evento de recordatorio pendiente
        
        Se activa cuando una cita está dentro de una ventana de recordatorio
        """
        try:
            payload = event['payload']
            tenant_id = event['tenantId']
            
            appointment_id = payload['appointmentId']
            client_id = payload['clientId']
            scheduled_at = payload['scheduledAt']
            reminder_type = payload['reminderType']
            
            logger.info(f"Processing reminder: {appointment_id} ({reminder_type})")
            
            # Obtener datos de la cita y cliente
            appointment_data = self.get_appointment_data(
                tenant_id,
                appointment_id,
                client_id
            )
            
            if not appointment_data:
                logger.warning(f"Appointment not found: {appointment_id}")
                return
                
            # Verificar si ya se envió recordatorio
            if appointment_data['reminder_sent']:
                logger.info(f"Reminder already sent for {appointment_id}")
                return
                
            # Generar mensaje de recordatorio
            message = self.generate_reminder_message(
                appointment_data,
                reminder_type
            )
            
            # Enviar mensaje
            self.send_reminder(
                tenant_id=tenant_id,
                client_id=client_id,
                appointment_id=appointment_id,
                message=message
            )
            
            # Marcar recordatorio como enviado
            self.mark_reminder_sent(appointment_id)
            
            logger.info(f"Reminder sent successfully: {appointment_id}")
            
        except Exception as e:
            logger.error(f"Error handling reminder: {e}")
            
    def get_appointment_data(
        self,
        tenant_id: str,
        appointment_id: str,
        client_id: str
    ) -> Dict[str, Any] | None:
        """Obtiene datos de la cita y cliente"""
        
        with get_db() as db:
            query = text("""
                SELECT 
                    a.id,
                    a.title,
                    a.description,
                    a."scheduledAt",
                    a.duration,
                    a.status,
                    a."reminderSent",
                    c.name as client_name,
                    c.phone as client_phone,
                    u.name as assigned_to_name
                FROM "Appointment" a
                JOIN "Client" c ON a."clientId" = c.id
                LEFT JOIN "User" u ON a."assignedToId" = u.id
                WHERE a.id = :appointment_id
                AND a."tenantId" = :tenant_id
            """)
            
            result = db.execute(
                query,
                {
                    "appointment_id": appointment_id,
                    "tenant_id": tenant_id
                }
            )
            
            row = result.fetchone()
            
            if not row:
                return None
                
            return {
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "scheduled_at": row[3],
                "duration": row[4],
                "status": row[5],
                "reminder_sent": row[6],
                "client_name": row[7],
                "client_phone": row[8],
                "assigned_to": row[9] or "Nuestro equipo",
            }
            
    def generate_reminder_message(
        self,
        appointment: Dict[str, Any],
        reminder_type: str
    ) -> str:
        """Genera mensaje personalizado de recordatorio"""
        
        scheduled_at = appointment['scheduled_at']
        
        if isinstance(scheduled_at, str):
            scheduled_at = datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
            
        # Formatear fecha y hora
        date_str = scheduled_at.strftime("%d/%m/%Y")
        time_str = scheduled_at.strftime("%H:%M")
        
        # Mensaje según tipo de recordatorio
        if reminder_type == '24H_BEFORE':
            time_msg = "mañana"
        elif reminder_type == '2H_BEFORE':
            time_msg = "en 2 horas"
        elif reminder_type == '30M_BEFORE':
            time_msg = "en 30 minutos"
        else:
            time_msg = "próximamente"
            
        message = f"""
Hola {appointment['client_name']}! 👋

Te recordamos tu cita {time_msg}:

📅 *{appointment['title']}*
🕐 {date_str} a las {time_str}
⏱️ Duración: {appointment['duration']} minutos
👤 Con: {appointment['assigned_to']}

{f"📝 {appointment['description']}" if appointment['description'] else ""}

Por favor confirma tu asistencia respondiendo SÍ o NO.

¡Te esperamos! 😊
        """.strip()
        
        return message
        
    def send_reminder(
        self,
        tenant_id: str,
        client_id: str,
        appointment_id: str,
        message: str
    ):
        """Envía mensaje de recordatorio al cliente"""
        
        # Aquí se publicaría evento message.outbound.requested
        # Por ahora solo log
        logger.info(f"Sending reminder to client {client_id}")
        logger.debug(f"Message: {message}")
        
        # En producción, publicar evento:
        # await eventBus.publish(createEvent({
        #     eventType: 'message.outbound.requested',
        #     tenantId: tenant_id,
        #     payload: {
        #         clientId: client_id,
        #         content: message,
        #         contentType: 'TEXT',
        #         metadata: {
        #             appointmentId: appointment_id,
        #             type: 'reminder'
        #         }
        #     }
        # }))
        
    def mark_reminder_sent(self, appointment_id: str):
        """Marca recordatorio como enviado"""
        
        with get_db() as db:
            query = text("""
                UPDATE "Appointment"
                SET "reminderSent" = true,
                    "reminderSentAt" = NOW()
                WHERE id = :appointment_id
            """)
            
            db.execute(query, {"appointment_id": appointment_id})
            
    def scan_upcoming_appointments(self, tenant_id: str):
        """
        Escanea citas próximas y genera eventos de recordatorio
        
        Esta función debe ejecutarse periódicamente (ej: cada 5 minutos)
        """
        
        logger.info("Scanning upcoming appointments...")
        
        with get_db() as db:
            # Buscar citas en las próximas 24 horas que no tengan recordatorio
            query = text("""
                SELECT 
                    a.id,
                    a."clientId",
                    a."tenantId",
                    a."scheduledAt"
                FROM "Appointment" a
                WHERE a."tenantId" = :tenant_id
                AND a."reminderSent" = false
                AND a.status IN ('SCHEDULED', 'CONFIRMED')
                AND a."scheduledAt" BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
            """)
            
            result = db.execute(query, {"tenant_id": tenant_id})
            appointments = result.fetchall()
            
            for apt in appointments:
                apt_id, client_id, tenant_id, scheduled_at = apt
                
                # Calcular tiempo hasta la cita
                now = datetime.now(scheduled_at.tzinfo)
                time_until = scheduled_at - now
                minutes_until = time_until.total_seconds() / 60
                
                # Determinar tipo de recordatorio apropiado
                reminder_type = None
                
                if 1380 <= minutes_until <= 1440:  # 23-24 horas
                    reminder_type = '24H_BEFORE'
                elif 110 <= minutes_until <= 130:   # ~2 horas
                    reminder_type = '2H_BEFORE'
                elif 25 <= minutes_until <= 35:      # ~30 minutos
                    reminder_type = '30M_BEFORE'
                    
                if reminder_type:
                    logger.info(f"Creating reminder event: {apt_id} ({reminder_type})")
                    # Publicar evento
                    # await eventBus.publish(createEvent({
                    #     eventType: 'appointment.reminder.due',
                    #     tenantId: tenant_id,
                    #     payload: {
                    #         appointmentId: apt_id,
                    #         clientId: client_id,
                    #         scheduledAt: scheduled_at.isoformat(),
                    #         reminderType: reminder_type
                    #     }
                    # }))
