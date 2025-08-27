#!/bin/bash

# Run database migration for enhanced email caching

echo "Running email cache enhancement migration..."

# Load environment variables
source .env

# Run the migration
psql $DATABASE_URL < migrations/001_enhanced_email_cache.sql

if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
else
    echo "Migration failed. Please check the error messages above."
    exit 1
fi

echo "Database schema has been updated with:"
echo "- Enhanced cached_emails table with compression and expiration"
echo "- Email attachments table"
echo "- Email sync status tracking"
echo "- Email folders mapping"
echo "- Background sync jobs table"
echo ""
echo "Next steps:"
echo "1. Restart the backend server to enable background jobs"
echo "2. The system will automatically start syncing emails"
echo "3. Frontend will use the new lazy-loading components"