# Base Python image — 3.12-slim provides the system Python uv will use.
# Pinned by digest (AUD-07): mutable tags make rebuilds non-reproducible.
# Digest = OCI multi-arch index for Python 3.12.16, verified against
# registry-1.docker.io on 2026-11-06. To upgrade on purpose, see README
# "Pinned container images".
FROM python:3.12.16-slim@sha256:4840d514c583a4d3d8cad3940e68dee6f0f6f3635c12fcd0a3d74c21a5b93a54

# Install system dependencies (curl required for container healthcheck)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Install official Astral uv binary — pinned by digest, not `:latest` (AUD-07).
# Digest = OCI multi-arch index for uv 0.13.7, verified against ghcr.io on
# 2026-11-06. To upgrade on purpose, see README "Pinned container images".
COPY --from=ghcr.io/astral-sh/uv:0.13.7@sha256:96f40d3904aad8d0bd010539001d36c8e2188b981e1334471a90c4a1d93bb490 /uv /uvx /bin/

# Create non-root system user
RUN groupadd -g 10001 appuser && \
    useradd -u 10001 -g appuser -m -s /bin/bash appuser

WORKDIR /app

# Layer caching: copy dependency manifests and readme required by hatchling metadata
COPY pyproject.toml uv.lock README.md ./

# Install third-party production dependencies using frozen lockfile
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source code
COPY app ./app

# Install project package — skip dependency resolution, already installed above
RUN uv sync --frozen --no-dev --no-cache

# Ensure non-root ownership of the application directory
RUN chown -R appuser:appuser /app /home/appuser

# Switch to non-root user
USER appuser

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app"

EXPOSE 8000

CMD ["uv", "run", "--no-dev", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
