# Script de referencia: commits semanticos (9) para ejecutar en orden.
# Ejecutar desde la raiz del repo: simac-homogenizador

# 1) Base del proyecto
git add .gitignore backend/requirements.txt backend/app/database.py
git commit -m "chore: bootstrap estructura base y configuracion inicial"

# 2) Modelo y acceso DB
git add backend/app/database.py backend/app/models.py
git commit -m "feat: agregar persistencia async y modelo Calculation"

# 3) Algoritmo de homogenizacion
git add backend/app/interpolator.py
git commit -m "feat: implementar algoritmo de homogenizacion cincominutal"

# 4) API REST
git add backend/app/main.py
git commit -m "feat: exponer endpoints /homogenize y /history"

# 5) Frontend base y servicios
git add frontend/src/types.ts frontend/src/services/api.ts frontend/src/components/FileUpload.tsx
git commit -m "feat: agregar carga de JSON e integracion API"

# 6) Visualizacion de datos
git add frontend/src/components/DataTable.tsx frontend/src/components/TempChart.tsx frontend/src/App.tsx
git commit -m "feat: agregar tabla comparativa y grafica de temperatura"

# 7) Orquestacion Docker
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile frontend/nginx.conf
git commit -m "feat: configurar docker compose con frontend backend y db"

# 8) Optimizacion de build docker
git add backend/.dockerignore frontend/.dockerignore .env.example
git commit -m "chore: optimizar contextos docker y variables de entorno"

# 9) Documentacion y dataset de prueba
git add README.md test_data.json scripts/semantic_commits.ps1
git commit -m "docs: completar guia final y datos de prueba"

# Push final
git push origin main
