from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.credit_service import credit_service
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user


def require_credits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Deduct one credit before the request is processed.

    The deduction is flushed but not committed here — the endpoint's own
    db.commit() finalises it.  If the endpoint rolls back (e.g. AI error),
    the credit deduction is also rolled back automatically.
    """
    credit_service.consume(db, user_id=current_user.id)
