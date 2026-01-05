// GitHub image uploader - Upload image blobs to repository

// Convert blob to base64 for GitHub API
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove data URL prefix to get just base64
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Upload single image to GitHub
async function uploadImage(githubAPI, groupSlug, filename, blob, branch) {
  const path = `images/${groupSlug}/${filename}`;

  console.log('Uploading image:', path);

  // Convert blob to base64
  const base64Content = await blobToBase64(blob);

  // Check if file already exists
  let existingSha = null;
  try {
    const existingFile = await githubAPI.getFile(path, branch);
    if (existingFile) {
      existingSha = existingFile.sha;
      console.log('Image already exists, will update:', path);
    }
  } catch (error) {
    // File doesn't exist, that's fine
  }

  // Create commit message
  const message = existingSha
    ? `Update image: ${filename}`
    : `Add image: ${filename}`;

  // Upload using GitHub API's custom upload method for binary files
  const settings = await githubAPI.getGitHubSettings();
  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}`;

  const body = {
    message: message,
    content: base64Content,
    branch: branch
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to upload image: ${response.status}`);
  }

  return response.json();
}

// Upload all images from queue items
async function uploadAllImages(githubAPI, queueItems, branch, onProgress) {
  const results = [];
  let uploaded = 0;
  let failed = 0;

  // Collect all images to upload
  const imagesToUpload = [];
  queueItems.forEach(item => {
    item.variants.forEach(variant => {
      if (variant.image_blob && variant.image_filename) {
        imagesToUpload.push({
          groupSlug: item.group_slug,
          filename: variant.image_filename,
          blob: variant.image_blob,
          fidgetName: item.fidget_name,
          material: variant.material
        });
      }
    });
  });

  const total = imagesToUpload.length;

  // Upload images one by one (to avoid overwhelming API)
  for (let i = 0; i < imagesToUpload.length; i++) {
    const image = imagesToUpload[i];

    try {
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: total,
          filename: image.filename,
          status: 'uploading'
        });
      }

      await uploadImage(
        githubAPI,
        image.groupSlug,
        image.filename,
        image.blob,
        branch
      );

      uploaded++;
      results.push({
        success: true,
        filename: image.filename,
        path: `images/${image.groupSlug}/${image.filename}`
      });

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: total,
          filename: image.filename,
          status: 'success'
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      failed++;
      console.error('Failed to upload image:', image.filename, error);

      results.push({
        success: false,
        filename: image.filename,
        error: error.message
      });

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: total,
          filename: image.filename,
          status: 'error',
          error: error.message
        });
      }
    }
  }

  return {
    results,
    uploaded,
    failed,
    total
  };
}

// Upload group logo placeholder (if needed)
async function uploadGroupLogo(githubAPI, groupSlug, branch) {
  // Create a simple placeholder SVG
  const placeholderSVG = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#4A90E2"/>
  <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">
    Logo
  </text>
</svg>`;

  const blob = new Blob([placeholderSVG], { type: 'image/svg+xml' });

  try {
    await uploadImage(githubAPI, groupSlug, 'logo.jpg', blob, branch);
    return true;
  } catch (error) {
    console.warn('Failed to upload group logo:', error);
    return false;
  }
}

// Retry failed uploads
async function retryFailedUploads(githubAPI, failedResults, branch, onProgress) {
  const retryResults = [];

  for (const failed of failedResults) {
    try {
      if (onProgress) {
        onProgress({
          filename: failed.filename,
          status: 'retrying'
        });
      }

      // Note: We'd need to store the blob reference to retry
      // For now, just return the original failure
      retryResults.push(failed);

    } catch (error) {
      retryResults.push({
        ...failed,
        retryError: error.message
      });
    }
  }

  return retryResults;
}

// Export functions
if (typeof window !== 'undefined') {
  window.GitHubImageUploader = {
    uploadImage,
    uploadAllImages,
    uploadGroupLogo,
    retryFailedUploads,
    blobToBase64
  };
}
