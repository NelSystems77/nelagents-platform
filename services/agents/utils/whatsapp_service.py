"""
WhatsApp Service - Envía mensajes a través de WhatsApp Business Platform
"""
import logging
import httpx
from typing import Dict, Any, Optional
from utils.config import settings, get_db
from sqlalchemy import text

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Servicio para enviar mensajes por WhatsApp Business Platform"""
    
    def __init__(self):
        self.api_url = settings.whatsapp_api_url
        self.access_token = settings.whatsapp_access_token
        
    async def send_text_message(
        self,
        tenant_id: str,
        client_id: str,
        conversation_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Envía mensaje de texto"""
        
        try:
            # Obtener configuración de WhatsApp del tenant
            tenant_config = self.get_tenant_whatsapp_config(tenant_id)
            
            if not tenant_config:
                raise Exception(f"WhatsApp not configured for tenant {tenant_id}")
            
            phone_number_id = tenant_config['phone_number_id']
            
            # Obtener teléfono del cliente
            client_phone = self.get_client_phone(client_id, tenant_id)
            
            if not client_phone:
                raise Exception(f"Client phone not found: {client_id}")
            
            # Preparar payload para Meta API
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": client_phone,
                "type": "text",
                "text": {
                    "preview_url": False,
                    "body": content
                }
            }
            
            # Enviar a WhatsApp API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/{phone_number_id}/messages",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=30.0
                )
                
                response.raise_for_status()
                result = response.json()
                
            whatsapp_id = result['messages'][0]['id']
            
            # Guardar mensaje en base de datos
            message_id = self.save_message(
                tenant_id=tenant_id,
                conversation_id=conversation_id,
                client_id=client_id,
                content=content,
                whatsapp_id=whatsapp_id,
                metadata=metadata
            )
            
            # Registrar uso
            self.record_usage(tenant_id, 'MESSAGE_SENT')
            
            logger.info(f"Message sent successfully: {message_id}")
            
            return {
                "success": True,
                "message_id": message_id,
                "whatsapp_id": whatsapp_id
            }
            
        except Exception as e:
            logger.error(f"Error sending WhatsApp message: {e}")
            return {
                "success": False,
                "error": str(e)
            }
            
    async def send_template_message(
        self,
        tenant_id: str,
        client_id: str,
        conversation_id: str,
        template_name: str,
        template_params: Dict[str, Any],
        language: str = "es"
    ) -> Dict[str, Any]:
        """Envía mensaje template pre-aprobado"""
        
        try:
            tenant_config = self.get_tenant_whatsapp_config(tenant_id)
            phone_number_id = tenant_config['phone_number_id']
            client_phone = self.get_client_phone(client_id, tenant_id)
            
            # Construir componentes del template
            components = []
            
            if template_params.get('header'):
                components.append({
                    "type": "header",
                    "parameters": template_params['header']
                })
                
            if template_params.get('body'):
                components.append({
                    "type": "body",
                    "parameters": template_params['body']
                })
                
            payload = {
                "messaging_product": "whatsapp",
                "to": client_phone,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {
                        "code": language
                    },
                    "components": components
                }
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/{phone_number_id}/messages",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=30.0
                )
                
                response.raise_for_status()
                result = response.json()
                
            whatsapp_id = result['messages'][0]['id']
            
            # Guardar en DB
            message_id = self.save_message(
                tenant_id=tenant_id,
                conversation_id=conversation_id,
                client_id=client_id,
                content=f"Template: {template_name}",
                whatsapp_id=whatsapp_id,
                content_type='TEMPLATE',
                template_name=template_name,
                template_params=template_params
            )
            
            # Registrar uso de template (más costoso)
            self.record_usage(tenant_id, 'TEMPLATE_SENT')
            
            return {
                "success": True,
                "message_id": message_id,
                "whatsapp_id": whatsapp_id
            }
            
        except Exception as e:
            logger.error(f"Error sending template: {e}")
            return {
                "success": False,
                "error": str(e)
            }
            
    def get_tenant_whatsapp_config(self, tenant_id: str) -> Dict[str, Any] | None:
        """Obtiene configuración de WhatsApp del tenant"""
        
        with get_db() as db:
            query = text("""
                SELECT "whatsappNumber", "whatsappApiKey"
                FROM "Tenant"
                WHERE id = :tenant_id
            """)
            
            result = db.execute(query, {"tenant_id": tenant_id})
            row = result.fetchone()
            
            if not row or not row[0]:
                return None
                
            return {
                "phone_number": row[0],
                "phone_number_id": row[1]  # En producción esto sería separado
            }
            
    def get_client_phone(self, client_id: str, tenant_id: str) -> str | None:
        """Obtiene teléfono del cliente"""
        
        with get_db() as db:
            query = text("""
                SELECT phone
                FROM "Client"
                WHERE id = :client_id
                AND "tenantId" = :tenant_id
            """)
            
            result = db.execute(
                query,
                {"client_id": client_id, "tenant_id": tenant_id}
            )
            row = result.fetchone()
            
            return row[0] if row else None
            
    def save_message(
        self,
        tenant_id: str,
        conversation_id: str,
        client_id: str,
        content: str,
        whatsapp_id: str,
        content_type: str = 'TEXT',
        template_name: Optional[str] = None,
        template_params: Optional[Dict] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """Guarda mensaje en base de datos"""
        
        import json
        
        with get_db() as db:
            query = text("""
                INSERT INTO "Message" (
                    id,
                    "tenantId",
                    "conversationId",
                    "clientId",
                    direction,
                    content,
                    "contentType",
                    "whatsappId",
                    "whatsappStatus",
                    "templateName",
                    "templateParams",
                    metadata,
                    "createdAt",
                    "updatedAt"
                ) VALUES (
                    gen_random_uuid(),
                    :tenant_id,
                    :conversation_id,
                    :client_id,
                    'OUTBOUND',
                    :content,
                    :content_type,
                    :whatsapp_id,
                    'SENT',
                    :template_name,
                    :template_params,
                    :metadata,
                    NOW(),
                    NOW()
                )
                RETURNING id
            """)
            
            result = db.execute(
                query,
                {
                    "tenant_id": tenant_id,
                    "conversation_id": conversation_id,
                    "client_id": client_id,
                    "content": content,
                    "content_type": content_type,
                    "whatsapp_id": whatsapp_id,
                    "template_name": template_name,
                    "template_params": json.dumps(template_params) if template_params else None,
                    "metadata": json.dumps(metadata) if metadata else None,
                }
            )
            
            message_id = result.fetchone()[0]
            return message_id
            
    def record_usage(self, tenant_id: str, usage_type: str):
        """Registra uso para billing"""
        
        with get_db() as db:
            query = text("""
                INSERT INTO "UsageRecord" (
                    id,
                    "tenantId",
                    "usageType",
                    quantity,
                    "recordedAt"
                ) VALUES (
                    gen_random_uuid(),
                    :tenant_id,
                    :usage_type,
                    1,
                    NOW()
                )
            """)
            
            db.execute(
                query,
                {"tenant_id": tenant_id, "usage_type": usage_type}
            )


# Singleton
whatsapp_service = WhatsAppService()
