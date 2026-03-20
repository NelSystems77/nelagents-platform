"""
Agente de Conversación - Procesa mensajes y genera respuestas inteligentes
"""
import logging
from typing import Dict, Any, Optional
from openai import OpenAI
from sqlalchemy import select, and_
from datetime import datetime, timedelta
from utils.config import settings, get_db
from anthropic import Anthropic
from groq import Groq
from agents.memory_agent import MemoryAgent
from agents.appointment_agent import AppointmentAgent

logger = logging.getLogger(__name__)


class ConversationAgent:
    """Agente conversacional con IA multi-proveedor (Groq → OpenAI → Claude)"""
    
    def __init__(self):
        # Inicializar todos los clientes disponibles
        self.groq_client = None
        self.openai_client = None
        self.anthropic_client = None
        
        if settings.groq_api_key:
            self.groq_client = Groq(api_key=settings.groq_api_key)
            
        if settings.openai_api_key:
            self.openai_client = OpenAI(api_key=settings.openai_api_key)
            
        if settings.anthropic_api_key:
            self.anthropic_client = Anthropic(api_key=settings.anthropic_api_key)
        
        # Inicializar Memory Agent
        self.memory_agent = MemoryAgent()
        self.appointment_agent = AppointmentAgent()
        
        # Prioridad: Groq primero (gratis), OpenAI segundo, Claude tercero
        if self.groq_client:
            self.primary_provider = "groq"
        elif self.openai_client:
            self.primary_provider = "openai"
        else:
            self.primary_provider = "anthropic"
        
        logger.info(f"Conversation agent initialized. Primary: {self.primary_provider}")
        
    def handle_message_received(self, event: Dict[str, Any]):
        """
        Procesa evento de mensaje recibido
        
        1. Detecta intención
        2. Extrae entidades
        3. Decide acción (responder, derivar a agente específico, derivar a humano)
        4. Ejecuta acción
        """
        try:
            payload = event['payload']
            tenant_id = event['tenantId']
            
            message_id = payload['messageId']
            conversation_id = payload['conversationId']
            client_id = payload['clientId']
            content = payload['content']
            
            logger.info(f"Processing message: {message_id}")
            
            # Obtener contexto de conversación
            context = self.get_conversation_context(
                tenant_id, 
                conversation_id,
                client_id
            )
            
            # Analizar intención con IA (con fallback automático)
            analysis = self.analyze_message(content, context)
            
            # Publicar evento normalizado
            self.publish_normalized_event(
                event_id=event['id'],
                tenant_id=tenant_id,
                message_id=message_id,
                conversation_id=conversation_id,
                client_id=client_id,
                analysis=analysis
            )
            
            # Tomar acción basada en intención
            self.take_action(
                tenant_id=tenant_id,
                conversation_id=conversation_id,
                client_id=client_id,
                analysis=analysis
            )
            
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            
    def get_conversation_context(
        self, 
        tenant_id: str, 
        conversation_id: str,
        client_id: str
    ) -> Dict[str, Any]:
        """Obtiene contexto de la conversación (últimos mensajes, datos del cliente)"""
        
        with get_db() as db:
            # Obtener últimos 10 mensajes
            from sqlalchemy import text
            
            query = text("""
                SELECT m.content, m.direction, m."createdAt"
                FROM "Message" m
                WHERE m."conversationId" = :conversation_id
                AND m."tenantId" = :tenant_id
                ORDER BY m."createdAt" DESC
                LIMIT 10
            """)
            
            result = db.execute(
                query, 
                {"conversation_id": conversation_id, "tenant_id": tenant_id}
            )
            messages = result.fetchall()
            
            # Obtener datos del cliente
            client_query = text("""
                SELECT c.name, c.status, c.tags
                FROM "Client" c
                WHERE c.id = :client_id
                AND c."tenantId" = :tenant_id
            """)
            
            client_result = db.execute(
                client_query,
                {"client_id": client_id, "tenant_id": tenant_id}
            )
            client = client_result.fetchone()
            
            # Obtener citas próximas
            appointments_query = text("""
                SELECT a.id, a.title, a."scheduledAt", a.status
                FROM "Appointment" a
                WHERE a."clientId" = :client_id
                AND a."tenantId" = :tenant_id
                AND a."scheduledAt" > NOW()
                AND a.status IN ('SCHEDULED', 'CONFIRMED')
                ORDER BY a."scheduledAt" ASC
                LIMIT 3
            """)
            
            appointments_result = db.execute(
                appointments_query,
                {"client_id": client_id, "tenant_id": tenant_id}
            )
            appointments = appointments_result.fetchall()
            
            return {
                "messages": [
                    {
                        "content": msg[0],
                        "direction": msg[1],
                        "timestamp": msg[2].isoformat() if msg[2] else None
                    }
                    for msg in messages
                ],
                "client": {
                    "name": client[0] if client else "Cliente",
                    "status": client[1] if client else "LEAD",
                    "tags": client[2] if client else []
                },
                "appointments": [
                    {
                        "id": apt[0],
                        "title": apt[1],
                        "scheduledAt": apt[2].isoformat() if apt[2] else None,
                        "status": apt[3]
                    }
                    for apt in appointments
                ]
            }
    
    def analyze_message(self, content: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Analiza mensaje con IA (Groq → OpenAI → Claude fallback en cascada)"""
        
        # 1. Intentar Groq (gratis y rápido)
        result = self._analyze_with_groq(content, context)
        if result:
            result['original_message'] = content
            return result
        logger.warning("Groq failed, trying OpenAI...")
        
        # 2. Intentar OpenAI
        result = self._analyze_with_openai(content, context)
        if result:
            result['original_message'] = content
            return result
        logger.warning("OpenAI failed, trying Claude...")
        
        # 3. Intentar Claude
        result = self._analyze_with_claude(content, context)
        if result:
            result['original_message'] = content
            return result
        
        # 4. Fallback seguro si todos fallan
        logger.error("All AI providers failed, using safe fallback")
        return {
            "intent": "otro",
            "entities": {},
            "sentiment": "neutral",
            "requires_human": True,
            "suggested_response": "Gracias por tu mensaje. Un agente te atenderá pronto.",
            "original_message": content
        }
    
    def _analyze_with_groq(self, content: str, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Analiza con Groq (gratis)"""
        if not self.groq_client:
            return None
            
        try:
            system_prompt = """Eres un asistente inteligente para un negocio.
Analiza el mensaje del cliente y detecta:
1. Intención principal:
   - saludar: Saludo general
   - agendar_cita: Agendar cita/turno
   - consultar: Preguntas sobre servicios/productos
   - cancelar: Cancelar algo
   - confirmar: Confirmar algo
   - guardar_memoria: Usuario quiere guardar información ("guardé X en Y", "anota que...", "recuerda que mi contraseña es...")
   - recuperar_memoria: Usuario busca información guardada ("¿dónde puse...?", "¿cuál es mi...?")
   - crear_recordatorio: Usuario quiere un recordatorio futuro ("recuérdame...", "avísame cuando...", "quiero que me recuerdes...")
   - consultar_recordatorios: Usuario pregunta por sus recordatorios ("¿qué tengo pendiente?", "mis recordatorios")
   - otro: Cualquier otra cosa
2. Entidades relevantes (fecha, hora, servicio, etc.)
3. Sentimiento (positivo, neutral, negativo)
4. Requiere_atencion_humana (true/false)

Responde SOLO con JSON:
{
  "intent": "string",
  "entities": {},
  "sentiment": "string",
  "requires_human": boolean,
  "suggested_response": "string"
}"""
            
            user_prompt = f"""Mensaje del cliente: "{content}"

Contexto:
- Cliente: {context['client']['name']}
- Estado: {context['client']['status']}
- Citas próximas: {len(context['appointments'])}
"""
            
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            import json
            analysis = json.loads(response.choices[0].message.content)
            logger.info("Analysis successful with Groq")
            return analysis
            
        except Exception as e:
            logger.error(f"Groq error: {e}")
            return None
    
    def _analyze_with_openai(self, content: str, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Analiza con OpenAI"""
        if not self.openai_client:
            return None
            
        try:
            system_prompt = """Eres un asistente inteligente para un negocio.
Analiza el mensaje del cliente y detecta:
1. Intención principal:
   - saludar: Saludo general
   - agendar_cita: Agendar cita/turno
   - consultar: Preguntas sobre servicios/productos
   - cancelar: Cancelar algo
   - confirmar: Confirmar algo
   - guardar_memoria: Usuario quiere guardar información
   - recuperar_memoria: Usuario busca información guardada
   - crear_recordatorio: Usuario quiere un recordatorio futuro
   - consultar_recordatorios: Usuario pregunta por sus recordatorios
   - otro: Cualquier otra cosa
2. Entidades relevantes (fecha, hora, servicio, etc.)
3. Sentimiento (positivo, neutral, negativo)
4. Requiere_atencion_humana (true/false)

Responde SOLO con JSON:
{
  "intent": "string",
  "entities": {},
  "sentiment": "string",
  "requires_human": boolean,
  "suggested_response": "string"
}"""
            
            user_prompt = f"""Mensaje del cliente: "{content}"

Contexto:
- Cliente: {context['client']['name']}
- Estado: {context['client']['status']}
- Citas próximas: {len(context['appointments'])}
"""
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            import json
            analysis = json.loads(response.choices[0].message.content)
            logger.info("Analysis successful with OpenAI")
            return analysis
            
        except Exception as e:
            logger.error(f"OpenAI error: {e}")
            return None
    
    def _analyze_with_claude(self, content: str, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Analiza con Claude"""
        if not self.anthropic_client:
            return None
            
        try:
            system_prompt = """Eres un asistente inteligente para un negocio.
Analiza el mensaje del cliente y detecta:
1. Intención principal (saludar, agendar_cita, consultar, cancelar, confirmar, guardar_memoria, recuperar_memoria, crear_recordatorio, consultar_recordatorios, otro)
2. Entidades relevantes (fecha, hora, servicio, etc.)
3. Sentimiento (positivo, neutral, negativo)
4. Requiere_atencion_humana (true/false)

Responde SOLO con JSON válido."""
            
            user_prompt = f"""Mensaje del cliente: "{content}"

Contexto:
- Cliente: {context['client']['name']}
- Estado: {context['client']['status']}
- Citas próximas: {len(context['appointments'])}

Formato de respuesta JSON:
{{
  "intent": "string",
  "entities": {{}},
  "sentiment": "string",
  "requires_human": boolean,
  "suggested_response": "string"
}}"""
            
            response = self.anthropic_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            import json
            analysis = json.loads(response.content[0].text)
            logger.info("Analysis successful with Claude")
            return analysis
            
        except Exception as e:
            logger.error(f"Claude error: {e}")
            return None
            
    def publish_normalized_event(
        self, 
        event_id: str,
        tenant_id: str,
        message_id: str,
        conversation_id: str,
        client_id: str,
        analysis: Dict[str, Any]
    ):
        """Publica evento de mensaje normalizado"""
        logger.info(f"Normalized event: {analysis['intent']}")
        
    def take_action(
        self,
        tenant_id: str,
        conversation_id: str,
        client_id: str,
        analysis: Dict[str, Any]
    ):
        """Toma acción basada en el análisis"""
        
        intent = analysis.get('intent')
        
        # Intenciones de memoria - delegar a Memory Agent
        if intent in ['guardar_memoria', 'recuperar_memoria', 'crear_recordatorio', 'consultar_recordatorios']:
            logger.info(f"Delegating to memory agent: {intent}")
            # Crear evento para Memory Agent
            memory_event = {
                'id': 'temp-id',
                'tenantId': tenant_id,
                'payload': {
                    'messageId': 'temp-msg-id',
                    'conversationId': conversation_id,
                    'clientId': client_id,
                    'content': analysis.get('original_message', ''),
                    'intent': intent,
                    'entities': analysis.get('entities', {})
                }
            }
            self.memory_agent.handle_memory_intent(memory_event)
            
        elif intent == 'agendar_cita':
            logger.info("Delegating to appointment agent")
            
        elif analysis.get('requires_human'):
            logger.info("Requires human attention")
            # Crear evento para Appointment Agent
            appointment_event = {
                'id': 'temp-id',
                'tenantId': tenant_id,
                'payload': {
                    'conversationId': conversation_id,
                    'clientId': client_id,
                    'content': analysis.get('original_message', '')
                }
            }
            self.appointment_agent.handle_appointment_request(appointment_event)

        elif analysis.get('requires_human'):
            logger.info("Requires human attention")
            
        else:
            response = analysis.get('suggested_response')
            if response:
                self.send_message(tenant_id, conversation_id, client_id, response)
                
    def send_message(
        self, 
        tenant_id: str, 
        conversation_id: str, 
        client_id: str, 
        content: str
    ):
        """Envía mensaje al cliente"""
        logger.info(f"Sending message to {client_id}: {content[:50]}...")
        
        try:
            # Obtener teléfono del cliente
            from sqlalchemy import text
            with get_db() as db:
                query = text("""
                    SELECT c.phone FROM "Client" c
                    WHERE c.id = :client_id
                    AND c."tenantId" = :tenant_id
                """)
                result = db.execute(query, {"client_id": client_id, "tenant_id": tenant_id})
                client = result.fetchone()
                
                if not client:
                    logger.error(f"Client not found: {client_id}")
                    return
                
                phone = client[0]
                
            # Enviar mensaje por WhatsApp
            from utils.whatsapp_sender import whatsapp_sender
            whatsapp_sender.send_message(phone, content)
            logger.info(f"Message sent successfully to {phone}")
            
        except Exception as e:
            logger.error(f"Error sending message: {e}")