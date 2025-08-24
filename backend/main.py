from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Dict
import json
import os
import uuid
import httpx
from datetime import datetime

app = FastAPI(debug=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, "..", "storage")
THUMBNAILS_DIR = os.path.join(BASE_DIR, "..", "thumbnails")
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend/dist")
DATABASE_FILE = os.path.join(BASE_DIR, "database.json")

from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

# Ensure storage and thumbnails directories exist
os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(THUMBNAILS_DIR, exist_ok=True)

# Mount static files for the frontend
app.mount("/static", StaticFiles(directory="/app/frontend/dist"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("/app/frontend/dist/index.html", "r") as f:
        return f.read()


class PdfItem(BaseModel):
    id: str
    filename: str
    url: str
    download_date: str
    title: str | None = None
    authors: List[str] | None = None
    abstract_text: str | None = None
    publication_date: str | None = None
    thumbnail_url: str | None = None
    annotations: List[Dict] | None = None
    drawings: List[Dict] | None = None

class DownloadRequest(BaseModel):
    url: str

def load_db() -> List[PdfItem]:
    if not os.path.exists(DATABASE_FILE):
        return []
    with open(DATABASE_FILE, "r") as f:
        data = json.load(f)
    return [PdfItem(**item) for item in data]

def save_db(pdfs: List[PdfItem]):
    with open(DATABASE_FILE, "w") as f:
        json.dump([pdf.dict() for pdf in pdfs], f, indent=4)

def generate_thumbnail(pdf_path: str, pdf_id: str) -> str:
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(pdf_path)
        page = doc.load_page(0)  # Load first page
        pix = page.get_pixmap(matrix=fitz.Matrix(150/page.rect.width, 150/page.rect.width)) # Scale to 150px width
        thumbnail_filename = f"{pdf_id}.png"
        thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
        pix.save(thumbnail_path)
        doc.close()
        return f"/thumbnails/{thumbnail_filename}"
    except Exception as e:
        return ""

@app.post("/download-pdf")
async def download_pdf(request: DownloadRequest):
    url = request.url
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status() # Raise an exception for HTTP errors

        # Extract filename from URL or use a generic name
        filename = os.path.basename(url).split('?')[0] # Remove query parameters
        if not filename or not filename.lower().endswith(".pdf"):
            filename = f"downloaded_pdf_{uuid.uuid4().hex}.pdf"

        file_id = str(uuid.uuid4())
        file_path = os.path.join(STORAGE_DIR, f"{file_id}.pdf")

        with open(file_path, "wb") as f:
            f.write(response.content)

        thumbnail_url = generate_thumbnail(file_path, file_id)

        pdfs = load_db()
        new_pdf = PdfItem(
            id=file_id,
            filename=filename,
            url=url,
            download_date=datetime.now().isoformat(),
            thumbnail_url=thumbnail_url
        )
        pdfs.append(new_pdf)
        save_db(pdfs)

        return {"message": f"PDF '{filename}' downloaded successfully!", "id": file_id}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"HTTP error downloading PDF: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Network error downloading PDF: {e}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {e}")

class ArxivDownloadRequest(BaseModel):
    arxiv_url: str

@app.post("/download-arxiv-pdf")
async def download_arxiv_pdf(request: ArxivDownloadRequest):
    arxiv_url = request.arxiv_url
    if not arxiv_url.startswith("https://arxiv.org/abs/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid arXiv abstract URL. Must start with https://arxiv.org/abs/")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(arxiv_url)
            response.raise_for_status()
        
            from lxml import html
            tree = html.fromstring(response.content)

            # XPath selectors from the provided file
            title_xpath = "//h1[@class='title mathjax']"
            authors_xpath = "//div[@class='authors']/a"
            date_xpath = "//div[@class='submission-history']//text()"
            abstract_xpath = "//blockquote[@class='abstract mathjax']"

            title = tree.xpath(title_xpath)[0].text_content().replace("Title:", "").strip() if tree.xpath(title_xpath) else "No Title Found"
            authors = [a.text_content().strip() for a in tree.xpath(authors_xpath)] if tree.xpath(authors_xpath) else ["No Authors Found"]
            
            # Extract date - this XPath is tricky, need to find the line with "Submission history" and then parse
            date_raw = "".join(tree.xpath(date_xpath)).strip()
            # Example: "[v1] Fri, 23 Jun 2023 18:00:00 GMT (2,000kb)"
            # We need to find the first date string
            import re
            date_match = re.search(r'\w{3}, \d{1,2} \w{3} \d{4}', date_raw)
            publication_date = date_match.group(0) if date_match else "No Date Found"

            abstract_text = tree.xpath(abstract_xpath)[0].text_content().replace("Abstract:", "").strip() if tree.xpath(abstract_xpath) else "No Abstract Found"

            # Derive PDF URL
            pdf_url = arxiv_url.replace("/abs/", "/pdf/") + ".pdf" # Arxiv PDFs usually end with .pdf

            # Download the PDF
            pdf_response = await client.get(pdf_url, follow_redirects=True)
            pdf_response.raise_for_status()

            file_id = str(uuid.uuid4())
            # Use title as filename, sanitize it
            sanitized_filename = "".join([c for c in title if c.isalnum() or c in (' ', '.', '_')]).strip()
            sanitized_filename = sanitized_filename.replace(' ', '_')[:100] # Limit length
            filename = f"{sanitized_filename or 'downloaded_arxiv_pdf'}.pdf"
            
            file_path = os.path.join(STORAGE_DIR, f"{file_id}.pdf")

            with open(file_path, "wb") as f:
                f.write(pdf_response.content)

            thumbnail_url = generate_thumbnail(file_path, file_id)

            pdfs = load_db()
            new_pdf = PdfItem(
                id=file_id,
                filename=filename,
                url=pdf_url, # Store PDF URL, not abstract URL
                download_date=datetime.now().isoformat(),
                title=title,
                authors=authors,
                abstract_text=abstract_text,
                publication_date=publication_date,
                thumbnail_url=thumbnail_url
            )
            pdfs.append(new_pdf)
            save_db(pdfs)

            return {"message": f"ArXiv PDF '{title}' downloaded successfully!", "id": file_id}

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"HTTP error: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Network error: {e}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during arXiv download: {e}")

@app.get("/pdfs", response_model=List[PdfItem])
async def get_pdfs(query: str | None = None):
    pdfs = load_db()
    if query:
        query_lower = query.lower()
        filtered_pdfs = []
        for pdf in pdfs:
            match = False
            if pdf.title and query_lower in pdf.title.lower():
                match = True
            if pdf.abstract_text and query_lower in pdf.abstract_text.lower():
                match = True
            if pdf.authors:
                for author in pdf.authors:
                    if query_lower in author.lower():
                        match = True
                        break
            if match:
                filtered_pdfs.append(pdf)
        return filtered_pdfs
    return pdfs

@app.get("/thumbnails/{thumbnail_filename}")
async def serve_thumbnail(thumbnail_filename: str):
    thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
    if not os.path.exists(thumbnail_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thumbnail not found")
    return FileResponse(thumbnail_path, media_type="image/png")

@app.get("/pdfs/serve/{pdf_id}")
async def serve_pdf(pdf_id: str):
    pdfs = load_db()
    pdf_item = next((pdf for pdf in pdfs if pdf.id == pdf_id), None)

    if not pdf_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found")

    file_path = os.path.join(STORAGE_DIR, f"{pdf_item.id}.pdf")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF file not found on server")

    return FileResponse(file_path, media_type="application/pdf", filename=pdf_item.filename, headers={
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    })

@app.get("/pdfs/{pdf_id}", response_model=PdfItem)
async def get_pdf_item(pdf_id: str):
    pdfs = load_db()
    pdf_item = next((pdf for pdf in pdfs if pdf.id == pdf_id), None)

    if not pdf_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found")
    return pdf_item

@app.delete("/pdfs/{pdf_id}")
async def delete_pdf(pdf_id: str):
    pdfs = load_db()
    initial_len = len(pdfs)
    pdfs = [pdf for pdf in pdfs if pdf.id != pdf_id]

    if len(pdfs) == initial_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found")

    save_db(pdfs)

    file_path = os.path.join(STORAGE_DIR, f"{pdf_id}.pdf")
    if os.path.exists(file_path):
        os.remove(file_path)

    return {"message": "PDF deleted successfully"}

class AnnotationsRequest(BaseModel):
    annotations: List[Dict]
    drawings: List[Dict]

@app.post("/pdfs/{pdf_id}/annotations")
async def save_annotations(pdf_id: str, request: AnnotationsRequest):
    pdfs = load_db()
    pdf_item = next((pdf for pdf in pdfs if pdf.id == pdf_id), None)

    if not pdf_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found")

    pdf_item.annotations = request.annotations
    pdf_item.drawings = request.drawings
    save_db(pdfs)

    return {"message": "Annotations saved successfully"}

