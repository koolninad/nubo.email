#!/bin/bash

# Migrate data from Docker PostgreSQL to native PostgreSQL

echo "================================================"
echo "   Data Migration Script"
echo "================================================"

# Step 1: Export data from Docker PostgreSQL (if exists)
if docker ps | grep -q postgres; then
    echo "Exporting data from Docker PostgreSQL..."
    
    # Export database
    docker exec nubo-postgres pg_dump -U nubo nubo > /tmp/nubo_backup.sql
    
    echo "Data exported to /tmp/nubo_backup.sql"
    
    # Import to native PostgreSQL
    echo "Importing data to native PostgreSQL..."
    sudo -u postgres psql nubo_email < /tmp/nubo_backup.sql
    
    echo "Data migration complete!"
else
    echo "No Docker PostgreSQL container found, skipping migration"
fi

# Show user count
echo ""
echo "Checking migrated data..."
sudo -u postgres psql -d nubo_email -c "SELECT COUNT(*) as user_count FROM users;"