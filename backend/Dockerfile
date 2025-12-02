# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM python:3.11-slim
WORKDIR /app

# Copy backend adapter and the ncplot7py package
COPY ncplot7py/ ./ncplot7py/
COPY backend/ ./backend/

# Copy built frontend from the builder stage
COPY --from=frontend-builder /app/dist ./dist

# Install runtime dependencies
RUN pip install --no-cache-dir fastapi uvicorn

EXPOSE 8000

# Ensure Python can import the package located at /app/ncplot7py/src
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/ncplot7py/src:$PYTHONPATH
ENV FRONTEND_BUILD_DIR=/app/dist

# Use shell form to allow variable expansion if we wanted to use $PORT, 
# but for now we stick to 8000. Azure can be configured with WEBSITES_PORT=8000.
CMD ["uvicorn", "backend.main_import:app", "--host", "0.0.0.0", "--port", "8000"]
