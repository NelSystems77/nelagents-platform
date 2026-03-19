"""
Event Consumer - Procesa eventos del Redis Stream
"""
import json
import time
import logging
from typing import Dict, Any, Callable, List
from redis import Redis
from utils.config import settings

logger = logging.getLogger(__name__)


class EventConsumer:
    """Consumidor de eventos de Redis Streams"""
    
    def __init__(self, consumer_group: str, consumer_name: str):
        # Construir URL TCP con autenticación
        redis_url = f"rediss://default:{settings.upstash_redis_token}@smiling-mako-77913.upstash.io:6379"
        self.redis = Redis.from_url(redis_url, decode_responses=False)
        self.consumer_group = consumer_group
        self.consumer_name = consumer_name
        self.handlers: Dict[str, Callable] = {}
        
    def register_handler(self, event_type: str, handler: Callable):
        """Registra un handler para un tipo de evento"""
        self.handlers[event_type] = handler
        logger.info(f"Handler registered for {event_type}")
        
    def get_stream_name(self, event_type: str) -> str:
        """Obtiene el nombre del stream basado en el tipo de evento"""
        domain = event_type.split('.')[0]
        return f"events:{domain}"
        
    def create_consumer_group(self, stream_name: str):
        """Crea consumer group si no existe"""
        try:
            self.redis.xgroup_create(
                stream_name, 
                self.consumer_group, 
                id='0', 
                mkstream=True
            )
            logger.info(f"Consumer group created: {self.consumer_group}")
        except Exception as e:
            # Group ya existe
            logger.debug(f"Consumer group already exists: {e}")
            
    def consume(self, event_types: List[str], count: int = 10, block: int = 5000):
        """
        Consume eventos de los streams especificados
        
        Args:
            event_types: Lista de tipos de eventos a consumir
            count: Número máximo de eventos a procesar por batch
            block: Tiempo de bloqueo en ms (0 = infinito)
        """
        # Crear consumer groups
        streams = {}
        for event_type in event_types:
            stream_name = self.get_stream_name(event_type)
            self.create_consumer_group(stream_name)
            streams[stream_name] = '>'
            
        logger.info(f"Starting consumer for streams: {list(streams.keys())}")
        
        while True:
            try:
                # Leer eventos
                results = self.redis.xreadgroup(
                    groupname=self.consumer_group,
                    consumername=self.consumer_name,
                    streams=streams,
                    count=count,
                    block=block,
                )
                
                if not results:
                    continue
                    
                # Procesar eventos
                for stream_name, messages in results:
                    for message_id, fields in messages:
                        self.process_message(
                            stream_name.decode('utf-8'),
                            message_id.decode('utf-8'),
                            fields
                        )
                        
            except Exception as e:
                logger.error(f"Error in consumer loop: {e}")
                time.sleep(5)  # Backoff antes de reintentar
                
    def process_message(self, stream_name: str, message_id: str, fields: Dict[bytes, bytes]):
        """Procesa un mensaje individual"""
        try:
            # Parsear evento
            event_data = fields[b'event'].decode('utf-8')
            event = json.loads(event_data)
            
            event_type = event.get('eventType')
            tenant_id = event.get('tenantId')
            
            logger.info(f"Processing event: {event_type} (tenant: {tenant_id})")
            
            # Buscar handler
            handler = self.handlers.get(event_type)
            
            if handler:
                # Ejecutar handler
                handler(event)
                
                # Acknowled evento
                self.redis.xack(stream_name, self.consumer_group, message_id)
                logger.info(f"Event processed successfully: {message_id}")
            else:
                logger.warning(f"No handler for event type: {event_type}")
                # Acknowled de todas formas para no bloquear el stream
                self.redis.xack(stream_name, self.consumer_group, message_id)
                
        except Exception as e:
            logger.error(f"Error processing message {message_id}: {e}")
            # En producción, enviar a dead letter queue después de max_retries
