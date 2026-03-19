"""
Worker Principal - Orquesta los agentes y consume eventos
"""
import logging
import sys
import threading
from workers.event_consumer import EventConsumer
from workers.reminder_worker import ReminderWorker
from agents.conversation_agent import ConversationAgent

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


def run_event_consumer(consumer):
    """Ejecuta el event consumer en un thread separado"""
    try:
        event_types = [
            "message.received",
            "appointment.reminder.due",
            "client.reactivated",
        ]
        logger.info(f"Event consumer ready. Consuming: {event_types}")
        consumer.consume(event_types)
    except Exception as e:
        logger.error(f"Event consumer error: {e}")


def run_reminder_worker(reminder_worker):
    """Ejecuta el reminder worker en un thread separado"""
    try:
        reminder_worker.start()
    except Exception as e:
        logger.error(f"Reminder worker error: {e}")


def main():
    """Inicializa y ejecuta ambos workers en paralelo"""
    
    logger.info("Starting Agents Worker System...")
    
    # Inicializar agentes
    conversation_agent = ConversationAgent()
    
    # Crear event consumer
    consumer = EventConsumer(
        consumer_group="agents-group",
        consumer_name="agent-worker-1"
    )
    
    # Registrar handlers para el event consumer
    consumer.register_handler(
        "message.received",
        conversation_agent.handle_message_received
    )
    
    # Crear reminder worker
    reminder_worker = ReminderWorker(check_interval=60)  # Revisar cada 60 segundos
    
    # Crear threads para ambos workers
    event_thread = threading.Thread(
        target=run_event_consumer,
        args=(consumer,),
        daemon=True,
        name="EventConsumer"
    )
    
    reminder_thread = threading.Thread(
        target=run_reminder_worker,
        args=(reminder_worker,),
        daemon=True,
        name="ReminderWorker"
    )
    
    # Iniciar ambos threads
    logger.info("Starting Event Consumer thread...")
    event_thread.start()
    
    logger.info("Starting Reminder Worker thread...")
    reminder_thread.start()
    
    logger.info("✅ All workers running. Press Ctrl+C to stop.")
    
    # Mantener el main thread vivo
    try:
        while True:
            event_thread.join(timeout=1)
            reminder_thread.join(timeout=1)
            
            # Verificar si algún thread murió
            if not event_thread.is_alive():
                logger.error("Event consumer thread died!")
                break
            if not reminder_thread.is_alive():
                logger.error("Reminder worker thread died!")
                break
                
    except KeyboardInterrupt:
        logger.info("Shutdown signal received. Stopping workers...")
        reminder_worker.stop()
        logger.info("Workers stopped successfully")


if __name__ == "__main__":
    main()