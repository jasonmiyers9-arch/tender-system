from datetime import datetime, timedelta, timezone
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.api.deps import get_current_user, require_admin, write_audit_log
from app.models.domain import CompanyMembership, MembershipRole, MembershipStatus, PasswordResetToken
from app.models.user import Company, User, UserRole
from app.services.auth_service import enforce_rate_limit, get_owner_company, map_registration_role
from app.services.email_service import send_password_reset_email, send_verification_email

logger = logging.getLogger("tenderguard.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "company"
    company_name: str | None = None
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


@router.post("/register")
async def register(
    payload: RegisterIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "register", settings.REGISTER_RATE_LIMIT)
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    mapped_role = map_registration_role(payload.role)

    user = User(
        email=payload.email,
        password_hash=security.hash_password(payload.password),
        role=mapped_role,
        is_verified=False,
        email_verified=False,
        verification_status="pending",
        full_name=payload.name,
    )
    db.add(user)
    await db.flush()

    if mapped_role != UserRole.admin:
        company_name = (payload.company_name or "").strip()
        if not company_name:
            raise HTTPException(status_code=400, detail="Company name is required")

        company = Company(
            name=company_name,
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

    # Send email verification (non-blocking)
    verify_token = security.create_email_verify_token(user.id, user.email)
    verify_link = f"{settings.FRONTEND_APP_URL}/verify-email?token={verify_token}"
    await send_verification_email(user.email, verify_link)

    return {
        "status": "pending",
        "message": "Account created. Please check your email to verify your address.",
        "verifyLink": verify_link if not settings.SENDGRID_API_KEY else None,
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
    token_payload = security.decode_token(payload.token, "email_verify")
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
    await enforce_rate_limit(request, "login", settings.LOGIN_RATE_LIMIT)
    user = await db.scalar(select(User).where(User.email == payload.email))
    if not user or not security.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.password_hash.startswith("dev$"):
        user.password_hash = security.hash_password(payload.password)
        await db.commit()

    if user.verification_status == "rejected":
        raise HTTPException(status_code=403, detail="account_rejected")

    company = await get_owner_company(db, user.id)

    access_token = security.create_access_token(user.id, user.email, user.role.value, settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token = security.create_refresh_token(user.id, user.email, user.role.value)

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

    payload = security.decode_token(token, "refresh")
    user = await db.get(User, int(payload["sub"]))
    if not user or user.verification_status != "approved":
        raise HTTPException(status_code=401, detail="Invalid session")

    access_token = security.create_access_token(user.id, user.email, user.role.value, settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {"token": access_token}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token", path="/auth")
    return {"ok": True}


@router.get("/me")
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    company = await get_owner_company(db, user.id)
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
    await write_audit_log(db, actor_email=_admin.email, action="APPROVE", entity="User",
                          entity_id=str(user_id))
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


# ---------------------------------------------------------------------------
# Password reset flow
# ---------------------------------------------------------------------------

class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    password: str


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordIn,
    db: AsyncSession = Depends(get_db),
):
    """Issue a password reset token. Always returns success to prevent email enumeration."""
    user = await db.scalar(select(User).where(User.email == payload.email))
    if user:
        # Expire any existing tokens for this user
        existing = (await db.scalars(
            select(PasswordResetToken).where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used.is_(False),
            )
        )).all()
        for t in existing:
            t.used = True

        raw_token = secrets.token_urlsafe(48)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token=raw_token,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            )
        )
        await db.commit()

        reset_link = f"{settings.FRONTEND_APP_URL}/reset-password?token={raw_token}"
        await send_password_reset_email(user.email, reset_link)

    return {
        "ok": True,
        "message": "If that email is registered you will receive a reset link shortly.",
    }


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordIn,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    token_row = await db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token == payload.token,
            PasswordResetToken.used.is_(False),
        )
    )
    if not token_row or token_row.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = await db.get(User, token_row.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user.password_hash = security.hash_password(payload.password)
    token_row.used = True
    await db.commit()
    return {"ok": True, "message": "Password updated successfully. You can now log in."}
