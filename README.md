# PDF Store

PDF reader and annotator library. The purpose is to allow collecting
pdfs and some metadata (author, publication date, title, summary) to allow
making finding, reading and annotating them easily.

This is currently a proof of concept for educational reasons (experimenting
with Gemini). If you actually find this useful, please create an issue feature
request. If you would like to collaborate, don't hesitate to reach out!

## Quickstart

### Backend

```bash
cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level=debug
```

### Frontend

```bash
cd frontend && npx webpack serve --mode development --open
```

## Docker Deployment

To deploy both the frontend and backend services using Docker:

1.  **Build the Docker image:**
    Navigate to the root of your project directory (`/home/julien/projects/pdf_reader`) in your terminal and run:
    ```bash
    docker build -t pdf-reader-app .
    ```

2.  **Run the Docker container:**
    ```bash
    docker run -p 8000:8000 pdf-reader-app
    ```

    This will make the application accessible at `http://localhost:8000` in your browser.



Image pushed to dockerhub:

```
$ docker tag pdf-reader-app jrmlhermitte/pdf_reader:latest
$ docker push jrmlhermitte/pdf_reader:latest
```

## External Link
Deployed with render, works at url:
https://pdf-reader-app-latest.onrender.com/
