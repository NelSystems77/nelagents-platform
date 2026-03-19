#!/bin/bash

# Script de inicio rápido para NEL SYSTEMS - Plataforma de Agentes
# Este script configura el proyecto completo en un nuevo ambiente

set -e

echo "🚀 NEL SYSTEMS - Plataforma de Agentes Inteligentes"
echo "=================================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar dependencias
echo "📋 Verificando dependencias..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠️  pnpm no está instalado. Instalando...${NC}"
    npm install -g pnpm
fi

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 no está instalado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencias verificadas${NC}"
echo ""

# Copiar .env.example a .env si no existe
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Por favor edita .env con tus credenciales antes de continuar${NC}"
    echo ""
    read -p "Presiona Enter cuando hayas configurado .env..."
fi

# Instalar dependencias de Node.js
echo "📦 Instalando dependencias de Node.js..."
pnpm install

# Generar cliente Prisma
echo "🔧 Generando cliente Prisma..."
pnpm db:generate

# Preguntar si ejecutar migraciones
echo ""
read -p "¿Deseas ejecutar las migraciones de base de datos? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️  Ejecutando migraciones..."
    pnpm db:migrate
    
    read -p "¿Deseas cargar datos de prueba? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🌱 Cargando datos de prueba..."
        cd packages/db
        pnpm seed
        cd ../..
        echo -e "${GREEN}✅ Datos de prueba cargados${NC}"
        echo ""
        echo "📝 Credenciales de demo:"
        echo "   Admin: admin@demo.com / demo123"
        echo "   Staff: staff@demo.com / staff123"
    fi
fi

# Configurar Python (agentes)
echo ""
echo "🐍 Configurando entorno Python para agentes..."
cd services/agents

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt

cd ../..

echo ""
echo -e "${GREEN}✅ Instalación completada${NC}"
echo ""
echo "🎯 Próximos pasos:"
echo ""
echo "1. Inicia el frontend:"
echo "   pnpm dev"
echo ""
echo "2. En otra terminal, inicia los agentes Python:"
echo "   cd services/agents"
echo "   source venv/bin/activate"
echo "   python main.py"
echo ""
echo "3. Abre tu navegador en http://localhost:3000"
echo ""
echo "📚 Para más información, consulta el README.md"
echo ""
