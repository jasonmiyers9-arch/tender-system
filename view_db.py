import asyncio
import sys
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.domain import Company, CompanyMembership

async def list_tables():
    """Show all tables in the database"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """))
        tables = result.fetchall()
        print("\n=== DATABASE TABLES ===")
        for table in tables:
            print(f"  - {table[0]}")
        print()

async def view_users():
    """Show all users"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).order_by(User.id))
        users = result.scalars().all()
        
        print("\n=== USERS ===")
        print(f"{'ID':<5} {'Email':<35} {'Role':<12} {'Status':<12} {'Verified':<10}")
        print("-" * 90)
        for user in users:
            verified = "Yes" if user.is_verified else "No"
            print(f"{user.id:<5} {user.email:<35} {user.role.value:<12} {user.verification_status:<12} {verified:<10}")
        print(f"\nTotal users: {len(users)}\n")

async def view_companies():
    """Show all companies"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Company).order_by(Company.id))
        companies = result.scalars().all()
        
        print("\n=== COMPANIES ===")
        print(f"{'ID':<5} {'Name':<40} {'Reg Number':<20} {'Onboarding':<12}")
        print("-" * 90)
        for company in companies:
            onboarding = "Done" if company.onboarding_completed else "Pending"
            reg = company.reg_number or "N/A"
            print(f"{company.id:<5} {company.name:<40} {reg:<20} {onboarding:<12}")
        print(f"\nTotal companies: {len(companies)}\n")

async def view_memberships():
    """Show company memberships"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(CompanyMembership, User.email, Company.name)
            .join(User, CompanyMembership.user_id == User.id)
            .join(Company, CompanyMembership.company_id == Company.id)
            .order_by(CompanyMembership.id)
        )
        rows = result.all()
        
        print("\n=== COMPANY MEMBERSHIPS ===")
        print(f"{'ID':<5} {'User':<35} {'Company':<30} {'Role':<12} {'Status':<12}")
        print("-" * 100)
        for membership, email, company_name in rows:
            print(f"{membership.id:<5} {email:<35} {company_name:<30} {membership.role.value:<12} {membership.status.value:<12}")
        print(f"\nTotal memberships: {len(rows)}\n")

async def run_query(query: str):
    """Run a custom SQL query"""
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(text(query))
            rows = result.fetchall()
            
            if rows:
                print(f"\n=== QUERY RESULTS ({len(rows)} rows) ===\n")
                # Print column names
                if hasattr(result, 'keys'):
                    columns = result.keys()
                    print(" | ".join(str(c) for c in columns))
                    print("-" * 80)
                
                # Print rows
                for row in rows[:50]:  # Limit to 50 rows
                    print(" | ".join(str(col) for col in row))
                
                if len(rows) > 50:
                    print(f"\n... and {len(rows) - 50} more rows")
            else:
                print("\nQuery executed successfully. No rows returned.\n")
                
        except Exception as e:
            print(f"Error: {e}")

async def make_admin(email: str):
    """Make a user an admin"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if user:
            old_role = user.role.value
            user.role = UserRole.admin
            await db.commit()
            print(f"\n[OK] {email} role changed from '{old_role}' to 'admin'\n")
        else:
            print(f"\n[ERROR] User {email} not found\n")

async def main():
    if len(sys.argv) < 2:
        print("""
TenderGuard Database Viewer

Usage:
  python view_db.py users              - View all users
  python view_db.py companies          - View all companies
  python view_db.py memberships        - View company memberships
  python view_db.py tables             - List all tables
  python view_db.py query "SQL"        - Run custom SQL query
  python view_db.py make-admin EMAIL   - Make user an admin

Examples:
  python view_db.py users
  python view_db.py query "SELECT * FROM users WHERE role = 'admin'"
  python view_db.py make-admin sinethemba@gmail.com
""")
        return
    
    command = sys.argv[1].lower()
    
    if command == "users":
        await view_users()
    elif command == "companies":
        await view_companies()
    elif command == "memberships":
        await view_memberships()
    elif command == "tables":
        await list_tables()
    elif command == "query":
        if len(sys.argv) < 3:
            print("Usage: python view_db.py query \"SELECT * FROM users\"")
            return
        await run_query(sys.argv[2])
    elif command == "make-admin":
        if len(sys.argv) < 3:
            print("Usage: python view_db.py make-admin EMAIL")
            return
        await make_admin(sys.argv[2])
    else:
        print(f"Unknown command: {command}")
        print("Run 'python view_db.py' for usage help")

if __name__ == "__main__":
    asyncio.run(main())
