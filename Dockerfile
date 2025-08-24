# Stage 1: Build the frontend
FROM node:20-slim as frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend/ .
RUN npm run build

# Stage 2: Build the backend and final image
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend/main.py ./backend/main.py
COPY backend/database.json ./backend/database.json

# Copy the storage and thumbnails directories (for initial setup, consider volumes for persistence)
COPY storage/ ./storage/
COPY thumbnails/ ./thumbnails/

# Copy built frontend assets from the frontend-builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose the port the FastAPI app runs on
EXPOSE 8000

# Command to run the FastAPI application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
