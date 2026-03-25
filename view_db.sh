#!/bin/bash
# View TenderGuard Database
# Usage: ./view_db.sh [table_name]

TABLE=${1:-users}

echo "Connecting to TenderGuard database..."
echo "Table: $TABLE"
echo ""

# Using psql (if installed)
if command -v psql &> /dev/null; then
    PGPASSWORD=tenderpassword psql -h localhost -p 5432 -U tenderadmin -d tenderguard -c "SELECT * FROM $TABLE LIMIT 20;"
else
    echo "psql not found. Install PostgreSQL client or use Python script:"
    echo "  python view_db.py $TABLE"
fi
