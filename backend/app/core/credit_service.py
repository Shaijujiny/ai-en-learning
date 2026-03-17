from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database.models.user_credit import DAILY_CREDITS, MESSAGES_PER_CREDIT, UserCredit


class CreditService:
    def get_or_create(self, db: Session, *, user_id: int) -> UserCredit:
        credit = db.query(UserCredit).filter(UserCredit.user_id == user_id).first()
        if credit is None:
            today = datetime.now(tz=timezone.utc).date()
            credit = UserCredit(
                user_id=user_id,
                total_credits=DAILY_CREDITS,
                remaining_credits=DAILY_CREDITS,
                messages_today=0,
                last_reset_date=today,
            )
            db.add(credit)
            db.flush()
        return credit

    def _apply_daily_reset(self, credit: UserCredit) -> None:
        """Reset credits to DAILY_CREDITS if a new day has started."""
        today = datetime.now(tz=timezone.utc).date()
        if credit.last_reset_date is None or credit.last_reset_date < today:
            credit.remaining_credits = DAILY_CREDITS
            credit.total_credits = DAILY_CREDITS
            credit.messages_today = 0
            credit.last_reset_date = today

    def get_credits(self, db: Session, *, user_id: int) -> dict:
        credit = self.get_or_create(db, user_id=user_id)
        self._apply_daily_reset(credit)
        db.flush()
        msgs = credit.messages_today % MESSAGES_PER_CREDIT
        return {
            "remaining": credit.remaining_credits,
            "total": credit.total_credits,
            "messages_today": credit.messages_today,
            "messages_until_next_deduction": MESSAGES_PER_CREDIT - msgs,
            "resets_daily": True,
            "daily_limit": DAILY_CREDITS,
        }

    def consume_message(self, db: Session, *, user_id: int) -> UserCredit:
        """Called on every message send.
        Every MESSAGES_PER_CREDIT messages = 1 credit deducted.
        Blocks if 0 credits remain.
        Also handles daily reset automatically.
        """
        credit = self.get_or_create(db, user_id=user_id)
        self._apply_daily_reset(credit)

        if credit.remaining_credits <= 0:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=(
                    f"Daily limit reached. You have used all {DAILY_CREDITS} credits for today. "
                    "Come back tomorrow for a fresh 20 credits!"
                ),
            )

        credit.messages_today += 1
        # Deduct 1 credit every MESSAGES_PER_CREDIT messages
        if credit.messages_today % MESSAGES_PER_CREDIT == 0:
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
