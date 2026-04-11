import logging
import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Integer, desc, func, select, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@db:5432/simac",
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


class Calculation(Base):
    __tablename__ = "calculations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    raw_data: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    processed_data: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    quality_metrics: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


async def init_db() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        # Soporta despliegues existentes sin migraciones alembic.
        await connection.execute(
            text(
                """
                ALTER TABLE calculations
                ADD COLUMN IF NOT EXISTS quality_metrics JSONB NOT NULL DEFAULT '{}'::jsonb
                """
            )
        )
    logger.info("Database initialized")


async def save_calculation(
    raw_data: list[dict[str, Any]],
    processed_data: list[dict[str, Any]],
    quality_metrics: dict[str, Any] | None = None,
) -> Calculation:
    async with AsyncSessionLocal() as session:
        calculation = Calculation(
            raw_data=raw_data,
            processed_data=processed_data,
            quality_metrics=quality_metrics or {},
        )
        session.add(calculation)
        await session.commit()
        await session.refresh(calculation)
        logger.info("Calculation saved with id=%s", calculation.id)
        return calculation


async def get_history(limit: int = 10) -> list[Calculation]:
    async with AsyncSessionLocal() as session:
        query = select(Calculation).order_by(desc(Calculation.created_at)).limit(limit)
        result = await session.execute(query)
        return list(result.scalars().all())


async def get_history_page(limit: int = 10, page: int = 1) -> list[Calculation]:
    offset = max(page - 1, 0) * limit

    async with AsyncSessionLocal() as session:
        query = select(Calculation).order_by(desc(Calculation.created_at)).offset(offset).limit(limit)
        result = await session.execute(query)
        return list(result.scalars().all())


async def count_history() -> int:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(func.count(Calculation.id)))
        total = result.scalar_one()
        return int(total)


async def check_db_connection() -> bool:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.exception("Database connectivity check failed")
        return False
