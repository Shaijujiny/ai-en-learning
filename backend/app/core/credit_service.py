from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database.models.user_credit import UserCredit

_DEFAULT_CREDITS = 20


class CreditService:
    def get_or_create(self, db: Session, *, user_id: int) -> UserCredit:
        credit = db.query(UserCredit).filter(UserCredit.user_id == user_id).first()
        if credit is None:
            credit = UserCredit(
                user_id=user_id,
                total_credits=_DEFAULT_CREDITS,
                remaining_credits=_DEFAULT_CREDITS,
            )
            db.add(credit)
            db.flush()
        return credit

    def get_credits(self, db: Session, *, user_id: int) -> dict:
        credit = self.get_or_create(db, user_id=user_id)
        return {"remaining": credit.remaining_credits, "total": credit.total_credits}

    def consume(self, db: Session, *, user_id: int) -> UserCredit:
        credit = self.get_or_create(db, user_id=user_id)
        if credit.remaining_credits <= 0:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="No credits remaining. Please top up to continue.",
            )
        credit.remaining_credits -= 1
        db.flush()
        return credit

    def add_credits(self, db: Session, *, user_id: int, amount: int) -> UserCredit:
        credit = self.get_or_create(db, user_id=user_id)
        credit.total_credits += amount
        credit.remaining_credits += amount
        db.flush()
        return credit


credit_service = CreditService()
