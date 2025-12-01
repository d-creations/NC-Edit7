FROM python:3.11-slim
WORKDIR /app

# Copy backend adapter and the ncplot7py package
COPY ncplot7py/ ./ncplot7py/
COPY backend/ ./backend/

RUN pip install --no-cache-dir fastapi uvicorn

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV CGI_PATH=/app/ncplot7py/scripts/cgiserver.cgi

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
