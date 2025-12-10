import * as pdfjsLib from 'pdfjs-dist';

// Handle potential ESM import structure (default vs namespace)
const pdf = (pdfjsLib as any).default || pdfjsLib;

// Set worker source for pdf.js
// We use the same version as defined in importmap
if (pdf.GlobalWorkerOptions) {
  pdf.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.mjs';
}

/**
 * Converts a PDF file to an array of Base64 Image Strings (JPEG)
 * @param file The PDF File object
 * @returns Promise resolving to string[] (data URLs)
 */
export const convertPdfToImages = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Use the resolved pdf object
  const loadingTask = pdf.getDocument({ data: arrayBuffer });
  const doc = await loadingTask.promise;
  
  const numPages = doc.numPages;
  const images: string[] = [];

  // Limit pages to prevent browser crash on huge docs
  const maxPages = Math.min(numPages, 5); 

  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) continue;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    
    // Convert to JPEG
    images.push(canvas.toDataURL('image/jpeg', 0.8));
  }

  return images;
};