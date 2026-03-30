"""schemas/auth.py — Pydantic request/response models for the auth API."""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, field_validator


# ── Request bodies ─────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "company"
    company_name: str | None = None
    registration_number: str | None = None
    phone: str | None = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class VerifyEmailRequest(BaseModel):
    token: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UpdateProfileRequest(BaseModel):
    name: str


class AdminDecisionRequest(BaseModel):
    reason: str | None = None


# ── Response bodies ────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    verificationStatus: str
    onboardingCompleted: bool = True


class TokenResponse(BaseModel):
    token: str
    user: UserResponse


class RegisterResponse(BaseModel):
    status: str
    message: str
    verifyLink: str | None = None
    user: dict  # lightweight — full UserResponse not needed at registration


class RefreshResponse(BaseModel):
    token: str
