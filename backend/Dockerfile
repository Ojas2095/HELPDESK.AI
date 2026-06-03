# =============================================================================
# Multi-stage Dockerfile for HELPDESK.AI Backend (Issue #900)
# Stage 1 (builder): Install all dependencies including torch/transformers
# Stage 2 (production): Copy only needed files, non-root user, health check
# Base: python:3.11-slim-bookworm
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: builder — install all Python dependencies
# ---------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS builder

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install system build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .

# Install Python dependencies into a virtualenv for clean copy to production stage
RUN python -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Pre-compile Python source to bytecode for faster startup
COPY . /build/backend
RUN /opt/venv/bin/python -m compileall -q /build/backend || true


# ---------------------------------------------------------------------------
# Stage 2: production — minimal runtime image
# ---------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS production

LABEL maintainer="HELPDESK.AI Team" \
      version="1.2.0" \
      description="AI Helpdesk Backend — production image"

# Runtime-only system libraries (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid 1001 --no-create-home --shell /bin/false appuser

# Copy virtualenv from builder (no dev tools)
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy compiled application code
COPY --from=builder /build/backend /app/backend

# Set Python path so `from backend.xxx import ...` works
ENV PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Switch to non-root user
USER appuser

# Expose application port (Hugging Face Spaces default)
EXPOSE 7860

# Health check using the healthcheck.py script (K8s liveness probe compatible)
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD ["python", "/app/backend/healthcheck.py"]

# Default command — override PORT env var for non-HF deployments
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
