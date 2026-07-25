import os
import sys
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from backend.database import init_db, get_db, SessionLocal, Admin, LicenseKey, AdminLog
from backend.auth import hash_password, verify_password, create_access_token, get_current_admin
from backend.limiter import rate_limit_key, rate_limit_login, get_client_ip

# Lifespan context manager for startup seeding
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        admin_count = db.query(Admin).count()
        if admin_count == 0:
            hashed = hash_password("Abner@1218")
            db.add(Admin(username="admin", hashed_password=hashed))
            db.commit()
            print("Database initialized. Seeded default admin account: admin / Abner@1218")

        # Seed permanent keys into backend database
        perm_keys = [
            "PERM-0073EEF1-3E13-4B",
            "PERM-5568360A-9387-4C",
            "PERM-C3C9C5B1-A2A7-4F",
            "ROULETTE-DEMO-KEY-2026"
        ]
        for idx, k in enumerate(perm_keys):
            existing = db.query(LicenseKey).filter(LicenseKey.key == k).first()
            if not existing:
                db.add(LicenseKey(
                    key=k,
                    status="active",
                    duration_type="lifetime",
                    username=f"Permanent User {idx+1}" if idx < 3 else "Demo User",
                    notes="Permanent Lifetime Key"
                ))
        db.commit()
        print("Database initialized. Seeded permanent license keys.")
    finally:
        db.close()
    yield

app = FastAPI(title="Licensing & Authentication Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
from fastapi.staticfiles import StaticFiles

class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

# Resolve the absolute path to admin_app/ui (handling PyInstaller _MEIPASS)
if getattr(sys, 'frozen', False):
    admin_ui_dir = os.path.join(getattr(sys, '_MEIPASS', os.path.dirname(sys.executable)), "admin_app", "ui")
else:
    admin_ui_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "admin_app", "ui"))

if os.path.exists(admin_ui_dir):
    app.mount("/admin", NoCacheStaticFiles(directory=admin_ui_dir, html=True), name="admin")
else:
    print(f"Warning: Admin UI directory not found at {admin_ui_dir}")

# --- Request Schemas ---
class VerifyKeyRequest(BaseModel):
    key: str
    hwid: str

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class GenerateKeysRequest(BaseModel):
    duration_type: str  # lifetime, monthly, weekly, daily, custom
    expiration_date: Optional[str] = None  # ISO format string for custom duration
    username: Optional[str] = None
    notes: Optional[str] = None
    count: int = 1

class UpdateKeyStatusRequest(BaseModel):
    status: str  # active, paused

class UpdateKeyNotesRequest(BaseModel):
    notes: str

# Helper to log admin actions
def log_admin_action(db: Session, admin_username: str, action: str, ip: str, details: Optional[str] = None):
    log = AdminLog(
        admin_username=admin_username,
        action=action,
        ip_address=ip,
        details=details
    )
    db.add(log)
    db.commit()

# --- Public Endpoints ---

@app.post("/api/license/verify", dependencies=[Depends(rate_limit_key)])
async def verify_license(req: VerifyKeyRequest, db: Session = Depends(get_db)):
    key_record = db.query(LicenseKey).filter(LicenseKey.key == req.key).first()
    
    if not key_record:
        return {
            "valid": False,
            "status": "invalid",
            "message": "Invalid license key. Please check your key and try again."
        }
        
    if key_record.status == "deleted":
        return {
            "valid": False,
            "status": "deleted",
            "message": "This license key has been permanently deleted."
        }
        
    if key_record.status == "paused":
        return {
            "valid": False,
            "status": "paused",
            "message": "This license key is currently paused by the administrator."
        }
        
    # Check expiration if not lifetime
    if key_record.expiration_date and datetime.utcnow() > key_record.expiration_date:
        return {
            "valid": False,
            "status": "expired",
            "message": f"This license key expired on {key_record.expiration_date.strftime('%Y-%m-%d %H:%M:%S UTC')}."
        }
        
    # HWID Locking logic
    if not key_record.hwid:
        # First time login - lock HWID
        key_record.hwid = req.hwid
        key_record.last_login = datetime.utcnow()
        db.commit()
        db.refresh(key_record)
        return {
            "valid": True,
            "status": "active",
            "expiration_date": key_record.expiration_date.isoformat() if key_record.expiration_date else "Lifetime",
            "username": key_record.username or "User",
            "message": "License key successfully activated and locked to your device!"
        }
        
    if key_record.hwid != req.hwid:
        return {
            "valid": False,
            "status": "hwid_mismatch",
            "message": "Hardware ID mismatch. This key is locked to another computer. Contact support to reset."
        }
        
    # Valid login
    key_record.last_login = datetime.utcnow()
    db.commit()
    return {
        "valid": True,
        "status": "active",
        "expiration_date": key_record.expiration_date.isoformat() if key_record.expiration_date else "Lifetime",
        "username": key_record.username or "User",
        "message": "License key verified successfully."
    }

@app.post("/api/admin/login", dependencies=[Depends(rate_limit_login)])
async def admin_login(req: AdminLoginRequest, request: Request, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.username == req.username).first()
    if not admin or not verify_password(req.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
        
    admin.last_login = datetime.utcnow()
    db.commit()
    
    # Generate access token
    access_token = create_access_token(data={"sub": admin.username})
    
    # Log the successful login
    ip = get_client_ip(request)
    log_admin_action(db, admin.username, "Login", ip, "Admin logged in successfully")
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

# --- Secure Admin Endpoints (Require JWT) ---

@app.get("/api/admin/keys")
async def get_keys(
    search: Optional[str] = None,
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(LicenseKey)
    if search:
        # Search filter
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                LicenseKey.key.like(search_filter),
                LicenseKey.username.like(search_filter),
                LicenseKey.status.like(search_filter),
                LicenseKey.hwid.like(search_filter)
            )
        )
    # Order by creation date descending
    keys = query.order_by(desc(LicenseKey.created_at)).all()
    return keys

@app.post("/api/admin/keys/generate")
async def generate_keys(
    req: GenerateKeysRequest,
    request: Request,
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # Calculate expiration date
    exp_date = None
    now = datetime.utcnow()
    
    if req.duration_type == "daily":
        exp_date = now + timedelta(days=1)
    elif req.duration_type == "weekly":
        exp_date = now + timedelta(weeks=1)
    elif req.duration_type == "monthly":
        exp_date = now + timedelta(days=30)
    elif req.duration_type == "lifetime":
        exp_date = None
    elif req.duration_type == "custom":
        if not req.expiration_date:
            raise HTTPException(status_code=400, detail="Expiration date is required for custom duration")
        try:
            # Parse ISO-8601 string
            exp_date = datetime.fromisoformat(req.expiration_date.replace("Z", ""))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid custom expiration date format. Use ISO format.")
    else:
        raise HTTPException(status_code=400, detail="Invalid duration type")
        
    generated_keys = []
    for _ in range(max(1, req.count)):
        new_key = f"EENON-{str(uuid.uuid4()).upper()}"
        key_record = LicenseKey(
            key=new_key,
            status="active",
            duration_type=req.duration_type,
            expiration_date=exp_date,
            username=req.username,
            notes=req.notes
        )
        db.add(key_record)
        generated_keys.append(key_record)
        
    db.commit()
    
    ip = get_client_ip(request)
    log_admin_action(
        db, 
        current_admin, 
        "Generate Key", 
        ip, 
        f"Generated {req.count} key(s) with duration {req.duration_type}. Key list: {[k.key for k in generated_keys]}"
    )
    
    # Return serializable dicts
    return [{
        "key": k.key,
        "status": k.status,
        "duration_type": k.duration_type,
        "expiration_date": k.expiration_date.isoformat() if k.expiration_date else None,
        "username": k.username,
        "notes": k.notes,
        "created_at": k.created_at.isoformat()
    } for k in generated_keys]

@app.put("/api/admin/keys/{key}/status")
async def update_key_status(
    key: str,
    req: UpdateKeyStatusRequest,
    request: Request,
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    key_record = db.query(LicenseKey).filter(LicenseKey.key == key).first()
    if not key_record:
        raise HTTPException(status_code=404, detail="Key not found")
        
    if req.status not in ["active", "paused"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be active or paused.")
        
    key_record.status = req.status
    db.commit()
    db.refresh(key_record)
    
    ip = get_client_ip(request)
    log_admin_action(db, current_admin, f"Status Change: {req.status}", ip, f"Key: {key}")
    return key_record

@app.put("/api/admin/keys/{key}/reset-hwid")
async def reset_key_hwid(
    key: str,
    request: Request,
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    key_record = db.query(LicenseKey).filter(LicenseKey.key == key).first()
    if not key_record:
        raise HTTPException(status_code=404, detail="Key not found")
        
    old_hwid = key_record.hwid
    key_record.hwid = None
    db.commit()
    db.refresh(key_record)
    
    ip = get_client_ip(request)
    log_admin_action(db, current_admin, "Reset HWID", ip, f"Key: {key}. Old HWID was {old_hwid}")
    return key_record

@app.put("/api/admin/keys/{key}/notes")
async def update_key_notes(
    key: str,
    req: UpdateKeyNotesRequest,
    request: Request,
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    key_record = db.query(LicenseKey).filter(LicenseKey.key == key).first()
    if not key_record:
        raise HTTPException(status_code=404, detail="Key not found")
        
    key_record.notes = req.notes
    db.commit()
    db.refresh(key_record)
    
    ip = get_client_ip(request)
    log_admin_action(db, current_admin, "Edit Notes", ip, f"Key: {key}. New notes: {req.notes}")
    return key_record

@app.delete("/api/admin/keys/{key}")
async def delete_key(
    key: str,
    request: Request,
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    key_record = db.query(LicenseKey).filter(LicenseKey.key == key).first()
    if not key_record:
        raise HTTPException(status_code=404, detail="Key not found")
        
    db.delete(key_record)
    db.commit()
    
    ip = get_client_ip(request)
    log_admin_action(db, current_admin, "Delete Key", ip, f"Permanently deleted key: {key}")
    return {"success": True, "message": f"Key {key} deleted permanently"}

@app.get("/api/admin/logs")
async def get_logs(
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    logs = db.query(AdminLog).order_by(desc(AdminLog.timestamp)).all()
    return logs

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
