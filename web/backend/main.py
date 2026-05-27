"""
FastAPI application — Fitness Dashboard Backend
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Carrega .env da raiz do projeto (dois níveis acima de backend/)
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from database import init_db
from routers import profile, meals, health, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa o banco de dados ao subir a aplicação."""
    await init_db()
    yield


app = FastAPI(
    title="Fitness Dashboard API",
    description="Backend para rastreamento de déficit calórico com Samsung Health e IA",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(profile.router, prefix="/api", tags=["Perfil"])
app.include_router(meals.router, prefix="/api", tags=["Refeições"])
app.include_router(health.router, prefix="/api", tags=["Samsung Health"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Fitness Dashboard API",
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
