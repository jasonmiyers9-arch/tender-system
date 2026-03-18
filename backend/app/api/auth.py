from datetime import datetime, timedelta, timezone

import hashlib
import secrets

import jwt
import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
import json
import urllib.request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.api.deps import get_current_user, require_admin
from app.models.domain import CompanyMembership, MembershipRole, MembershipStatus
from app.models.user import Company, User, UserRole

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_name: str
    registration_number: str | None = None
    phone: str | None = None


class VerifyEmailIn(BaseModel):
    token: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AdminDecisionIn(BaseModel):
    reason: str | None = None


class RefreshOut(BaseModel):
    token: str


class UpdateProfileIn(BaseModel):
    name: str


async def _enforce_rate_limit(request: Request, bucket: str, limit: int) -> None:
    ip = request.client.host if request.client else "unknown"
    key = f"rate:{bucket}:{ip}"
    client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        count = await client.incr(key)
        if count == 1:
            await client.expire(key, settings.AUTH_RATE_WINDOW_SECONDS)
        if count > limit:
            raise HTTPException(status_code=429, detail="Too many requests")
    finally:
        await client.aclose()


def _hash_password(password: str) -> str:
    iterations = 390000
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${dk.hex()}"


def _verify_password(password: str, hashed: str) -> bool:
    if hashed.startswith("dev$"):
        return hashed == f"dev${password}"
    if hashed.startswith("pbkdf2_sha256$"):
        try:
            _, iter_s, salt, digest = hashed.split("$", 3)
            dk = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                salt.encode("utf-8"),
                int(iter_s),
            )
            return secrets.compare_digest(digest, dk.hex())
        except Exception:
            return False
    return False


def _create_token(user: User, token_type: str, minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def _decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload


def _create_email_verify_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "type": "email_verify",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=15)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def _send_verification_email(email: str, verify_link: str) -> None:
    if not settings.SENDGRID_API_KEY:
        return
    payload = {
        "personalizations": [{"to": [{"email": email}]}],
        "from": {"email": settings.SENDGRID_FROM_EMAIL},
        "subject": "Verify your TenderGuard account",
        "content": [
            {
                "type": "text/plain",
                "value": f"Verify your email within 15 minutes: {verify_link}",
            }
        ],
    }
    req = urllib.request.Request(
        "https://api.sendgrid.com/v3/mail/send",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10):
            pass
    except Exception:
        # Keep registration non-blocking if email provider fails.
        return


async def _get_owner_company(db: AsyncSession, user_id: int) -> Company | None:
    return await db.scalar(
        select(Company)
        .join(CompanyMembership, CompanyMembership.company_id == Company.id)
        .where(CompanyMembership.user_id == user_id)
        .order_by(Company.id.asc())
        .limit(1)
    )


@router.post("/register")
async def register(
    payload: RegisterIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await _enforce_rate_limit(request, "register", settings.REGISTER_RATE_LIMIT)
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=_hash_password(payload.password),
        role=UserRole.user,
        is_verified=False,
        email_verified=False,
        verification_status="pending",
        full_name=payload.name,
    )
    db.add(user)
    await db.flush()

    company = Company(
        name=payload.company_name,
        reg_number=(payload.registration_number or "").strip() or None,
        phone=(payload.phone or "").strip() or None,
        contact_email=payload.email,
    )
    db.add(company)
    await db.flush()

    membership = CompanyMembership(
        user_id=user.id,
        company_id=company.id,
        role=MembershipRole.owner,
        status=MembershipStatus.active,
    )
    db.add(membership)
    await db.commit()

    verify_token = _create_email_verify_token(user)
    verify_link = f"{settings.FRONTEND_APP_URL}/verify-email?token={verify_token}"
    _send_verification_email(user.email, verify_link)

    return {
        "status": "pending_verification",
        "message": "Account created. Please verify your email, then wait for admin approval.",
        "verifyLink": verify_link if settings.ENVIRONMENT == "dev" else None,
        "user": {
            "id": str(user.id),
            "name": user.full_name,
            "email": user.email,
            "role": user.role.value,
            "verificationStatus": user.verification_status,
        },
    }


@router.post("/verify-email")
async def verify_email(payload: VerifyEmailIn, db: AsyncSession = Depends(get_db)):
    token_payload = _decode_token(payload.token, "email_verify")
    user = await db.get(User, int(token_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.email_verified = True
    await db.commit()
    return {"ok": True}


@router.post("/login")
async def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    await _enforce_rate_limit(request, "login", settings.LOGIN_RATE_LIMIT)
    user = await db.scalar(select(User).where(User.email == payload.email))
    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.password_hash.startswith("dev$"):
        user.password_hash = _hash_password(payload.password)
        await db.commit()

    if not user.email_verified and user.verification_status == "approved":
        user.email_verified = True
        await db.commit()

    if not user.email_verified:
        raise HTTPException(status_code=403, detail="account_email_unverified")

    if user.verification_status != "approved":
        raise HTTPException(status_code=403, detail=f"account_{user.verification_status}")

    company = await _get_owner_company(db, user.id)

    access_token = _create_token(user, "access", settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token = _create_token(user, "refresh", 60 * 24 * 14)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 60 * 24 * 14,
        path="/auth",
    )

    return {
        "token": access_token,
        "user": {
            "id": str(user.id),
            "name": user.full_name or user.email.split("@")[0],
            "email": user.email,
            "role": user.role.value,
            "verificationStatus": user.verification_status,
            "onboardingCompleted": bool(company.onboarding_completed) if company else True,
        },
    }


@router.post("/refresh", response_model=RefreshOut)
async def refresh(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    payload = _decode_token(token, "refresh")
    user = await db.get(User, int(payload["sub"]))
    if not user or user.verification_status != "approved":
        raise HTTPException(status_code=401, detail="Invalid session")

    access_token = _create_token(user, "access", settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {"token": access_token}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token", path="/auth")
    return {"ok": True}


@router.get("/me")
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    company = await _get_owner_company(db, user.id)
    return {
        "id": str(user.id),
        "name": user.full_name or user.email.split("@")[0],
        "email": user.email,
        "role": user.role.value,
        "verificationStatus": user.verification_status,
        "onboardingCompleted": bool(company.onboarding_completed) if company else True,
    }


@router.patch("/me")
async def update_me(
    payload: UpdateProfileIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    user.full_name = name
    await db.commit()
    await db.refresh(user)
    return {
        "id": str(user.id),
        "name": user.full_name or user.email.split("@")[0],
        "email": user.email,
        "role": user.role.value,
        "verificationStatus": user.verification_status,
    }


@router.get("/admin/accounts")
async def admin_accounts(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    status: str | None = None,
):
    q = select(User)
    if status:
        q = q.where(User.verification_status == status)
    users = (await db.scalars(q.order_by(User.created_at.desc()))).all()

    owner_company_map: dict[int, str] = {}
    memberships = (
        await db.execute(
            select(CompanyMembership.user_id, Company.name)
            .join(Company, Company.id == CompanyMembership.company_id)
            .where(CompanyMembership.role == MembershipRole.owner)
        )
    ).all()
    for user_id, company_name in memberships:
        owner_company_map[int(user_id)] = str(company_name)

    now = datetime.now(timezone.utc)
    items = []
    for u in users:
        created_at = u.created_at
        if created_at and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        pending_seconds = 0.0
        if created_at and u.verification_status == "pending":
            pending_seconds = max(0.0, (now - created_at).total_seconds())

        items.append(
            {
                "id": u.id,
                "name": u.full_name or u.email.split("@")[0],
                "email": u.email,
                "role": u.role.value,
                "verificationStatus": u.verification_status,
                "createdAt": created_at.isoformat() if created_at else None,
                "companyName": owner_company_map.get(u.id, "—"),
                "pendingHours": int(pending_seconds // 3600),
                "slaBreached": pending_seconds > 48 * 3600,
            }
        )

    return {"items": items}


@router.post("/admin/accounts/{user_id}/approve")
async def approve_account(
    user_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.verification_status = "approved"
    user.is_verified = True
    user.verified_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.post("/admin/accounts/{user_id}/reject")
async def reject_account(
    user_id: int,
    payload: AdminDecisionIn,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.verification_status = "rejected"
    await db.commit()
    return {"ok": True, "reason": payload.reason}


@router.post("/admin/accounts/{user_id}/reset-pending")
async def reset_account_to_pending(
    user_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.verification_status = "pending"
    user.is_verified = False
    user.verified_at = None
    await db.commit()
    return {"ok": True}
