"""
Appointment Agent - Gestiona agendamiento de citas
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from groq import Groq
from utils.config import settings, get_db
from sqlalchemy import text
import json
import os

logger = logging.getLogger(__name__)

class AppointmentAgent:
    def __init__(self):
        """Inicializa el agente de citas"""
        self.groq_client = Groq(api_key=os.getenv('GROQ_API_KEY')) if os.getenv('GROQ_API_KEY') else None
        logger.info("Appointment agent initialized")
    
    def handle_appointment_request(self, event: Dict[str, Any]):
        """
        Procesa solicitud de cita
        
        1. Extrae fecha, hora, servicio del mensaje
        2. Valida disponibilidad (básica)
        3. Crea la cita
        4. Envía confirmación
        """
        try:
            payload = event['payload']
            tenant_id = event['tenantId']
            
            conversation_id = payload['conversationId']
            client_id = payload['clientId']
            content = payload['content']
            
            logger.info(f"Processing appointment request for client: {client_id}")
            
            # Extraer información de la cita con IA
            appointment_info = self.extract_appointment_info(content, tenant_id, client_id)
            
            if not appointment_info:
                self.send_clarification_message(tenant_id, client_id)
                return
            
            # Crear la cita
            appointment = self.create_appointment(
                tenant_id=tenant_id,
                client_id=client_id,
                appointment_info=appointment_info
            )
            
            if appointment:
                # Enviar confirmación
                self.send_confirmation_message(
                    tenant_id=tenant_id,
                    client_id=client_id,
                    appointment=appointment
                )
            
        except Exception as e:
            logger.error(f"Error handling appointment request: {e}")
    
    def extract_appointment_info(
        self, 
        content: str, 
        tenant_id: str,
        client_id: str
    ) -> Optional[Dict[str, Any]]:
        """Extrae información de la cita usando Groq"""
        
        if not self.groq_client:
            logger.error("Groq client not available")
            return None
        
        try:
            system_prompt = """Eres un asistente para extraer información de citas/turnos.
Extrae del mensaje:
- fecha: fecha de la cita (formato ISO 8601, ej: 2026-03-21)
- hora: hora de la cita (formato HH:MM, ej: 15:00)
- servicio: tipo de servicio solicitado (si se menciona)
- notas: cualquier nota adicional

Reglas:
- "mañana" = día siguiente
- "pasado mañana" = dentro de 2 días
- Si no se menciona hora, usa 10:00 por defecto
- Si no se menciona servicio, usa "Consulta general"

Fecha de hoy: {today}

Responde SOLO con JSON:
{{
  "fecha": "YYYY-MM-DD",
  "hora": "HH:MM",
  "servicio": "string",
  "notas": "string",
  "confianza": 0.0-1.0
}}"""
            
            today = datetime.now().strftime("%Y-%m-%d")
            
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt.format(today=today)},
                    {"role": "user", "content": f"Mensaje del cliente: {content}"}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            
            info = json.loads(response.choices[0].message.content)
            logger.info(f"Appointment info extracted: {info}")
            
            # Validar confianza mínima
            if info.get('confianza', 0) < 0.5:
                logger.warning("Low confidence in appointment extraction")
                return None
            
            return info
            
        except Exception as e:
            logger.error(f"Error extracting appointment info: {e}")
            return None
    
    def create_appointment(
        self,
        tenant_id: str,
        client_id: str,
        appointment_info: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Crea la cita en la base de datos"""
        
        try:
            # Combinar fecha y hora
            fecha_str = appointment_info['fecha']
            hora_str = appointment_info['hora']
            
            scheduled_at = datetime.fromisoformat(f"{fecha_str}T{hora_str}:00")
            
            with get_db() as db:
                query = text("""
                    INSERT INTO "Appointment" (
                        "tenantId",
                        "clientId",
                        "title",
                        "scheduledAt",
                        "duration",
                        "status",
                        "notes",
                        "createdAt",
                        "updatedAt"
                    ) VALUES (
                        :tenant_id,
                        :client_id,
                        :title,
                        :scheduled_at,
                        :duration,
                        :status,
                        :notes,
                        NOW(),
                        NOW()
                    )
                    RETURNING id, "scheduledAt", title
                """)
                
                result = db.execute(query, {
                    "tenant_id": tenant_id,
                    "client_id": client_id,
                    "title": appointment_info.get('servicio', 'Consulta general'),
                    "scheduled_at": scheduled_at,
                    "duration": 60,  # 60 minutos por defecto
                    "status": "SCHEDULED",
                    "notes": appointment_info.get('notas', '')
                })
                
                appointment = result.fetchone()
                db.commit()
                
                logger.info(f"Appointment created: {appointment[0]}")
                
                return {
                    "id": appointment[0],
                    "scheduledAt": appointment[1],
                    "title": appointment[2]
                }
                
        except Exception as e:
            logger.error(f"Error creating appointment: {e}")
            return None
    
    def send_confirmation_message(
        self,
        tenant_id: str,
        client_id: str,
        appointment: Dict[str, Any]
    ):
        """Envía mensaje de confirmación"""
        
        try:
            # Obtener teléfono del cliente
            with get_db() as db:
                query = text("""
                    SELECT c.phone, c.name FROM "Client" c
                    WHERE c.id = :client_id
                    AND c."tenantId" = :tenant_id
                """)
                result = db.execute(query, {"client_id": client_id, "tenant_id": tenant_id})
                client = result.fetchone()
                
                if not client:
                    return
                
                phone = client[0]
                name = client[1]
            
            # Formatear fecha/hora
            scheduled_at = appointment['scheduledAt']
            fecha_formatted = scheduled_at.strftime("%d/%m/%Y")
            hora_formatted = scheduled_at.strftime("%H:%M")
            
            message = f"""✅ *Cita confirmada*

📅 Fecha: {fecha_formatted}
🕐 Hora: {hora_formatted}
📋 Servicio: {appointment['title']}

¡Te esperamos! Si necesitas cancelar o reprogramar, avísanos con anticipación."""
            
            # Enviar mensaje
            from utils.whatsapp_sender import whatsapp_sender
            whatsapp_sender.send_message(phone, message)
            logger.info(f"Confirmation sent to {phone}")
            
        except Exception as e:
            logger.error(f"Error sending confirmation: {e}")
    
    def send_clarification_message(self, tenant_id: str, client_id: str):
        """Envía mensaje pidiendo más informac