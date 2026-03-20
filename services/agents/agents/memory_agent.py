"""
Memory Agent - Gestiona memorias y recordatorios personales
"""
import logging
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from groq import Groq
from openai import OpenAI
from anthropic import Anthropic
from sqlalchemy import text
from utils.config import settings, get_db

logger = logging.getLogger(__name__)


class MemoryAgent:
    """Agente de memoria personal con IA multi-proveedor"""
    
    def __init__(self):
        # Inicializar clientes de IA
        self.groq_client = None
        self.openai_client = None
        self.anthropic_client = None
        
        if settings.groq_api_key:
            self.groq_client = Groq(api_key=settings.groq_api_key)
            
        if settings.openai_api_key:
            self.openai_client = OpenAI(api_key=settings.openai_api_key)
            
        if settings.anthropic_api_key:
            self.anthropic_client = Anthropic(api_key=settings.anthropic_api_key)
        
        logger.info("Memory agent initialized")
    
    def handle_memory_intent(self, event: Dict[str, Any]):
        """
        Procesa intenciones relacionadas con memoria
        - guardar_memoria: Guardar información
        - recuperar_memoria: Buscar información guardada
        - crear_recordatorio: Agendar recordatorio
        - consultar_recordatorios: Ver recordatorios pendientes
        """
        try:
            payload = event['payload']
            tenant_id = event['tenantId']
            
            message_id = payload['messageId']
            conversation_id = payload['conversationId']
            client_id = payload['clientId']
            content = payload['content']
            intent = payload.get('intent', 'otro')
            
            logger.info(f"Processing memory intent: {intent} for client {client_id}")
            
            # Analizar con IA qué hacer exactamente
            action = self.analyze_memory_request(content, intent, tenant_id, client_id)
            
            # Ejecutar acción
            result = self.execute_memory_action(
                action, 
                tenant_id, 
                client_id, 
                conversation_id
            )
            
            # Enviar respuesta al cliente
            if result.get('response'):
                self.send_message(
                    tenant_id, 
                    conversation_id, 
                    client_id, 
                    result['response']
                )
            
        except Exception as e:
            logger.error(f"Error handling memory intent: {e}")
    
    def analyze_memory_request(
        self, 
        content: str, 
        intent: str,
        tenant_id: str,
        client_id: str
    ) -> Dict[str, Any]:
        """Analiza qué acción de memoria realizar con IA"""
        
        # Obtener memorias existentes para contexto
        existing_memories = self.get_client_memories(tenant_id, client_id)
        
        # Intentar con Groq primero
        result = self._analyze_with_groq(content, intent, existing_memories)
        if result:
            return result
        
        # Fallback a OpenAI
        result = self._analyze_with_openai(content, intent, existing_memories)
        if result:
            return result
        
        # Fallback a Claude
        result = self._analyze_with_claude(content, intent, existing_memories)
        if result:
            return result
        
        # Fallback seguro
        return {
            "action": "unknown",
            "response": "No pude procesar tu solicitud de memoria. ¿Puedes reformularla?"
        }
    
    def _analyze_with_groq(
        self, 
        content: str, 
        intent: str,
        existing_memories: List[Dict]
    ) -> Optional[Dict[str, Any]]:
        """Analiza con Groq"""
        if not self.groq_client:
            return None
        
        try:
            system_prompt = f"""Eres un asistente de memoria personal.
FECHA Y HORA ACTUAL: {datetime.now().isoformat()}

Analiza el mensaje y determina la acción exacta a realizar:

ACCIONES DISPONIBLES:
1. save_memory: Guardar información
   - Extrae: key (nombre corto), value (información), category (tipo)
   
2. retrieve_memory: Buscar información
   - Extrae: query (qué buscar)
   
3. create_reminder: Crear recordatorio
   - Extrae: 
     * title: título del recordatorio
     * description: descripción (opcional)
     * remind_at: FECHA ISO-8601 calculada (ej: "2026-03-19T15:42:00")
       IMPORTANTE: Calcula la fecha sumando el tiempo especificado a la fecha actual
       Ejemplos:
       - "en 2 minutos" → suma 2 minutos a la fecha actual
       - "mañana a las 3pm" → próximo día a las 15:00
       - "el lunes a las 10am" → próximo lunes a las 10:00
     * recurrence: "daily", "weekly", "monthly" o null
   
4. list_reminders: Listar recordatorios pendientes

Responde SOLO con JSON:
{{
  "action": "save_memory|retrieve_memory|create_reminder|list_reminders",
  "params": {{}},
  "response": "mensaje para el usuario"
}}"""
            
            memories_context = f"\n\nMemorias existentes del usuario: {json.dumps(existing_memories, ensure_ascii=False)}" if existing_memories else ""
            
            user_prompt = f"""Mensaje del usuario: "{content}"
Intención detectada: {intent}{memories_context}"""
            
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            logger.info("Memory analysis successful with Groq")
            return result
            
        except Exception as e:
            logger.error(f"Groq error in memory analysis: {e}")
            return None
    
    def _analyze_with_openai(
        self, 
        content: str, 
        intent: str,
        existing_memories: List[Dict]
    ) -> Optional[Dict[str, Any]]:
        """Analiza con OpenAI"""
        if not self.openai_client:
            return None
        
        try:
            # Similar a Groq pero con OpenAI client
            # Por brevedad, usar la misma lógica
            return None  # Implementar si Groq falla
        except Exception as e:
            logger.error(f"OpenAI error in memory analysis: {e}")
            return None
    
    def _analyze_with_claude(
        self, 
        content: str, 
        intent: str,
        existing_memories: List[Dict]
    ) -> Optional[Dict[str, Any]]:
        """Analiza con Claude"""
        if not self.anthropic_client:
            return None
        
        try:
            # Similar a Groq pero con Claude
            return None  # Implementar si OpenAI falla
        except Exception as e:
            logger.error(f"Claude error in memory analysis: {e}")
            return None
    
    def execute_memory_action(
        self,
        action: Dict[str, Any],
        tenant_id: str,
        client_id: str,
        conversation_id: str
    ) -> Dict[str, Any]:
        """Ejecuta la acción de memoria"""
        
        action_type = action.get('action')
        params = action.get('params', {})
        
        if action_type == 'save_memory':
            return self.save_memory(tenant_id, client_id, params)
        
        elif action_type == 'retrieve_memory':
            return self.retrieve_memory(tenant_id, client_id, params)
        
        elif action_type == 'create_reminder':
            return self.create_reminder(tenant_id, client_id, params)
        
        elif action_type == 'list_reminders':
            return self.list_reminders(tenant_id, client_id)
        
        else:
            return {"response": action.get('response', 'No pude procesar eso.')}
    
    def save_memory(
        self, 
        tenant_id: str, 
        client_id: str, 
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Guarda una memoria"""
        
        try:
            with get_db() as db:
                query = text("""
                    INSERT INTO "Memory" (id, "tenantId", "clientId", key, value, category, "createdAt", "updatedAt")
                    VALUES (gen_random_uuid()::text, :tenant_id, :client_id, :key, :value, :category, NOW(), NOW())
                    ON CONFLICT ("tenantId", "clientId", key)
                    DO UPDATE SET value = :value, category = :category, "updatedAt" = NOW()
                """)
                
                db.execute(query, {
                    "tenant_id": tenant_id,
                    "client_id": client_id,
                    "key": params.get('key', 'info'),
                    "value": params.get('value', ''),
                    "category": params.get('category', 'general')
                })
                
                logger.info(f"Memory saved: {params.get('key')}")
                
                return {
                    "success": True,
                    "response": f"✅ Guardado: {params.get('key')}"
                }
                
        except Exception as e:
            logger.error(f"Error saving memory: {e}")
            return {
                "success": False,
                "response": "No pude guardar esa información."
            }
    
    def retrieve_memory(
        self, 
        tenant_id: str, 
        client_id: str, 
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Recupera memorias"""
        
        try:
            query_text = params.get('query', '')
            
            with get_db() as db:
                # Buscar por key o value
                query = text("""
                    SELECT key, value, category
                    FROM "Memory"
                    WHERE "tenantId" = :tenant_id 
                    AND "clientId" = :client_id
                    AND (key ILIKE :search OR value ILIKE :search)
                    ORDER BY "updatedAt" DESC
                    LIMIT 5
                """)
                
                result = db.execute(query, {
                    "tenant_id": tenant_id,
                    "client_id": client_id,
                    "search": f"%{query_text}%"
                })
                
                memories = result.fetchall()
                
                if not memories:
                    return {
                        "success": False,
                        "response": f"No encontré información sobre '{query_text}'"
                    }
                
                # Formatear respuesta
                response_lines = ["📝 Esto es lo que tengo guardado:"]
                for mem in memories:
                    response_lines.append(f"• {mem[0]}: {mem[1]}")
                
                return {
                    "success": True,
                    "response": "\n".join(response_lines)
                }
                
        except Exception as e:
            logger.error(f"Error retrieving memory: {e}")
            return {
                "success": False,
                "response": "No pude buscar esa información."
            }
    
    def create_reminder(
        self, 
        tenant_id: str, 
        client_id: str, 
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Crea un recordatorio"""
        
        try:
            with get_db() as db:
                query = text("""
                    INSERT INTO "Reminder" 
                    (id, "tenantId", "clientId", title, description, "remindAt", recurrence, status, "createdAt", "updatedAt")
                    VALUES (gen_random_uuid()::text, :tenant_id, :client_id, :title, :description, :remind_at, :recurrence, 'PENDING', NOW(), NOW())
                """)
                
                db.execute(query, {
                    "tenant_id": tenant_id,
                    "client_id": client_id,
                    "title": params.get('title', 'Recordatorio'),
                    "description": params.get('description'),
                    "remind_at": params.get('remind_at'),
                    "recurrence": params.get('recurrence')
                })
                
                logger.info(f"Reminder created: {params.get('title')}")
                
                return {
                    "success": True,
                    "response": f"⏰ Recordatorio creado: {params.get('title')}\nTe avisaré el {params.get('remind_at')}"
                }
                
        except Exception as e:
            logger.error(f"Error creating reminder: {e}")
            return {
                "success": False,
                "response": "No pude crear el recordatorio."
            }
    
    def list_reminders(self, tenant_id: str, client_id: str) -> Dict[str, Any]:
        """Lista recordatorios pendientes"""
        
        try:
            with get_db() as db:
                query = text("""
                    SELECT title, "remindAt", recurrence
                    FROM "Reminder"
                    WHERE "tenantId" = :tenant_id
                    AND "clientId" = :client_id
                    AND status = 'PENDING'
                    AND "remindAt" > NOW()
                    ORDER BY "remindAt" ASC
                    LIMIT 10
                """)
                
                result = db.execute(query, {
                    "tenant_id": tenant_id,
                    "client_id": client_id
                })
                
                reminders = result.fetchall()
                
                if not reminders:
                    return {
                        "success": True,
                        "response": "No tienes recordatorios pendientes."
                    }
                
                response_lines = ["⏰ Tus recordatorios:"]
                for rem in reminders:
                    recurrence = f" ({rem[2]})" if rem[2] else ""
                    response_lines.append(f"• {rem[0]} - {rem[1].strftime('%d/%m %H:%M')}{recurrence}")
                
                return {
                    "success": True,
                    "response": "\n".join(response_lines)
                }
                
        except Exception as e:
            logger.error(f"Error listing reminders: {e}")
            return {
                "success": False,
                "response": "No pude obtener los recordatorios."
            }
    
    def get_client_memories(self, tenant_id: str, client_id: str) -> List[Dict]:
        """Obtiene memorias del cliente para contexto"""
        
        try:
            with get_db() as db:
                query = text("""
                    SELECT key, value, category
                    FROM "Memory"
                    WHERE "tenantId" = :tenant_id
                    AND "clientId" = :client_id
                    ORDER BY "updatedAt" DESC
                    LIMIT 10
                """)
                
                result = db.execute(query, {
                    "tenant_id": tenant_id,
                    "client_id": client_id
                })
                
                memories = result.fetchall()
                
                return [
                    {"key": mem[0], "value": mem[1], "category": mem[2]}
                    for mem in memories
                ]
                
        except Exception as e:
            logger.error(f"Error getting memories: {e}")
            return []
    
    def send_message(
        self, 
        tenant_id: str, 
        conversation_id: str, 
        client_id: str, 
        content: str
    ):
        """Envía mensaje al cliente"""
    def send_memory_response(self, tenant_id: str, client_id: str, content: str):
        """Envía mensaje al cliente"""
    logger.info(f"Sending memory response to {client_id}: {content[:50]}...")
    
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
        logger.info(f"Memory response sent successfully to {phone}")
        
    except Exception as e:
        logger.error(f"Error sending memory response: {e}")