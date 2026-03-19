"""
Configuración y conexión a base de datos para agentes
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager


class Settings(BaseSettings):
    """Configuración del servicio de agentes"""
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "")
    
    # Redis / Event Bus
    upstash_redis_url: str = os.getenv("UPSTASH_REDIS_REST_URL", "")
    upstash_redis_token: str = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
    
    # WhatsApp
    whatsapp_api_url: str = "https://graph.facebook.com/v18.0"
    whatsapp_access_token: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    
    # AI
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")

    # Agents
    agent_model: str = "gpt-4o"
    max_retries: int = 3
    
    class Config:
        env_file = ".env"


settings = Settings()


# Database Engine
engine = create_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db() -> Session:
    """Context manager para sesiones de base de datos"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
