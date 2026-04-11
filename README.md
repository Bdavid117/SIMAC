# SIMAC - Sistema de Homogenizacion Climatica

Servicio Fullstack para homogenizar datos meteorologicos irregulares a una base temporal cincominutal, aplicando reglas de proximidad e interpolacion lineal.

Repositorio publico: [SIMAC](https://github.com/Bdavid117/SIMAC)

## Stack tecnologico

- Backend: Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2.0 async, asyncpg, Pydantic
- Frontend: React 18, Vite, TypeScript, Axios, Chart.js, react-chartjs-2, TailwindCSS (CDN)
- Base de datos: PostgreSQL 15
- Infraestructura: Docker Compose + Nginx

## Estructura del proyecto

```text
simac-homogenizador/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py
│   │   ├── interpolator.py
│   │   ├── main.py
│   │   └── models.py
│   ├── .dockerignore
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── types.ts
│   ├── .dockerignore
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── scripts/
│   └── semantic_commits.ps1
├── docker-compose.yml
├── test_data.json
└── README.md
```

## Reglas de homogenizacion (cumplimiento PDF)

Para cada marca cincominutal objetivo `t`, se busca dato anterior `t1` y siguiente `t2` (ignorando `ND`/nulos en cada variable):

- `Δt1 < 2.5` y `Δt2 < 2.5` -> interpolacion lineal
  - `f(t) = v1 + (v2 - v1) * (Δt1 / (Δt1 + Δt2))`
- `Δt1 < 2.5` y `Δt2 > 5` -> tomar `v1`
- `Δt1 > 5` y `Δt2 < 2.5` -> tomar `v2`
- cualquier otro caso -> `ND`

## API REST

- `POST /homogenize`
  - Entrada: array JSON de datos crudos
  - Salida: `{ id, processed_data }`
- `GET /history`
  - Retorna ultimos 10 calculos persistidos
- `GET /health`
  - Estado del backend

## Estructura JSON esperada

Cada registro debe incluir fecha y hora con formato `dd/mm/yyyy HH:MM:SS` (en campos separados `Fecha` y `Hora`) y las variables de estacion:

```json
{
  "Fecha": "11/5/2015",
  "Hora": "19:36:21",
  "temp": 16.17,
  "vel_viento": 0,
  "dir_viento": 169,
  "dir_rosa": "S",
  "presion": 594.36,
  "humedad": 94,
  "ppt_cincom": 6.6,
  "rad_solar": 0,
  "evt_cincom": 1.83
}
```

Se incluye archivo de prueba en [test_data.json](test_data.json).

## Ejecucion local (sin Docker)

### 1) PostgreSQL

Crear base `simac` y tener credenciales disponibles para el backend.

### 2) Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt

# Ajustar segun entorno local
set DATABASE_URL=postgresql+asyncpg://postgres:TU_PASSWORD@localhost:5432/simac

uvicorn app.main:app --reload --port 8000
```

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend local: `http://localhost:5173`

## Ejecucion con Docker

### 1) Configuracion de variables

```bash
copy .env.example .env
```

Editar `.env`:

```env
POSTGRES_PASSWORD=tu_password_postgres
```

### 2) Levantar servicios

```bash
docker compose up -d --build
```

### 3) Verificar estado

```bash
docker compose ps
docker compose logs --tail 50 backend
docker compose logs --tail 50 frontend
docker compose logs --tail 50 db
```

### 4) Apagar servicios

```bash
docker compose down
```

## Ejemplos curl

### Health

```bash
curl http://localhost:8000/health
```

### Homogenize

```bash
curl -X POST http://localhost:8000/homogenize \
  -H "Content-Type: application/json" \
  -d @test_data.json
```

### History

```bash
curl http://localhost:8000/history
```

### Via Nginx (proxy /api)

```bash
curl http://localhost/api/health
curl http://localhost/api/history
```

## Estrategia de commits semanticos

Se incluye guion listo para ejecutar en orden en [scripts/semantic_commits.ps1](scripts/semantic_commits.ps1) con 9 commits semanticos.

## Notas de cumplimiento

- Se implementa backend FastAPI con persistencia en PostgreSQL.
- Se implementa frontend con carga de JSON, tabla comparativa y grafica de temperatura.
- La infraestructura contiene exactamente 3 servicios en compose (`frontend`, `backend`, `db`).
- Nginx sirve frontend y proxy de `/api` a backend.
- Se incluye `test_data.json` con datos equivalentes a la Tabla 1 del enunciado.

## Contactos de entrega (segun PDF)

- [ndduqueme@unal.edu.co](mailto:ndduqueme@unal.edu.co)
- [avargase@unal.edu.co](mailto:avargase@unal.edu.co)

