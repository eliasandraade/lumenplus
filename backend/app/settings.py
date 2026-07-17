"""
Lumen+ Backend Settings
=======================
Configurações organizadas por blocos lógicos.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # =========================================================================
    # APP
    # =========================================================================
    environment: Literal["dev", "staging", "production", "test"] = Field(default="dev")
    app_name: str = Field(default="Lumen+ API")
    app_version: str = Field(default="0.3.0")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(default="INFO")
    debug: bool = Field(default=False)

    # =========================================================================
    # SECURITY
    # =========================================================================
    secret_key: str = Field(default="change-me-in-production")
    auth_mode: Literal["DEV", "PROD"] = Field(default="DEV")
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:8080,http://localhost:8081"
    )

    # Criptografia (CPF/RG)
    encryption_key: str = Field(default="")
    hmac_pepper: str = Field(default="")

    # =========================================================================
    # DATABASE
    # =========================================================================
    database_url: str = Field(
        default="postgresql+psycopg://lumen:lumen_secret@localhost:5432/lumen_db"
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        """Converte o formato padrão do Railway/Render (postgresql://) para psycopg3."""
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    database_pool_size: int = Field(default=5)
    database_max_overflow: int = Field(default=10)
    redis_url: str = Field(default="redis://localhost:6379/0")

    # =========================================================================
    # INTEGRATIONS
    # =========================================================================
    firebase_project_id: str = Field(default="")

    # Sentry (opcional — monitoramento de erros)
    sentry_dsn: str = Field(default="")

    # Web Push (VAPID)
    vapid_private_key: str = Field(default="")
    vapid_public_key: str = Field(default="")
    vapid_email: str = Field(default="mailto:admin@example.com")

    # E-mail transacional (SendGrid)
    sendgrid_api_key: str = Field(default="")
    sendgrid_from_email: str = Field(default="noreply@example.com")
    sendgrid_from_name: str = Field(default="Lumen+")

    # Cloudinary (upload de comprovantes de retiro)
    cloudinary_cloud_name: str = Field(default="")
    cloudinary_api_key: str = Field(default="")
    cloudinary_api_secret: str = Field(default="")

    # =========================================================================
    # FEATURE FLAGS
    # =========================================================================
    enable_dev_endpoints: bool = Field(default=False)  # SEGURANÇA: fail-closed
    enable_audit: bool = Field(default=True)
    enable_phone_verification: bool = Field(default=True)
    enable_email_verification: bool = Field(default=True)
    enable_sensitive_access: bool = Field(default=True)
    debug_verification_code: bool = Field(default=False)  # SEGURANÇA: fail-closed — nunca expor OTP em prod

    # =========================================================================
    # RATE LIMITING
    # =========================================================================
    rate_limit_enabled: bool = Field(default=True)
    rate_limit_requests_per_minute: int = Field(default=60)
    # Nº de proxies reversos confiáveis à frente da app (Railway = 1). Usado para
    # extrair o IP real do X-Forwarded-For a partir da DIREITA (o valor à esquerda
    # é controlado pelo cliente). Ajustar se houver CDN/edge adicional na frente.
    trusted_proxy_hops: int = Field(default=1)
    rate_limit_verification_per_hour: int = Field(default=5)

    # =========================================================================
    # INVITES
    # =========================================================================
    invite_expiration_days: int = Field(default=7)

    # =========================================================================
    # COMPUTED
    # =========================================================================
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.environment in ("dev", "test")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def validate_production_settings(self) -> list[str]:
        """Valida configurações críticas. Em produção, erros são FATAIS (abortam o processo)."""
        errors = []
        if self.is_production:
            if "change-me" in self.secret_key:
                errors.append("SECRET_KEY deve ser alterado em produção")
            if self.auth_mode == "DEV":
                errors.append("AUTH_MODE deve ser PROD em produção")
            if self.enable_dev_endpoints:
                errors.append("ENABLE_DEV_ENDPOINTS deve ser False em produção")
            if self.debug_verification_code:
                errors.append("DEBUG_VERIFICATION_CODE deve ser False em produção")
            if not self.encryption_key:
                errors.append("ENCRYPTION_KEY é obrigatório em produção")
            if not self.hmac_pepper:
                errors.append("HMAC_PEPPER é obrigatório em produção")
            if not self.firebase_project_id:
                errors.append("FIREBASE_PROJECT_ID é obrigatório em produção")
            if "*" in self.cors_origins_list:
                errors.append("CORS_ORIGINS não pode conter '*' em produção")
            for origin in self.cors_origins_list:
                if not origin.startswith("https://"):
                    errors.append(f"CORS origin deve usar HTTPS em produção: {origin}")
        return errors


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
