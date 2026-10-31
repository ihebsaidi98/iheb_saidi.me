# Base Python image — 3.12-slim provides the system Python uv will use
FROM python:3.12-slim

# Install system dependencies (curl required for container healthcheck)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Install official Astral uv binary
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

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
