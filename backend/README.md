# backend

FastAPI service for the AI interview platform MVP.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env
python scripts/check_alembic_revision_ids.py
alembic upgrade head
uvicorn app.main:app --reload
```

## Structure

- `app/core`: configuration and shared backend concerns
- `app/database`: SQLAlchemy base, session, and models
- `app/features`: feature-specific routers and logic
