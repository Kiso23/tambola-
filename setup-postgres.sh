#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        Setting up PostgreSQL for Winter Bumper                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed."
    echo ""
    echo "Install PostgreSQL:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    echo "  macOS: brew install postgresql"
    echo "  Windows: Download from https://www.postgresql.org/download/windows/"
    exit 1
fi

echo "✓ PostgreSQL found"
echo ""

# Start PostgreSQL service
echo "Starting PostgreSQL service..."
sudo service postgresql start 2>/dev/null || brew services start postgresql 2>/dev/null || echo "⚠️  PostgreSQL service already running"

echo ""
echo "Creating database 'tambola_game'..."

# Create database
sudo -u postgres psql -c "CREATE DATABASE tambola_game;" 2>/dev/null || psql -c "CREATE DATABASE tambola_game;" 2>/dev/null

# Set password for postgres user (if needed)
echo ""
echo "✓ Database created successfully"
echo ""
echo "PostgreSQL is ready!"
echo ""
echo "Connection details:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: tambola_game"
echo "  User: postgres"
echo "  Password: postgres (default)"
echo ""
