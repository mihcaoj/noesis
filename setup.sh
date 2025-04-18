#!/bin/bash

##### This script sets up the development environment with Docker and populates the database with test data, then starts the frontend #####

# Set error handling
set -e

echo "********** SETTING UP ENVIRONMENT...**********"

# Check for reset flag
if [ "$1" == "--reset" ]; then
    echo "Resetting database..."
    docker-compose down -v
    echo "Removed containers and volumes."
fi

echo "********** STARTING DOCKER CONTAINERS... **********"
docker-compose up -d

echo "********** RUNNING DATABASE MIGRATIONS... **********"
docker-compose exec django-backend python manage.py migrate

echo "********** CREATING A SUPERUSER... **********"
docker-compose exec django-backend python manage.py shell -c "
from django.contrib.auth import get_user_model;
User = get_user_model();
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Admin user created.')
else:
    print('Admin user already exists.')
"

echo "********** POPULATING THE DATABASE WITH TEST DATA... **********"
docker-compose exec django-backend python /app/populate_app.py

echo "SETUP COMPLETE!"
echo ""
echo "Admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "The backend is running at: http://localhost:8000"
echo "The admin interface is at: http://localhost:8000/admin/"
echo ""

# Check if frontend directory exists
if [ -d "frontend" ]; then
    echo "Starting React frontend..."

    # Check if running inside container or on host system
    if [ -f "frontend/package.json" ]; then
        cd frontend

        # Install dependencies if node_modules doesn't exist
        if [ ! -d "node_modules" ]; then
            echo "Installing frontend dependencies..."
            npm install
        fi

        # Start the React development server
        echo "Starting React development server..."
        npm start &

        echo "Frontend should be available at: http://localhost:3000"
    else
        echo "Frontend package.json not found. Skipping frontend startup."
    fi
else
    echo "Frontend directory not found. Skipping frontend startup."
fi

echo ""
echo "To stop the containers, run: docker-compose down"
echo "To reset the database completely, run: ./setup_dev_environment.sh --reset"
