"""
[DEPRECATED] Consolidated Security and CORS configuration for HELPDESK.AI Backend.
Resolves Issue #637 by standardizing Helmet headers and CORS policy.
Use backend/security_middleware instead.
"""
import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

def setup_security(app: FastAPI):
    # 1. Strict CORS Policy
    # Only allow verified production domains and local development environments.
    # Use environment variable for flexibility in different staging/prod setups.
    raw_origins = os.getenv(
        "CORS_ORIGINS", 
        "https://helpdeskaiv1.vercel.app,https://helpdesk.ai,http://localhost:5173,http://localhost:3000"
    )
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=[
            "Authorization", 
            "Content-Type", 
            "X-API-Key", 
            "X-CSRF-Token",
            "X-Requested-With"
        ],
        expose_headers=["Content-Disposition"],
        max_age=3600, # Cache preflight requests for 1 hour
    )

    # 2. Standardized Security Headers (Helmet-style)
    # Using a custom middleware to enforce high-security standards.
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        
        # Defense-in-depth against XSS, Clickjacking, and MIME-sniffing
        headers = {
            "Content-Security-Policy": (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: https:; "
                "connect-src 'self' https: wss: http://localhost:7860 ws://localhost:7860 "
                "http://127.0.0.1:7860 ws://127.0.0.1:7860 https://helpdeskaiv1.vercel.app;"
            ),
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "X-Permitted-Cross-Domain-Policies": "none",
            "Expect-CT": "max-age=86400, enforce",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Resource-Policy": "same-origin"
        }
        
        for key, value in headers.items():
            response.headers[key] = value
            
        return response

    logger.info(f"Security headers and CORS (origins={origins}) initialized.")
