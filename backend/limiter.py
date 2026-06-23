import time
from collections import defaultdict
from typing import Dict, List
from fastapi import Request, HTTPException, status

class InMemoryLimiter:
    def __init__(self, requests_limit: int, window_seconds: int):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        # Mapping of key (like IP) to list of request timestamps
        self.history: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        # Filter out timestamps older than the sliding window
        self.history[key] = [t for t in self.history[key] if now - t < self.window_seconds]
        
        if len(self.history[key]) >= self.requests_limit:
            return False
            
        self.history[key].append(now)
        return True

# Define limiters (in-memory)
# 10 verifications per 60 seconds per IP
key_limiter = InMemoryLimiter(requests_limit=10, window_seconds=60)
# 5 admin login attempts per 60 seconds per IP
login_limiter = InMemoryLimiter(requests_limit=5, window_seconds=60)

def get_client_ip(request: Request) -> str:
    # Handle reverse proxy headers if any
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

def rate_limit_key(request: Request):
    ip = get_client_ip(request)
    if not key_limiter.is_allowed(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many key check requests. Please wait a minute before trying again."
        )

def rate_limit_login(request: Request):
    ip = get_client_ip(request)
    if not login_limiter.is_allowed(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait a minute before trying again."
        )
