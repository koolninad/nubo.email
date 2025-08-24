#!/bin/bash

# Push Nubo images to Docker Hub

echo "🚀 Pushing Nubo images to Docker Hub..."
echo ""

# Check if logged in
echo "Checking Docker Hub login..."
if ! docker info 2>/dev/null | grep -q "Username:"; then
    echo "Please log in to Docker Hub:"
    docker login
fi

echo ""
echo "📦 Pushing backend image..."
docker push koolninad/nubo-backend:latest

echo ""
echo "📦 Pushing frontend image..."
docker push koolninad/nubo-frontend:latest

echo ""
echo "✅ Images successfully pushed!"
echo ""
echo "Images are now available at:"
echo "  - docker.io/koolninad/nubo-backend:latest"
echo "  - docker.io/koolninad/nubo-frontend:latest"
echo ""
echo "You can now run 'docker compose pull' on your server!"
