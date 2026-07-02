from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    pass


_url = get_settings().database_url
_is_sqlite = _url.startswith("sqlite")

engine = create_async_engine(
    _url,
    echo=False,
    connect_args={"timeout": 15} if _is_sqlite else {},
)

if _is_sqlite:
    # WAL lets the ingest webhook write while the slow enrichment pipeline holds a
    # transaction; busy_timeout makes contending writers wait instead of erroring.
    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=15000")
        cursor.close()


SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with SessionLocal() as session:
        yield session
