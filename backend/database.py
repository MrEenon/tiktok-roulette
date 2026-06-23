import os
from datetime import datetime
from sqlalchemy import create_engine, Column, String, DateTime, Integer
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///backend.db")

# Render/Heroku PostgreSQL URLs start with postgres:// but SQLAlchemy requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Check if using sqlite or postgresql
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Admin(Base):
    __tablename__ = "admins"
    
    username = Column(String, primary_key=True, index=True)
    hashed_password = Column(String, nullable=False)
    last_login = Column(DateTime, nullable=True)

class LicenseKey(Base):
    __tablename__ = "license_keys"
    
    key = Column(String, primary_key=True, index=True)
    status = Column(String, default="active", nullable=False)  # active, paused, deleted
    duration_type = Column(String, nullable=False)  # lifetime, monthly, weekly, daily, custom
    expiration_date = Column(DateTime, nullable=True)  # Nullable if lifetime
    hwid = Column(String, nullable=True, index=True)
    username = Column(String, nullable=True)  # Associated user's name
    notes = Column(String, nullable=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class AdminLog(Base):
    __tablename__ = "admin_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    admin_username = Column(String, nullable=False)
    action = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address = Column(String, nullable=False)
    details = Column(String, nullable=True)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
