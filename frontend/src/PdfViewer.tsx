import React, { useState, useEffect, useRef } from 'react';
import DrawingCanvas from './DrawingCanvas';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { highlightPlugin } from '@react-pdf-viewer/highlight';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

// Configure pdfjs-dist worker globally
import { GlobalWorkerOptions } from 'pdfjs-dist';
GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`; // Use the exact version we installed

interface PdfViewerProps {
  pdfId: string;
  pdfUrl: string;
  onClose: () => void;
}

interface Highlight {
  id: string;
  content: string;
  highlightArea: Region; // Use Region type
  pageIndex: number;
}

interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
  pageIndex: number;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ pdfId, pdfUrl, onClose }) => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [lines, setLines] = useState<any[]>([]);
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget: (props) => {
      console.log('selectionRegion:', props.selectionRegion);
      return (
        <div
          style={{
            background: '#eee',
            display: 'flex',
            position: 'absolute',
            left: `${props.selectionRegion.left}%`,
            top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
            transform: 'translate(0, 8px)',
            zIndex: 1,
          }}
        >
          <button
            style={{
              background: '#333',
              border: 'none',
              borderRadius: '2px',
              color: '#fff',
              cursor: 'pointer',
              padding: '8px',
            }}
            onClick={() => {
              setHighlights((prevHighlights) => [
                ...prevHighlights,
                {
                  id: `${prevHighlights.length + 1}`,
                  content: props.selectedText,
                  highlightArea: props.selectionRegion,
                  pageIndex: props.selectionRegion.pageIndex,
                },
              ]);
              props.cancel();
            }}
          >
            Highlight
          </button>
        </div>
      );
    },
    renderHighlights: (props) => (
      <div>
        {highlights
          .filter((highlight) => highlight.pageIndex === props.pageIndex)
          .map((highlight) => {
            console.log('highlightArea:', highlight.highlightArea);
            console.log('pageIndex:', highlight.pageIndex);
            return (
              <div
                key={highlight.id}
                className="rpv-highlight"
                style={{
                  background: 'yellow',
                  opacity: 0.4,
                  ...props.getCssProperties(highlight.highlightArea, highlight.pageIndex),
                }}
              />
            );
          })}
      </div>
    ),
  });

  useEffect(() => {
    const fetchAnnotations = async () => {
      try {
        const response = await fetch(`/pdfs/${pdfId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.annotations) {
            console.log('Raw annotations from backend:', data.annotations);
            const transformedAnnotations = data.annotations.map((annotation: any) => ({
              id: annotation.id,
              content: annotation.content, // Use annotation.content directly
              highlightArea: {
                left: annotation.highlightArea.left,
                top: annotation.highlightArea.top,
                width: annotation.highlightArea.width,
                height: annotation.highlightArea.height,
                pageIndex: annotation.pageIndex,
              },
              pageIndex: annotation.pageIndex,
            }));
            setHighlights(transformedAnnotations);
          }
          if (data.drawings) {
            setLines(data.drawings);
          }
        } else {
          console.error('Failed to fetch annotations');
        }
      } catch (error) {
        console.error('Network error while fetching annotations:', error);
      }
    };

    fetchAnnotations();
  }, [pdfId]);

  const saveAnnotations = async () => {
    try {
      const response = await fetch(`/pdfs/${pdfId}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ annotations: highlights, drawings: lines }),
      });
      if (response.ok) {
        alert('Annotations saved successfully!');
      } else {
        console.error('Failed to save annotations');
        alert('Failed to save annotations');
      }
    } catch (error) {
      console.error('Network error while saving annotations:', error);
      alert('Network error while saving annotations');
    }
  };

  return (
    <div className="modal show d-block" tabIndex={-1} role="dialog">
      <div className="modal-dialog modal-fullscreen" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">PDF Viewer</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
          </div>
          <div className="modal-body text-center" ref={viewerContainerRef}>
            {isDrawingMode && viewerContainerRef.current && (
              <DrawingCanvas
                width={viewerContainerRef.current.offsetWidth}
                height={viewerContainerRef.current.offsetHeight}
                lines={lines}
                onDraw={setLines}
              />
            )}
            <Worker workerUrl={GlobalWorkerOptions.workerSrc}>
              <Viewer
                fileUrl={pdfUrl}
                plugins={[defaultLayoutPluginInstance, highlightPluginInstance]}
              />
            </Worker>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={saveAnnotations}>Save Annotations</button>
            <button type="button" className="btn btn-info ms-2" onClick={() => setIsDrawingMode(!isDrawingMode)}>{isDrawingMode ? 'Disable' : 'Enable'} Drawing</button>
            <button type="button" className="btn btn-warning ms-2" onClick={() => { setHighlights([]); setLines([]) }}>Clear All Annotations</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;
