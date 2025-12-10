/**
 * Compresses an image file to reduce size for API transmission and storage.
 * @param file The original File object
 * @param maxWidth Maximum width of the image (default 1280px)
 * @param quality JPEG quality (0 to 1, default 0.8)
 * @returns Promise resolving to a Data URL string (base64)
 */
export const compressImage = async (file: File, maxWidth = 1280, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize logic
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Draw and compress
        ctx.fillStyle = 'white'; // Fill transparent backgrounds (e.g. png) with white
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};