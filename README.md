# SIMAC - Sistema de Homogenizacion Climatica

Proyecto Fullstack para transformar series meteorologicas irregulares en series cincominutales aplicando reglas de proximidad e interpolacion lineal.

Repositorio publico: [SIMAC](https://github.com/Bdavid117/SIMAC)

## Estado actual

- FASE 1: completada (estructura base, base de datos y configuracion inicial)
- FASE 2: completada (algoritmo de homogenizacion + API REST)
- FASE 3: completada (frontend React con carga, tabla comparativa y grafica)
- FASE 4: pendiente (docker-compose + Dockerfiles productivos + nginx proxy)
- FASE 5: pendiente (documentacion final, test_data y estrategia de commits finales)

## Stack tecnologico

- Backend: Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2.0 async, asyncpg, Pydantic
- Frontend: React 18, Vite, TypeScript, Axios, Chart.js, react-chartjs-2, TailwindCSS (CDN)
- Base de datos: PostgreSQL 15
- Infraestructura objetivo: Docker Compose + Nginx

## Arquitectura de carpetas

```text
simac-homogenizador/
├── backend/
│   ├── app/
│   │   ├── database.py
│   │   ├── interpolator.py
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.tsx
│   │   └── types.ts
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

## API disponible

- `POST /homogenize`: recibe datos crudos (array JSON o `{ "data": [...] }`) y retorna `{ id, processed_data }`
- `GET /history`: retorna los ultimos 10 calculos persistidos
- `GET /health`: estado de servicio

## Reglas del algoritmo (resumen)

Para cada marca cincominutal objetivo `t` y variable:

- `Δt1 < 2.5` y `Δt2 < 2.5`: interpolacion lineal
- `Δt1 < 2.5` y `Δt2 > 5`: tomar dato anterior
- `Δt1 > 5` y `Δt2 < 2.5`: tomar dato siguiente
- otro caso: `ND`

Se ignoran `ND` y nulos al buscar candidatos anterior/siguiente.

## Ejecucion local (sin Docker)

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt

# Configurar variable DATABASE_URL si aplica.
# Ejemplo: postgresql+asyncpg://postgres:postgres@localhost:5432/simac

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend consume por defecto `http://localhost:8000`.

## Notas

- La orquestacion Docker se completara en la FASE 4.
- La documentacion final de entrega (curl, JSON de prueba, validaciones) se cerrara en la FASE 5.
