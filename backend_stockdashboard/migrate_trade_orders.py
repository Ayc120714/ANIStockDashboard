from app.db import models  # noqa: F401
from app.db.session import Base, engine


def run():
    Base.metadata.create_all(bind=engine)
    print("Trade order schema migration complete.")


if __name__ == "__main__":
    run()
