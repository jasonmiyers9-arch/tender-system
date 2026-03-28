"""
Seed demo users: Mouse (admin) and Vusu (evaluator).
Run from the backend folder:
  python seed_demo_users.py
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select, text

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings
from app.core import security
from app.models.user import User, UserRole
from app.db.base import Base

DEMO_USERS = [
    {
        "full_name": "Mouse",
        "email": "mouse@tenderguard.dev",
        "password": "Demo@1234",
        "role": UserRole.admin,
    },
    {
        "full_name": "Vusu",
        "email": "vusu@tenderguard.dev",
        "password": "Demo@1234",
        "role": UserRole.evaluator,
    },
]


async def seed():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async with AsyncSession(engine) as session:
        for demo in DEMO_USERS:
            existing = await session.scalar(select(User).where(User.email == demo["email"]))
            if existing:
                # Ensure they're approved even if previously seeded as pending
                existing.verification_status = "approved"
                existing.email_verified = True
                existing.password_hash = security.hash_password(demo["password"])
                print(f"  Updated  : {demo['email']} ({demo['role'].value})")
            else:
                user = User(
                    full_name=demo["full_name"],
                    email=demo["email"],
                    password_hash=security.hash_password(demo["password"]),
                    role=demo["role"],
                    is_verified=True,
                    email_verified=True,
                    verification_status="approved",
                )
                session.add(user)
                print(f"  Created  : {demo['email']} ({demo['role'].value})")
        await session.commit()
    await engine.dispose()
    print("\nDemo users ready.")
    print("  mouse@tenderguard.dev  /  Demo@1234  (Admin)")
    print("  vusu@tenderguard.dev   /  Demo@1234  (Evaluator)")


if __name__ == "__main__":
    asyncio.run(seed())
