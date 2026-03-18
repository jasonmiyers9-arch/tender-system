from pydantic_settings import BaseSettings


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
    POSTGRES_USER: str = "tenderadmin"
    POSTGRES_PASSWORD: str = "tenderpassword"
    POSTGRES_DB: str = "tenderguard"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    STORAGE_DIR: str = "./storage"

    class Config:
        case_sensitive = True


settings = Settings()
