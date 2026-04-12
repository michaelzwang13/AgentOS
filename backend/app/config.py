from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_key: str

    # Encryption
    encryption_key: str

    # Docker
    docker_network: str = "openclaw-agents"
    openclaw_agent_image: str = "openclaw/agent:latest"

    # LLM
    llm_api_key: str = ""

    # Platform
    platform_host: str = "0.0.0.0"
    platform_port: int = 8000
    platform_gateway_url: str = "http://host.docker.internal:8000/gateway"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
