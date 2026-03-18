import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User


def _get_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization.split(" ", 1)[1]


def _decode_access(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _get_bearer(authorization)
    payload = _decode_access(token)
    user = await db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_user_id(
    authorization: str | None = Header(default=None),
) -> int:
    token = _get_bearer(authorization)
    payload = _decode_access(token)
    try:
        return int(payload["sub"])
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(status_code=401, detail="Invalid token subject") from exc


async def require_admin(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _get_bearer(authorization)
    payload = _decode_access(token)
    user = await db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user
