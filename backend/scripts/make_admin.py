import asyncio
import sys
sys.path.insert(0, 'C:\\Users\\ngwen\\OneDrive\\Documentos\\projects\\tender-system-main\\backend')

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole

async def make_admin(email: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if user:
            print(f'Found user: {user.email}, current role: {user.role}')
            if user.role == UserRole.admin:
                print('User is already an admin!')
            else:
                user.role = UserRole.admin
                await db.commit()
                print(f'[OK] Updated {email} to admin role')
        else:
            print(f'[NOT FOUND] User {email} not found')
            print('\\nAvailable users:')
            result = await db.execute(select(User))
            for u in result.scalars():
                print(f'  - {u.email} ({u.role.value})')

if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "sinethemba@tenderguard.co.za"
    asyncio.run(make_admin(email))
