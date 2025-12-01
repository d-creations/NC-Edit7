FROM python:3.11-slim
WORKDIR /app

# Copy backend adapter and the ncplot7py package
COPY ncplot7py/ ./ncplot7py/
COPY backend/ ./backend/

# If a built frontend exists at `dist/`, copy it into the image so FastAPI
# can serve the static files. Building the image with the repository root as
# context will include `dist/` when present.
COPY dist/ ./dist/

# Install runtime dependencies
RUN pip install --no-cache-dir fastapi uvicorn

EXPOSE 8000

# Ensure Python can import the package located at /app/ncplot7py/src
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/ncplot7py/src:$PYTHONPATH
ENV FRONTEND_BUILD_DIR=/app/dist

# Use the import-based adapter (serves static files when available)
CMD ["uvicorn", "backend.main_import:app", "--host", "0.0.0.0", "--port", "8000"]
