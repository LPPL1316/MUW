# syntax=docker/dockerfile:1
# The ShapeRoute API with its route engine, for a server (TASK-081, ADR-0076).
# docs/DEPLOY.md, part C, says how to build it and start it.
#
#   docker build -t shaperoute-api .
#   docker run -d --name shaperoute -p 8000:8000 \
#     -e SHAPEROUTE_API_KEY=... -v shaperoute-cache:/app/data/cache \
#     --restart unless-stopped shaperoute-api
#
# Road graphs are downloaded the first time a zone is asked for, into the
# volume, and stay there across restarts and new images. The AI that reads
# shape words (Ollama) is not in the image: without it the API answers
# ai_unavailable to /shape-readings, and everything else works.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first: this layer is rebuilt only when a pyproject.toml changes.
COPY services/route-engine/pyproject.toml services/route-engine/
COPY services/ai/pyproject.toml services/ai/
COPY services/api/pyproject.toml services/api/
RUN python - <<'EOF' > /tmp/requirements.txt
import tomllib
# The third-party dependencies of the three packages; the packages themselves
# run from their sources, below.
ours = {"route-engine", "shaperoute-ai", "shaperoute-api"}
for name in ("route-engine", "ai", "api"):
    with open(f"services/{name}/pyproject.toml", "rb") as file:
        for dependency in tomllib.load(file)["project"]["dependencies"]:
            if dependency not in ours:
                print(dependency)
EOF
RUN pip install -r /tmp/requirements.txt

# The packages run from their sources, as in the repository: the data files
# the engine reads at import (letters, outlines) come along whatever
# pyproject.toml lists.
COPY services/route-engine services/route-engine
COPY services/ai services/ai
COPY services/api services/api
# Their bytecode, written once here: the API runs as a user who cannot write
# next to the sources, and with PYTHONDONTWRITEBYTECODE, so without it every
# process compiled them again, the nearby starts' `spawn` processes too, at
# every route (TASK-289). The engine's fingerprint reads .py and .json only:
# the routes already kept stay valid (route_store.engine_fingerprint).
RUN python -m compileall -q services/route-engine/route_engine \
    services/ai/shaperoute_ai services/api/shaperoute_api
# The app's lists of lakes and beaches, where the repository has them: the
# API keeps the Paddle shapes drawn from their points (TASK-246 part B).
COPY apps/mobile/src/paddle/lakes.json apps/mobile/src/paddle/beaches.json apps/mobile/src/paddle/
ENV PYTHONPATH=/app/services/route-engine:/app/services/ai:/app/services/api

# Not root: the API only needs its cache folder.
RUN useradd --create-home --uid 10001 shaperoute \
    && mkdir -p /app/data/cache \
    && chown -R shaperoute /app/data
USER shaperoute

VOLUME ["/app/data/cache"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"

# --lan: answer from outside the container. The key, if any, comes from
# SHAPEROUTE_API_KEY; the cache is data/cache under /app, the volume.
CMD ["python", "-m", "shaperoute_api", "--lan"]
