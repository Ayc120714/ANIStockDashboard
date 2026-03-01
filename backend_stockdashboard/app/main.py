from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.brokers import router as brokers_router
from app.api.dhan import router as dhan_router
from app.api.leverage import router as leverage_router
from app.api.orders import router as orders_router
from app.api.price_alerts import router as price_alerts_router
from app.db import models  # noqa: F401
from app.db.session import Base, engine
from app.scheduler import start_scheduler

app = FastAPI(title="Stock Dashboard Trading API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(brokers_router)
app.include_router(dhan_router)
app.include_router(leverage_router)
app.include_router(orders_router)
app.include_router(price_alerts_router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    start_scheduler()


@app.get("/health")
def health():
    return {"ok": True}
