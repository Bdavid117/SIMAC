import logging
import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Integer, desc, select
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


async def init_db() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    logger.info("Database initialized")


async def save_calculation(
    raw_data: list[dict[str, Any]],
    processed_data: list[dict[str, Any]],
) -> Calculation:
    async with AsyncSessionLocal() as session:
        calculation = Calculation(raw_data=raw_data, processed_data=processed_data)
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
