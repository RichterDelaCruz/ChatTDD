#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    echo "DEEPSEEK_API_KEY=" > .env
    echo "Please add your DEEPSEEK_API_KEY to the .env file"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Start the development server
echo "Starting development server..."
npm run dev
