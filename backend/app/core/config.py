from pydantic_settings import BaseSettings
from pydantic import model_validator
import warnings


class Settings(BaseSettings):
    PROJECT_NAME: str = "TenderGuard Pro"
    API_V1_STR: str = "/api/v1"

    # Runtime
    ENVIRONMENT: str = "dev"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: str = "http://localhost:3000"
    FRONTEND_APP_URL: str = "http://localhost:3000"
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = "no-reply@tenderguard.local"

    # Security
    SECRET_KEY: str = "t3nd3rgu4rd_s3cur3_k3y_123!"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    REGISTER_RATE_LIMIT: int = 10
    LOGIN_RATE_LIMIT: int = 20
    AUTH_RATE_WINDOW_SECONDS: int = 60

    # Postgres
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "tenderadmin"
    POSTGRES_PASSWORD: str = "tenderpassword"
    POSTGRES_DB: str = "tenderguard"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    STORAGE_DIR: str = "./storage"

    # Firebase storage support for document uploads
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CLIENT_EMAIL: str = ""
    FIREBASE_PRIVATE_KEY: str = ""
    FIREBASE_PRIVATE_KEY_ID: str = ""
    FIREBASE_CLIENT_ID: str = ""
    FIREBASE_STORAGE_BUCKET: str = ""

    # AI pipeline hook for document ingestion
    DOCUMENT_AI_ENABLED: bool = False
    GEMINI_API_KEY: str = ""

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

    @model_validator(mode="after")
    def _validate_secret_key(self):
        default = "t3nd3rgu4rd_s3cur3_k3y_123!"
        if self.SECRET_KEY == default and self.ENVIRONMENT != "dev":
            warnings.warn(
                "SECRET_KEY is set to the default insecure value. "
                "Override it via the SECRET_KEY environment variable before deploying.",
                stacklevel=2,
            )
        return self

settings = Settings()
