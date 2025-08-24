
import React, { useState, useEffect } from 'react';
import DownloadForm from './DownloadForm';
import PdfViewer from './PdfViewer';
import PdfModalWrapper from './PdfModalWrapper';
import './style/App.css';


interface Pdf {
  id: string;
  filename: string;
  url: string;
  download_date: string;
  title?: string;
  authors?: string[];
  abstract_text?: string;
  publication_date?: string;
  thumbnail_url?: string;
  annotations?: any[];
}

function App() {
  const [pdfs, setPdfs] = useState<Pdf[]>([]);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState('');
  const [currentPdfId, setCurrentPdfId] = useState('');
  const [pdfViewerKey, setPdfViewerKey] = useState(0);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPdfs = async (query: string = '') => {
    try {
      const url = query ? `/pdfs?query=${encodeURIComponent(query)}` : `/pdfs`;
      const response = await fetch(url);
      if (response.ok) {
        const data: Pdf[] = await response.json();
        setPdfs(data);
      } else {
        console.error('Failed to fetch PDFs');
      }
    } catch (error) {
      console.error('Network error while fetching PDFs:', error);
    }
  };

  useEffect(() => {
    fetchPdfs(searchQuery);
  }, [searchQuery]); // Refetch PDFs when searchQuery changes

  const handleDownloadSuccess = () => {
    fetchPdfs(searchQuery); // Refresh the list after a successful download
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/pdfs/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchPdfs(searchQuery); // Refresh the list after successful deletion
      } else {
        console.error('Failed to delete PDF');
      }
    } catch (error) {
      console.error('Network error while deleting PDF:', error);
    }
  };

  const handleViewPdf = (pdfId: string) => {
    const pdf = pdfs.find(p => p.id === pdfId);
    if (pdf) {
      setCurrentPdfUrl(`/pdfs/serve/${pdfId}`);
      setCurrentPdfId(pdfId);
      setAnnotations(pdf.annotations || []);
      setPdfViewerKey(prevKey => prevKey + 1); // Increment key to force remount
      setShowPdfViewer(true);
    }
  };

  const handleClosePdfViewer = () => {
    setShowPdfViewer(false);
    setCurrentPdfUrl('');
  };

  return (
    <div className="container">
      <h1 className="my-4">PDF Tracker</h1>
      <DownloadForm onDownloadSuccess={handleDownloadSuccess} />

      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search by title, authors, or abstract..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="card-header">Downloaded PDFs</div>
        <div className="card-body">
          {pdfs.length === 0 ? (
            <p>No PDFs found.</p>
          ) : (
            <ul className="list-group">
              {pdfs.map((pdf) => (
                <li key={pdf.id} className="list-group-item d-flex align-items-center">
                  {pdf.thumbnail_url && (
                    <img src={`${pdf.thumbnail_url}`} alt="PDF Thumbnail" className="img-thumbnail me-3" style={{ width: '100px', height: 'auto' }} />
                  )}
                  <div className="flex-grow-1">
                    <a href="#" onClick={() => handleViewPdf(pdf.id)}>
                      {pdf.title || pdf.filename}
                    </a>
                    {pdf.authors && (
                      <div className="text-muted small">Authors: {pdf.authors.join(', ')}</div>
                    )}
                    {pdf.publication_date && (
                      <div className="text-muted small">Published: {pdf.publication_date}</div>
                    )}
                    {pdf.abstract_text && (
                      <div className="text-muted small">Abstract: {pdf.abstract_text.substring(0, 150)}...</div>
                    )}
                    <small className="text-muted">Downloaded on: {new Date(pdf.download_date).toLocaleDateString()}</small>
                  </div>
                  <button
                    className="btn btn-danger btn-sm ms-3"
                    onClick={() => handleDelete(pdf.id)}
                  >
                    Delete
                  </button>
                  <a
                    href={`/pdfs/serve/${pdf.id}`}
                    className="btn btn-info btn-sm ms-2"
                    download={pdf.filename} // Suggests filename for download
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showPdfViewer && (
        <PdfModalWrapper>
          <PdfViewer key={pdfViewerKey} pdfId={currentPdfId} pdfUrl={currentPdfUrl} onClose={handleClosePdfViewer} />
        </PdfModalWrapper>
      )}
    </div>
  );
}

export default App;
