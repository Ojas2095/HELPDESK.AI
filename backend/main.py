"""
FastAPI Backend — AI Helpdesk Ticket Analyzer
POST /ai/analyze_ticket  →  full analysis of a support ticket
GET  /health             →  service health check
"""

import os
import sys
import uuid
import json
import datetime
import traceback
import warnings
import logging
import hashlib
from contextlib import asynccontextmanager

# Suppress harmless PyTorch CPU pin_memory warning
warnings.filterwarnings("ignore", message="'pin_memory'")

# HF Rebuild Trigger: 2026-03-08-2030
from fastapi import FastAPI, Depends, HTTPException, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.encoders import jsonable_encoder
import asyncio
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from backend/.env
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Ensure project root is on path for imports
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.encoders import jsonable_encoder
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from backend.dependencies import (
    classifier_service, ner_service, duplicate_service, rag_service, gemini_service, supabase, limiter
)
from backend.models import HealthResponse, ReadinessResponse
from backend.routers import auth, tickets, ai

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models at startup."""
    print("[Startup] Loading AI models ...")
    try:
        classifier_service.load()
    except FileNotFoundError as e:
        print(f"[WARNING] Classifier not loaded: {e}")
    try:
        ner_service.load()
    except FileNotFoundError as e:
        print(f"[WARNING] NER not loaded: {e}")
    try:
        duplicate_service.load()
    except Exception as e:
        print(f"[WARNING] Duplicate service not loaded: {e}")
    try:
        rag_service.load()
    except Exception as e:
        print(f"[WARNING] RAG service not loaded: {e}")
    
    if gemini_service:
        print(f"[Startup] Gemini Service: {'Initialized' if gemini_service._initialized else 'FAILED (Key missing or SDK error)'}")
    else:
        print("[Startup] Gemini Service: NOT LOADED (Import failed)")

    print("[Startup] Classifier V2 Shadow: Ready.")
    print("[Startup] Ready.")
    # Strict health checks: fail loudly when core model assets are unavailable.
    # Set ALLOW_DEGRADED_STARTUP=1 to permit degraded startup for local/dev convenience.
    try:
        strict_mode = os.environ.get("ALLOW_DEGRADED_STARTUP", "0") != "1"
    except Exception:
        strict_mode = True

    classifier_loaded_flag = getattr(classifier_service, "_loaded", False)
    ner_loaded_flag = getattr(ner_service, "_loaded", False)

    if strict_mode and not classifier_loaded_flag:
        raise RuntimeError("[Startup-FATAL] Classifier assets not loaded. Set ALLOW_DEGRADED_STARTUP=1 to bypass.")
    yield
    print("[Shutdown] Cleaning up ...")



app = FastAPI(
    title="AI Helpdesk Backend",
    description="Ticket classification, entity extraction, and duplicate detection",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_origins_env = os.environ.get("ALLOWED_ORIGINS")
if allowed_origins_env:
    origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    origins = [
        "https://helpdeskaiv1.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tickets.router)
app.include_router(ai.router)
@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HELPDESK.AI - API Engine</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Inter', sans-serif; background-color: #0f172a; color: #f8fafc; }
            .glass-card {
                background: rgba(30, 41, 59, 0.7);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
            .gradient-text {
                background: linear-gradient(to right, #10b981, #3b82f6);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .btn-hover { transition: all 0.2s ease-in-out; }
            .btn-hover:hover { transform: translateY(-2px); text-decoration: none; }
        </style>
    </head>
    <body class="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        
        <!-- Abstract Background Orbs -->
        <div class="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-emerald-600/20 blur-[120px] pointer-events-none"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none"></div>

        <div class="glass-card rounded-2xl p-10 max-w-2xl w-full text-center relative z-10">
            <div class="mb-6 flex justify-center">
                <div class="bg-emerald-500/20 p-4 rounded-full border border-emerald-500/30">
                    <svg class="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
            </div>
            
            <h1 class="text-4xl md:text-5xl font-bold mb-4">HELPDESK<span class="gradient-text">.AI</span></h1>
            <p class="text-slate-400 text-lg mb-8">Next-Generation IT Ticket Inference Engine</p>
            <div class="inline-flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/20 mb-10 text-sm font-semibold tracking-wide">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>System Online • v1.0.0</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <!-- API Docs Button -->
                <a href="/docs" class="btn-hover block w-full bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-700/80 rounded-xl p-5 group">
                    <h3 class="font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">Interactive API Docs</h3>
                    <p class="text-slate-400 text-sm text-center md:text-left">Test endpoints natively via Swagger UI</p>
                </a>
                
                <!-- Frontend Button -->
                <a href="https://helpdeskaiv1.vercel.app/" target="_blank" class="btn-hover block w-full bg-slate-800/80 border border-slate-700 hover:border-blue-500/50 hover:bg-slate-700/80 rounded-xl p-5 group">
                    <h3 class="font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">Client Web Portal</h3>
                    <p class="text-slate-400 text-sm text-center md:text-left">Access the React/Vite dashboard</p>
                </a>

                <!-- System Health Button -->
                <a href="/health" class="btn-hover block w-full bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-700/80 rounded-xl p-5 group md:col-span-2">
                        <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">System Health Check</h3>
                            <p class="text-slate-400 text-sm text-center md:text-left">Verify AI model loading statuses</p>
                        </div>
                        <svg class="w-6 h-6 text-slate-500 group-hover:text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                </a>
            </div>
            
            <div class="mt-10 pt-6 border-t border-slate-800 text-sm text-slate-500">
                Powered by FastAPI & Hugging Face Transformers
            </div>
        </div>
    </body>
    </html>
    """


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        classifier_loaded=classifier_service._loaded,
        ner_loaded=ner_service._loaded,
    )


@app.get("/ready", response_model=ReadinessResponse)
async def readiness_check():
    require_supabase = os.environ.get("REQUIRE_SUPABASE", "false").lower() == "true"
    allow_degraded = os.environ.get("ALLOW_DEGRADED_STARTUP", "0") == "1"
    
    checks = {
        "api": True,
        "classifier_loaded": classifier_service._loaded,
        "ner_loaded": ner_service._loaded,
        "duplicate_index_loaded": duplicate_service.is_available(),
        "rag_loaded": rag_service.is_available(),
    }
    if require_supabase:
        checks["supabase_configured"] = supabase is not None

    # In degraded mode, duplicate and RAG services are optional
    if allow_degraded:
        required_checks = {k: v for k, v in checks.items() if k not in ["duplicate_index_loaded", "rag_loaded"]}
        all_required_pass = all(required_checks.values())
        
        if all_required_pass:
            return ReadinessResponse(status="ready", checks=checks)
    else:
        # Strict mode: all checks must pass
        if all(checks.values()):
            return ReadinessResponse(status="ready", checks=checks)

    return JSONResponse(
        status_code=503,
        content=jsonable_encoder(ReadinessResponse(status="not_ready", checks=checks)),
    )

