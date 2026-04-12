from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""

    # Encryption
    encryption_key: str = ""

    # Docker
    docker_network: str = "openclaw-agents"
    openclaw_agent_image: str = "openclaw/agent:latest"

    # LLM
    llm_api_key: str = ""
    anthropic_api_key: str = ""

    # OAuth — Slack
    slack_client_id: str = ""
    slack_client_secret: str = ""

    # OAuth — Gmail / Google
    google_client_id: str = ""
    google_client_secret: str = ""

    # OAuth — GitHub
    github_client_id: str = ""
    github_client_secret: str = ""

    # Platform
    base_url: str = ""
    platform_host: str = "0.0.0.0"
    platform_port: int = 8000
    platform_gateway_url: str = "http://host.docker.internal:8000/gateway"
    frontend_url: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
