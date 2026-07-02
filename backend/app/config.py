from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "SOC Triage Pipeline"
    database_url: str = "sqlite+aiosqlite:///./soc.db"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 480
    analyst_username: str = "analyst"
    analyst_password: str = "changeme"

    # Ingest webhook shared secret (Wazuh integration script sends this)
    ingest_api_key: str = "wazuh-ingest-secret"

    # Threat intel providers — empty key disables the provider
    virustotal_api_key: str = ""
    otx_api_key: str = ""
    abuseipdb_api_key: str = ""
    enrichment_cache_ttl_hours: int = 24
    mock_enrichment: bool = False  # force mock intel even without keys

    # LLM
    llm_provider: str = "ollama"  # ollama | anthropic | mock
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:3b"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # Correlation
    correlation_window_minutes: int = 30

    cors_origins: str = "http://localhost:5173,http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
