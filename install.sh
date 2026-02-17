#!/usr/bin/env bash
set -euo pipefail

# install.sh
# Automated installation script for Docker and Docker Compose on Debian/Ubuntu systems.

echo "Starting installation process..."

# 1. OS Detection (Basic check for Debian/Ubuntu)
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
    echo "Detected OS: $OS $VER"
    if [[ "$ID" != "debian" && "$ID" != "ubuntu" && "$ID_LIKE" != *"debian"* && "$ID_LIKE" != *"ubuntu"* ]]; then
        echo "⚠️  Warning: This script is optimized for Debian/Ubuntu. Your system ($ID) might require different steps."
        read -p "Press Enter to continue anyway, or Ctrl+C to abort..."
    fi
else
    echo "❌ Error: Cannot detect OS. /etc/os-release not found."
    exit 1
fi

# 2. Check for curl
if ! command -v curl >/dev/null 2>&1; then
    echo "Installing curl..."
    sudo apt-get update && sudo apt-get install -y curl
fi

# 3. install Docker
if command -v docker >/dev/null 2>&1; then
    echo "✅ Docker is already installed."
else
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    echo "✅ Docker installed successfully."
fi

# 4. Post-installation steps (Manage Docker as a non-root user)
if getent group docker >/dev/null 2>&1; then
    if groups "$USER" | grep &>/dev/null "\bdocker\b"; then
        echo "✅ User '$USER' is already in the 'docker' group."
    else
        echo "Adding user '$USER' to the 'docker' group..."
        sudo usermod -aG docker "$USER"
        echo "⚠️  You will need to log out and log back in for this change to take effect."
    fi
else
    echo "Creating 'docker' group and adding user..."
    sudo groupadd docker
    sudo usermod -aG docker "$USER"
    echo "⚠️  You will need to log out and log back in for this change to take effect."
fi

# 5. Check Docker Compose
if docker compose version >/dev/null 2>&1; then
    echo "✅ Docker Compose plugin is installed."
else
    echo "⚠️  Docker Compose plugin seems missing even after Docker installation."
    echo "Attempting to install 'docker-compose-plugin' via apt..."
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin
fi

echo "Detailed verification:"
docker --version
docker compose version

echo "=========================================="
echo "Installation complete!"
echo "If you saw a warning about group membership, please log out and log back in."
echo "Then run './start.sh' to check requirements and start the app."
echo "=========================================="
