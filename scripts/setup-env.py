#!/usr/bin/env python3
"""Generate secure local environment files with a matching internal token."""

import pathlib
import re
import secrets
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENV_LOCAL = ROOT / ".env.local"
AI_ENV = ROOT / "ai-service" / ".env"

FRONTEND_TEMPLATE = """# =============================================================
# Portfolio Site — Frontend Environment
# DO NOT COMMIT THIS FILE. It must stay in .gitignore.
# =============================================================
# --- Google Gemini AI (server-side only) ---
# Get a key at https://aistudio.google.com/apikey
# Real keys start with "AIza" and are 39 chars total.
GEMINI_API_KEY=AIza...PASTE_YOUR_REAL_KEY_HERE
GEMINI_CHAT_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
# --- Internal AI Service ---
# URL of the Python FastAPI service. Use port 8001 locally
# to avoid conflict with VSCode Pylance on port 8000.
AI_SERVICE_URL=http://localhost:8001
# Must match EXACTLY the AI_SERVICE_TOKEN in ai-service/.env
AI_SERVICE_TOKEN={token}
# --- Rate Limiting ---
CHAT_RATE_LIMIT=10
CHAT_RATE_WINDOW_MS=60000
# --- Reverse Proxy Trust ---
# false for local dev. Set to true ONLY when deployed behind a
# trusted reverse proxy (Vercel, Cloudflare, Nginx) that
# rewrites X-Forwarded-For. See README.md "Docker Quickstart".
TRUSTED_PROXY=false
# --- Tech News (optional) ---
# DEV_TO_API_KEY=your_devto_api_key_here
"""

BACKEND_TEMPLATE = """# =============================================================
# Portfolio AI Service — Backend Environment
# DO NOT COMMIT THIS FILE. It must stay in .gitignore.
# =============================================================
# Must match EXACTLY the AI_SERVICE_TOKEN in /starter-template/.env.local
AI_SERVICE_TOKEN={token}
# Same Gemini key as the frontend
GEMINI_API_KEY=AIza...PASTE_YOUR_REAL_KEY_HERE
# Environment: development | test | production
ENVIRONMENT=development
"""


def main() -> None:
    if ENV_LOCAL.exists() or AI_ENV.exists():
        existing = []
        if ENV_LOCAL.exists():
            existing.append(str(ENV_LOCAL.relative_to(ROOT)))
        if AI_ENV.exists():
            existing.append(str(AI_ENV.relative_to(ROOT)))
        sys.stderr.write(
            f"Error: Environment file(s) already exist: {', '.join(existing)}\n"
            "To prevent accidental overwrites, please remove them manually before running setup-env.py.\n"
        )
        sys.exit(1)

    token = secrets.token_urlsafe(32)

    # Write .env.local
    ENV_LOCAL.write_text(FRONTEND_TEMPLATE.format(token=token), encoding="utf-8")

    # Write ai-service/.env
    AI_ENV.write_text(BACKEND_TEMPLATE.format(token=token), encoding="utf-8")

    # Verification step: read back and verify token equality
    ft_text = ENV_LOCAL.read_text(encoding="utf-8")
    bt_text = AI_ENV.read_text(encoding="utf-8")

    ft_match = re.search(r"^AI_SERVICE_TOKEN=(.+)$", ft_text, re.MULTILINE)
    bt_match = re.search(r"^AI_SERVICE_TOKEN=(.+)$", bt_text, re.MULTILINE)

    if not ft_match or not bt_match:
        raise RuntimeError("Failed to parse AI_SERVICE_TOKEN from generated files.")

    ft_token = ft_match.group(1).strip()
    bt_token = bt_match.group(1).strip()

    if ft_token != bt_token or ft_token != token:
        raise RuntimeError(
            "Token verification error: AI_SERVICE_TOKEN values do not match."
        )

    print("Wrote .env.local")
    print("Wrote ai-service/.env")
    print(f"Token length: {len(token)} chars (matches in both files)")
    print(
        "Next step: open both files and replace AIza...PASTE_YOUR_REAL_KEY_HERE "
        "with your real Gemini key from https://aistudio.google.com/apikey"
    )


if __name__ == "__main__":
    main()
