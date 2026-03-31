import jwt
from datetime import datetime, timezone, timedelta
from flask import current_app
from app.extensions import db, bcrypt
from app.models.user import User
from app.models.wallet import Wallet


def register_user(username: str, email: str, password: str) -> dict:
    """Register a new user, create their wallet, and return a JWT."""
    if User.query.filter_by(email=email).first():
        raise ValueError("Email already registered")
    if User.query.filter_by(username=username).first():
        raise ValueError("Username already taken")

    password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    user = User(username=username, email=email, password_hash=password_hash)
    db.session.add(user)
    db.session.flush()  # get user.id before creating wallet

    wallet = Wallet(user_id=user.id)
    db.session.add(wallet)
    db.session.flush()

    from app.services.category_service import seed_user_categories
    seed_user_categories(user.id)

    db.session.commit()

    token = _generate_token(user.id)
    return {"token": token, "user": user.to_dict()}


def login_user(email: str, password: str) -> dict:
    """Authenticate a user and return a JWT."""
    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        raise ValueError("Invalid email or password")

    token = _generate_token(user.id)
    return {"token": token, "user": user.to_dict()}


def _generate_token(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")
