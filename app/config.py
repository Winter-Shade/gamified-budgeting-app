import os
from dotenv import load_dotenv

load_dotenv(override=True)

# LiteLLM reads GEMINI_API_KEY for gemini/ models; copy GOOGLE_API_KEY if needed
if not os.getenv("GEMINI_API_KEY") and os.getenv("GOOGLE_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.environ["GOOGLE_API_KEY"]


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@127.0.0.1:5432/budgetquest",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
