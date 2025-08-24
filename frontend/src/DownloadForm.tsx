import React, { useState } from 'react';

interface DownloadFormProps {
  onDownloadSuccess: () => void;
}

const DownloadForm: React.FC<DownloadFormProps> = ({ onDownloadSuccess }) => {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setIsError(false);

    if (!url) {
      setMessage('Please enter a URL.');
      setIsError(true);
      return;
    }

    let endpoint = '';
    let body = {};

    if (url.startsWith('https://arxiv.org/abs/')) {
      endpoint = '/download-arxiv-pdf';
      body = { arxiv_url: url };
    } else if (url.endsWith('.pdf')) {
      endpoint = '/download-pdf';
      body = { url: url };
    } else {
      setMessage('Please enter a valid PDF URL or arXiv abstract URL.');
      setIsError(true);
      return;
    }

    try {
      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setIsError(false);
        setUrl('');
        onDownloadSuccess();
      } else {
        setMessage(data.detail || 'An error occurred during download.');
        setIsError(true);
      }
    } catch (error) {
      setMessage('Network error or server is unreachable.');
      setIsError(true);
      console.error('Download error:', error);
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-header">Download New PDF</div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="url" className="form-label">PDF or arXiv Abstract URL</label>
            <input
              type="url"
              className="form-control"
              id="url"
              placeholder="Enter PDF or arXiv Abstract URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">Download PDF</button>
          {message && (
            <div className={`mt-3 alert ${isError ? 'alert-danger' : 'alert-success'}`}>
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default DownloadForm;
