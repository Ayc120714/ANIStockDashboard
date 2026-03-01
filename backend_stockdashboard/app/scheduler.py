from __future__ import annotations

from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from app.db.session import db_session
from app.services.leverage_sync import run_leverage_sync
from app.services.portfolio_manager import reconcile_broker_orders

scheduler = BackgroundScheduler(timezone="Asia/Kolkata")


def _reconcile_job():
    with db_session() as db:
        reconcile_broker_orders(db)


def _weekly_leverage_sync_job():
    with db_session() as db:
        run_leverage_sync(db)


def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(_reconcile_job, "interval", seconds=30, id="portfolio_reconcile", replace_existing=True)
    scheduler.add_job(
        _weekly_leverage_sync_job,
        "cron",
        day_of_week="sun",
        hour=7,
        minute=0,
        id="weekly_leverage_sync",
        replace_existing=True,
    )
    scheduler.add_job(
        _weekly_leverage_sync_job,
        "date",
        run_date=datetime.now() + timedelta(seconds=20),
        id="bootstrap_leverage_sync",
        replace_existing=True,
    )
    scheduler.start()
