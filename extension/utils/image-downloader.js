// Image downloader and converter utility

// Download image from URL and convert to JPG
async function downloadAndConvertImage(imageUrl) {
  try {
    console.log('Downloading image from:', imageUrl);

    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    console.log('Downloaded blob type:', blob.type, 'size:', blob.size);

    // Convert to JPG using canvas
    const jpegBlob = await convertToJPEG(blob);
    console.log('Converted to JPEG, size:', jpegBlob.size);

    return jpegBlob;
  } catch (error) {
    console.error('Error downloading/converting image:', error);
    throw error;
  }
}

// Convert image blob to JPEG format
async function convertToJPEG(blob) {
  return new Promise((resolve, reject) => {
    // Create an image element
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Handle CORS

    img.onload = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw image on canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Convert to JPEG blob
        canvas.toBlob(
          (jpegBlob) => {
            if (jpegBlob) {
              resolve(jpegBlob);
            } else {
              reject(new Error('Failed to convert image to JPEG'));
            }
          },
          'image/jpeg',
          0.9 // Quality (0-1)
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load the image
    const url = URL.createObjectURL(blob);
    img.src = url;
  });
}

// Generate filename from fidget name and material
function generateImageFilename(fidgetName, material, variant_index = 0) {
  // Normalize the name: lowercase, replace spaces with underscores, remove special chars
  const normalizedFidget = fidgetName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

  const normalizedMaterial = material
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // If multiple variants with same material, add index
  const suffix = variant_index > 0 ? `_${variant_index}` : '';

  return `${normalizedFidget}_${normalizedMaterial}${suffix}.jpg`;
}

// Generate group slug from group name
function generateGroupSlug(groupName) {
  return groupName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/-+/g, '') // Remove hyphens
    .trim();
}

// Download multiple images for all variants
async function downloadVariantImages(fidgetName, variants) {
  const results = [];

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];

    if (!variant.image_url || variant.image_url.trim() === '') {
      // No image provided - this is OK, just skip downloading
      results.push({
        index: i,
        success: true, // Mark as success (not an error condition)
        noImage: true,
        blob: null,
        filename: null,
        originalUrl: null
      });
      continue;
    }

    try {
      const blob = await downloadAndConvertImage(variant.image_url);
      const filename = generateImageFilename(fidgetName, variant.material, i);

      results.push({
        index: i,
        success: true,
        blob: blob,
        filename: filename,
        originalUrl: variant.image_url
      });
    } catch (error) {
      results.push({
        index: i,
        success: false,
        error: error.message,
        originalUrl: variant.image_url
      });
    }
  }

  return results;
}

// Convert blob to base64 (useful for JSON export)
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert base64 back to blob
function base64ToBlob(base64) {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

// Export functions
if (typeof window !== 'undefined') {
  window.ImageDownloader = {
    downloadAndConvertImage,
    convertToJPEG,
    generateImageFilename,
    generateGroupSlug,
    downloadVariantImages,
    blobToBase64,
    base64ToBlob
  };
}
