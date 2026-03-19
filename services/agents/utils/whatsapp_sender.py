"""
WhatsApp Sender - Servicio para enviar mensajes por WhatsApp Business API
"""
import logging
import requests
from typing import Dict, Any, Optional
from utils.config import settings

logger = logging.getLogger(__name__)


class WhatsAppSender:
    """Envía mensajes a través de WhatsApp Business API"""
    
    def __init__(self):
        self.api_url = "https://graph.facebook.com/v18.0"
        self.access_token = settings.whatsapp_access_token
        
    def send_message(
        self, 
        to_phone: str, 
        message: str,
        phone_number_id: Optional[str] = None
    ) -> bool:
        """
        Envía un mensaje de texto a un número de WhatsApp
        
        Args:
            to_phone: Número de teléfono destino (con código de país)
            message: Contenido del mensaje
            phone_number_id: ID del número de WhatsApp (opcional, se usa uno por defecto)
        
        Returns:
            True si se envió exitosamente, False en caso contrario
        """
        
        # Usar phone_number_id de settings si no se proporciona
        if not phone_number_id:
            phone_number_id = "956862047503192"  # Tu número de prueba
        
        try:
            url = f"{self.api_url}/{phone_number_id}/messages"
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to_phone,
                "type": "text",
                "text": {
                    "preview_url": False,
                    "body": message
                }
            }
            
            response = requests.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                logger.info(f"Message sent successfully to {to_phone}")
                return True
            else:
                logger.error(f"Failed to send message: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending WhatsApp message: {e}")
            return False
    
    def send_template_message(
        self,
        to_phone: str,
        template_name: str,
        template_params: list,
        phone_number_id: Optional[str] = None
    ) -> bool:
        """
        Envía un mensaje usando una plantilla pre-aprobada
        
        Args:
            to_phone: Número de teléfono destino
            template_name: Nombre de la plantilla aprobada
            template_params: Parámetros para la plantilla
            phone_number_id: ID del número de WhatsApp
        
        Returns:
            True si se envió exitosamente
        """
        
        if not phone_number_id:
            phone_number_id = "956862047503192"
        
        try:
            url = f"{self.api_url}/{phone_number_id}/messages"
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            
            # Construir parámetros de la plantilla
            components = [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": param}
                        for param in template_params
                    ]
                }
            ]
            
            payload = {
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {
                        "code": "es"
                    },
                    "components": components
                }
            }
            
            response = requests.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                logger.info(f"Template message sent to {to_phone}")
                return True
            else:
                logger.error(f"Failed to send template: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending template message: {e}")
            return False


# Singleton instance
whatsapp_sender = WhatsAppSender()