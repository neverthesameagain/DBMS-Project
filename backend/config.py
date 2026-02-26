import os
from dotenv import load_dotenv

if os.environ.get("VERCEL") is None:
    load_dotenv()

class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")

    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True
    }

#  if env vars missing in production
if not os.environ.get("DATABASE_URL"):
    raise RuntimeError("DATABASE_URL is not set.")

if not os.environ.get("JWT_SECRET_KEY"):
    raise RuntimeError("JWT_SECRET_KEY is not set.")