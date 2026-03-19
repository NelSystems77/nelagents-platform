"""
Reminder Worker - Procesa y envía recordatorios pendientes
"""
import logging
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy import text
from utils.config import get_db
from utils.whatsapp_sender import whatsapp_sender

logger = logging.getLogger(__name__)


class ReminderWorker:
    """Worker que procesa recordatorios pendientes cada minuto"""
    
    def __init__(self, check_interval: int = 60):
        """
        Args:
            check_interval: Intervalo en segundos entre verificaciones (default: 60s = 1 min)
        """
        self.check_interval = check_interval
        self.running = False
        
    def start(self):
        """Inicia el worker en loop infinito"""
        self.running = True
        logger.info(f"Reminder worker started. Checking every {self.check_interval}s")
        
        while self.running:
            try:
                self.process_pending_reminders()
                time.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in reminder worker loop: {e}")
                time.sleep(self.check_interval)
    
    def stop(self):
        """Detiene el worker"""
        self.running = False
        logger.info("Reminder worker stopped")
    
    def process_pending_reminders(self):
        """Busca y procesa recordatorios que deben enviarse ahora"""
        
        try:
            with get_db() as db:
                # Buscar recordatorios pendientes cuya hora ya llegó
                query = text("""
                    SELECT 
                        r.id,
                        r."tenantId",
                        r."clientId",
                        r.title,
                        r.description,
                        r."remindAt",
                        r.recurrence,
                        c.phone,
                        c.name as client_name
                    FROM "Reminder" r
                    JOIN "Client" c ON c.id = r."clientId"
                    WHERE r.status = 'PENDING'
                    AND r."remindAt" <= NOW()
                    ORDER BY r."remindAt" ASC
                    LIMIT 50
                """)
                
                result = db.execute(query)
                reminders = result.fetchall()
                
                if not reminders:
                    logger.debug("No pending reminders found")
                    return
                
                logger.info(f"Found {len(reminders)} pending reminders")
                
                for reminder in reminders:
                    self.send_reminder(
                        reminder_id=reminder[0],
                        tenant_id=reminder[1],
                        client_id=reminder[2],
                        title=reminder[3],
                        description=reminder[4],
                        remind_at=reminder[5],
                        recurrence=reminder[6],
                        client_phone=reminder[7],
                        client_name=reminder[8]
                    )
                    
        except Exception as e:
            logger.error(f"Error processing reminders: {e}")
    
    def send_reminder(
        self,
        reminder_id: str,
        tenant_id: str,
        client_id: str,
        title: str,
        description: str,
        remind_at: datetime,
        recurrence: str,
        client_phone: str,
        client_name: str
    ):
        """Envía un recordatorio por WhatsApp"""
        
        try:
            # Construir mensaje
            message = f"🔔 *Recordatorio*\n\n"
            message += f"*{title}*\n"
            if description:
                message += f"{description}\n"
            message += f"\n📅 {remind_at.strftime('%d/%m/%Y %H:%M')}"
            
            # Enviar por WhatsApp
            success = whatsapp_sender.send_message(
                to_phone=client_phone,
                message=message
            )
            
            if success:
                logger.info(f"Reminder sent: {reminder_id} to {client_name}")
                
                # Actualizar estado del recordatorio
                if recurrence:
                    # Si es recurrente, crear el siguiente recordatorio
                    self.schedule_next_recurrence(
                        reminder_id=reminder_id,
                        tenant_id=tenant_id,
                        client_id=client_id,
                        title=title,
                        description=description,
                        current_remind_at=remind_at,
                        recurrence=recurrence
                    )
                    
                    # Marcar el actual como enviado
                    self.mark_as_sent(reminder_id)
                else:
                    # Si no es recurrente, solo marcarlo como enviado
                    self.mark_as_sent(reminder_id)
            else:
                logger.error(f"Failed to send reminder: {reminder_id}")
                
        except Exception as e:
            logger.error(f"Error sending reminder {reminder_id}: {e}")
    
    def mark_as_sent(self, reminder_id: str):
        """Marca un recordatorio como enviado"""
        
        try:
            with get_db() as db:
                query = text("""
                    UPDATE "Reminder"
                    SET status = 'SENT', "sentAt" = NOW(), "updatedAt" = NOW()
                    WHERE id = :reminder_id
                """)
                
                db.execute(query, {"reminder_id": reminder_id})
                logger.info(f"Reminder marked as sent: {reminder_id}")
                
        except Exception as e:
            logger.error(f"Error marking reminder as sent: {e}")
    
    def schedule_next_recurrence(
        self,
        reminder_id: str,
        tenant_id: str,
        client_id: str,
        title: str,
        description: str,
        current_remind_at: datetime,
        recurrence: str
    ):
        """Programa el siguiente recordatorio recurrente"""
        
        try:
            # Calcular próxima fecha según recurrencia
            if recurrence == 'daily':
                next_remind_at = current_remind_at + timedelta(days=1)
            elif recurrence == 'weekly':
                next_remind_at = current_remind_at + timedelta(weeks=1)
            elif recurrence == 'monthly':
                next_remind_at = current_remind_at + timedelta(days=30)
            else:
                logger.warning(f"Unknown recurrence type: {recurrence}")
                return
            
            # Crear nuevo recordatorio
            with get_db() as db:
                query = text("""
                    INSERT INTO "Reminder" 
                    (id, "tenantId", "clientId", title, description, "remindAt", recurrence, status, "createdAt", "updatedAt")
                    VALUES (gen_random_uuid()::text, :tenant_id, :client_id, :title, :description, :remind_at, :recurrence, 'PENDING', NOW(), NOW())
                """)
                
                db.execute(query, {
                    "tenant_id": tenant_id,
                    "client_id": client_id,
                    "title": title,
                    "description": description,
                    "remind_at": next_remind_at,
                    "recurrence": recurrence
                })
                
                logger.info(f"Next recurrence scheduled: {title} at {next_remind_at}")
                
        except Exception as e:
            logger.error(f"Error scheduling next recurrence: {e}")