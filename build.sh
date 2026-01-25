#!/bin/bash
# Script de build pour Render
# Installe les dépendances système nécessaires pour pandas

set -e

echo "Building application..."

# Mettre à jour pip
pip install --upgrade pip setuptools wheel

# Installer les dépendances
pip install -r requirements.txt

echo "Build completed successfully!"
