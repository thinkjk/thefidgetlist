// Popup script for Fidget List Quick Add

console.log('Fidget List Quick Add: Popup script loaded');

let variantCounter = 1; // Start with 1 variant already in the form

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize database first
  try {
    await window.FidgetStorage.initDB();
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }

  await updateQueueBadge();
  setupEventListeners();
  updateRemoveButtonVisibility(); // Initial state

  // Check if this is a single-variant site and clear cache to force fresh detection
  // This must happen BEFORE loading cached data
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    const url = tabs[0].url;
    let isSingleVariant = false;

    // Use SiteConfig if available
    if (typeof window !== 'undefined' && window.SiteConfig) {
      try {
        const hostname = new URL(url).hostname;
        isSingleVariant = window.SiteConfig.isSingleVariantSite(hostname);
      } catch (e) {
        console.warn('Error checking SiteConfig:', e);
      }
    }

    // Fallback to URL matching
    if (!isSingleVariant) {
      isSingleVariant = url.includes('ziiistudio.com') ||
                        url.includes('cleanedc.com') ||
                        url.includes('twedcstudio.com');
    }

    if (isSingleVariant) {
      console.log('🔧 Single-variant site detected - clearing cache to force fresh detection');
      await clearCachedFormData();
      // Force auto-detect for these sites
      attemptAutoDetect();
      return;
    }
  }

  // Load cached data if available, otherwise auto-detect
  const cachedData = await loadCachedFormData();
  if (cachedData) {
    console.log('Loading cached form data');
    restoreFormData(cachedData);
  } else {
    console.log('No cached data, attempting auto-detect');
    attemptAutoDetect();
  }
});

// Setup event listeners
function setupEventListeners() {
  // Mode selector
  document.getElementById('btnAutoDetect').addEventListener('click', () => {
    setMode('auto');
  });

  document.getElementById('btnManualEntry').addEventListener('click', () => {
    setMode('manual');
  });

  // Re-scan button
  document.getElementById('btnRescan').addEventListener('click', () => {
    clearCachedFormData();
    attemptAutoDetect();
  });

  // Enhance with AI button
  document.getElementById('btnEnhanceAI').addEventListener('click', () => {
    enhanceWithAI();
  });

  // Add variant button
  document.getElementById('btnAddVariant').addEventListener('click', addVariant);

  // Preview button
  document.getElementById('btnPreview').addEventListener('click', previewJSON);

  // Form submission
  document.getElementById('fidgetForm').addEventListener('submit', handleFormSubmit);

  // Queue manager button
  document.getElementById('btnQueueManager').addEventListener('click', () => {
    browser.tabs.create({ url: browser.runtime.getURL('queue/queue-manager.html') });
  });

  // Settings button
  document.getElementById('btnSettings').addEventListener('click', () => {
    browser.tabs.create({ url: browser.runtime.getURL('settings/settings.html') });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // Cache form data whenever inputs change
  const formInputs = ['groupName', 'fidgetName', 'dimensions', 'buttonSize'];
  formInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', debouncedCacheFormData);
  });

  // Add input listeners to variant fields (will be added to new variants in addVariant)
  addVariantInputListeners();

  // Cache on window unload to ensure data is saved when popup closes
  window.addEventListener('beforeunload', () => {
    cacheFormData();
  });
}

// Debounce helper to avoid excessive caching
let cacheDebounceTimer = null;
function debouncedCacheFormData() {
  clearTimeout(cacheDebounceTimer);
  cacheDebounceTimer = setTimeout(() => {
    cacheFormData();
  }, 500);
}

// Add input listeners to variant fields
function addVariantInputListeners() {
  const variantInputs = document.querySelectorAll('.variant-material, .variant-weight, .variant-image');
  variantInputs.forEach(input => {
    input.addEventListener('input', debouncedCacheFormData);
  });
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
  // Ctrl/Cmd + Enter: Submit form
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('fidgetForm').dispatchEvent(new Event('submit'));
  }

  // Ctrl/Cmd + K: Focus on fidget name field
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('fidgetName').focus();
  }

  // Ctrl/Cmd + Shift + A: Add variant
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    addVariant();
  }

  // Ctrl/Cmd + Shift + Q: Open queue manager
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Q') {
    e.preventDefault();
    browser.tabs.create({ url: browser.runtime.getURL('queue/queue-manager.html') });
  }
}

// Set mode (auto-detect or manual)
function setMode(mode) {
  const autoBtn = document.getElementById('btnAutoDetect');
  const manualBtn = document.getElementById('btnManualEntry');

  if (mode === 'auto') {
    autoBtn.classList.add('active');
    manualBtn.classList.remove('active');
  } else {
    manualBtn.classList.add('active');
    autoBtn.classList.remove('active');
  }
}

// Attempt auto-detection from current page
async function attemptAutoDetect() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const response = await browser.tabs.sendMessage(tabs[0].id, { action: 'extractPageInfo' });

    if (response && response.success) {
      populateFormFromExtractedData(response.data, false); // Don't use Ollama by default
    }
  } catch (error) {
    console.log('Auto-detect failed:', error);
    // Silently fail and let user enter manually
  }
}

// Enhance current form data with AI
async function enhanceWithAI() {
  try {
    const badge = document.getElementById('queueBadge');
    const originalText = badge.textContent;

    // Show loading state
    badge.textContent = '✨ Enhancing with AI...';
    badge.style.background = '#9b59b6';

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const response = await browser.tabs.sendMessage(tabs[0].id, { action: 'extractPageInfo' });

    if (response && response.success) {
      // Re-populate with Ollama enhancement enabled
      await populateFormFromExtractedData(response.data, true);

      // Show success
      badge.textContent = '✨ Enhanced!';
      setTimeout(() => {
        badge.textContent = originalText;
        badge.style.background = '';
      }, 2000);
    } else {
      badge.textContent = originalText;
      badge.style.background = '';
    }
  } catch (error) {
    console.error('AI enhancement failed:', error);
    alert('AI enhancement failed. Make sure Ollama is running and configured in Settings.');
  }
}

// Cache and restore functions
function cacheFormData() {
  const formData = {
    groupName: document.getElementById('groupName').value,
    fidgetName: document.getElementById('fidgetName').value,
    dimensions: document.getElementById('dimensions').value,
    buttonSize: document.getElementById('buttonSize').value,
    variants: [],
    variantCount: 0
  };

  // Collect all variants
  const variantElements = document.querySelectorAll('.variant-item');
  variantElements.forEach(variantEl => {
    const material = variantEl.querySelector('.variant-material').value;
    const weight = variantEl.querySelector('.variant-weight').value;
    const image = variantEl.querySelector('.variant-image').value;

    formData.variants.push({ material, weight, image });
  });
  formData.variantCount = variantElements.length;

  // Get current tab URL to cache per-page - use synchronous approach
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    const cacheKey = tabs[0] ? `formCache_${tabs[0].url}` : 'formCache_default';
    browser.storage.local.set({ [cacheKey]: formData });
    console.log('Cached form data for', cacheKey);
  });
}

async function loadCachedFormData() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const cacheKey = tabs[0] ? `formCache_${tabs[0].url}` : 'formCache_default';

  const result = await browser.storage.local.get(cacheKey);
  return result[cacheKey] || null;
}

async function clearCachedFormData() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const cacheKey = tabs[0] ? `formCache_${tabs[0].url}` : 'formCache_default';

  await browser.storage.local.remove(cacheKey);
  console.log('Cleared cached form data');
}

function restoreFormData(cachedData) {
  // Restore basic fields
  document.getElementById('groupName').value = cachedData.groupName || '';
  document.getElementById('fidgetName').value = cachedData.fidgetName || '';
  document.getElementById('dimensions').value = cachedData.dimensions || '';
  document.getElementById('buttonSize').value = cachedData.buttonSize || '';

  // Restore variants
  if (cachedData.variants && cachedData.variants.length > 0) {
    // First, clear existing variants
    resetVariants();

    // Add additional variants if needed
    for (let i = 1; i < cachedData.variantCount; i++) {
      addVariant();
    }

    // Populate all variants
    setTimeout(() => {
      const variantElements = document.querySelectorAll('.variant-item');
      cachedData.variants.forEach((variant, index) => {
        if (index < variantElements.length) {
          const variantEl = variantElements[index];
          variantEl.querySelector('.variant-material').value = variant.material || '';
          variantEl.querySelector('.variant-weight').value = variant.weight || '';
          variantEl.querySelector('.variant-image').value = variant.image || '';
        }
      });
    }, 100);
  }

  console.log('Restored form data from cache');
}

// Populate form with extracted data
async function populateFormFromExtractedData(data, useOllama = false) {
  // Show/hide Facebook notice
  const facebookNotice = document.getElementById('facebookNotice');
  if (data.pageType === 'facebook' || data.isFacebookPost) {
    facebookNotice.style.display = 'block';
    console.log('📘 Showing Facebook notice');
  } else {
    facebookNotice.style.display = 'none';
  }

  // For certain sites, reset variants first to avoid cached data issues
  // This ensures we start fresh if the page was previously visited with different variants
  if (data.pageType === 'ziiistudio' || data.pageType === 'twedc' || data.groupName === 'Clean EDC') {
    console.log(`🔧 ${data.pageType || data.groupName} detected - resetting to single variant to clear cache`);
    resetVariants();
    // Also clear any cached form data to start completely fresh
    await clearCachedFormData();
  }

  // Only try Ollama if explicitly requested via the "Enhance with AI" button
  const ollamaData = useOllama ? await tryOllamaEnhancement(data) : null;

  // Merge Ollama results with regex results (Ollama takes priority)
  const finalData = {
    ...data,
    ...(ollamaData || {})
  };

  // Populate fidget name from title (prefer Ollama name if available)
  if (ollamaData?.name || data.title) {
    let cleanTitle = ollamaData?.name || data.title.split('|')[0].split('-')[0].trim();
    // Strip material prefix from fidget name
    const beforeStrip = cleanTitle;
    cleanTitle = window.FidgetValidator.stripMaterialPrefix(cleanTitle);
    console.log('Fidget name before strip:', beforeStrip);
    console.log('Fidget name after strip:', cleanTitle);
    document.getElementById('fidgetName').value = cleanTitle;
  }

  // Populate group name if detected from domain
  if (data.groupName) {
    document.getElementById('groupName').value = data.groupName;
  }

  // Populate dimensions if parsed (prefer Ollama)
  const dimensions = ollamaData?.dimensions || data.parsedDimensions;
  if (dimensions) {
    document.getElementById('dimensions').value = dimensions;
  }

  // Populate button size if parsed (prefer Ollama)
  const buttonSize = ollamaData?.button_size || data.parsedButtonSize;
  if (buttonSize) {
    document.getElementById('buttonSize').value = buttonSize;
  }

  // Populate first variant with parsed data
  const firstVariantMaterial = document.querySelector('.variant-material');
  const firstVariantWeight = document.querySelector('.variant-weight');
  const firstVariantImage = document.querySelector('.variant-image');

  // Check for structured variant data first (JSON-LD, Big Cartel, etc.)
  // Only use if we have valid variants with actual data (not empty objects)
  // Also skip for ziiistudio and twedc which have single-variant products with finish options
  const hasValidVariants = data.structuredData &&
                           data.structuredData.variants &&
                           data.structuredData.variants.length > 0 &&
                           data.structuredData.variants.some(v => v.name || v.material) &&
                           data.pageType !== 'ziiistudio' &&
                           data.pageType !== 'twedc';

  if (hasValidVariants) {
    console.log('📦 Found structured data with variants:', data.structuredData.variants);

    // Deduplicate by material name (in case content script deduplication didn't catch it)
    const uniqueVariants = [];
    const seenMaterials = new Set();

    data.structuredData.variants.forEach(v => {
      const materialKey = (v.name || v.material || '').toLowerCase().trim();
      if (materialKey && !seenMaterials.has(materialKey)) {
        seenMaterials.add(materialKey);
        uniqueVariants.push(v);
      }
    });

    console.log(`📦 Deduplicated from ${data.structuredData.variants.length} to ${uniqueVariants.length} variants`);
    data.structuredData.variants = uniqueVariants;

    // Merge Ollama variants with structured data if available
    const variantsToUse = mergeVariantData(data.structuredData, ollamaData);
    console.log('📦 Variants after merge:', variantsToUse.variants);

    // Populate form immediately with current data
    console.log('📝 Calling handleMultipleVariants with:', variantsToUse);
    handleMultipleVariants(variantsToUse, firstVariantMaterial, firstVariantWeight, firstVariantImage);

    // Try vision model analysis to match images to materials if enabled (run async, don't block)
    if (variantsToUse.needsVisionAnalysis && variantsToUse.images && variantsToUse.images.length > 0) {
      console.log('👁️ Starting vision model analysis in background...');
      matchImagesWithVision(variantsToUse).then(() => {
        console.log('👁️ Vision model analysis complete, updating images...');
        // Re-populate just the images after vision analysis completes
        const variantItems = document.querySelectorAll('.variant-item');
        variantsToUse.variants.forEach((variant, index) => {
          if (index < variantItems.length && variant.image) {
            const imageField = variantItems[index].querySelector('.variant-image');
            if (imageField) {
              imageField.value = variant.image;
              console.log(`👁️ Updated image for "${variant.name}" based on vision analysis`);
            }
          }
        });
      }).catch(err => {
        console.warn('Vision model analysis failed:', err);
      });
    }
  } else if (ollamaData?.variants && ollamaData.variants.length > 0) {
    // Use Ollama variants if no structured data found
    const variantsData = {
      variants: ollamaData.variants,
      images: data.images || []
    };
    handleMultipleVariants(variantsData, firstVariantMaterial, firstVariantWeight, firstVariantImage);
  } else {
    // Only use parsed data if no structured variants found
    // Use Ollama data if available, otherwise fall back to regex parsing
    const material = (ollamaData?.material && ollamaData.material.trim()) || data.parsedMaterial;
    console.log('Material selection:', { ollama: ollamaData?.material, parsed: data.parsedMaterial, final: material });

    if (material && firstVariantMaterial) {
      firstVariantMaterial.value = material;
    } else {
      console.warn('No material found! Ollama:', ollamaData?.material, 'Parsed:', data.parsedMaterial);
    }

    const weight = (ollamaData?.weight && ollamaData.weight.trim()) || data.parsedWeight;
    if (weight && firstVariantWeight) {
      firstVariantWeight.value = weight;
    }

    if (data.image && firstVariantImage) {
      firstVariantImage.value = data.image;
    }
  }

  // Show success indicator
  showAutoDetectFeedback(finalData, ollamaData !== null);

  console.log('Form populated with:', finalData);
  if (ollamaData) {
    console.log('Ollama enhancement applied:', ollamaData);
  }

  // Cache the populated data (wait a bit for DOM to update)
  setTimeout(() => cacheFormData(), 200);
}

// Use vision model to match images to material variants
async function matchImagesWithVision(structuredData) {
  try {
    // Check if vision model is configured
    const settings = await browser.storage.local.get(['ollamaEnabled', 'ollamaVisionModel', 'ollamaEndpoint']);

    if (!settings.ollamaEnabled || !settings.ollamaVisionModel) {
      console.log('Vision model not enabled, using default image assignment');
      return;
    }

    console.log('🔍 Using vision model to match images to materials...');

    const variants = structuredData.variants;
    const images = structuredData.images || [];

    // Get list of material names
    const materialNames = variants.map(v => v.name);

    // Keep track of default image (first image)
    const defaultImage = images[0];

    // Analyze each image to find best material match
    const imageMatches = new Map(); // material -> image URL

    for (let i = 0; i < images.length && i < materialNames.length * 2; i++) {
      const imageUrl = images[i];

      console.log(`🔍 Analyzing image ${i + 1}/${images.length}...`);

      const identifiedMaterial = await window.OllamaClient.identifyMaterialFromImage(
        imageUrl,
        materialNames,
        { endpoint: settings.ollamaEndpoint }
      );

      if (identifiedMaterial && !imageMatches.has(identifiedMaterial)) {
        imageMatches.set(identifiedMaterial, imageUrl);
        console.log(`✅ Matched "${identifiedMaterial}" to image ${i + 1}`);
      }
    }

    // Assign matched images to variants
    variants.forEach(variant => {
      if (imageMatches.has(variant.name)) {
        variant.image = imageMatches.get(variant.name);
        console.log(`✅ Assigned vision-matched image to "${variant.name}"`);
      } else {
        // Use default image if no match found
        variant.image = defaultImage;
        console.log(`⚠️ Using default image for "${variant.name}" (no vision match)`);
      }
    });

    // Mark that vision analysis is complete
    structuredData.needsVisionAnalysis = false;
  } catch (error) {
    console.error('Error in vision model analysis:', error);
    // Continue with default image assignment on error
  }
}

// Merge Ollama variant data with structured data
function mergeVariantData(structuredData, ollamaData) {
  if (!ollamaData || !ollamaData.variants || ollamaData.variants.length === 0) {
    return structuredData;
  }

  // Create a copy of structured data
  const merged = {
    ...structuredData,
    variants: structuredData.variants.map((variant, index) => {
      // Try to find matching Ollama variant by material name
      const ollamaVariant = ollamaData.variants.find(ov =>
        ov.material && variant.name &&
        ov.material.toLowerCase() === variant.name.toLowerCase()
      ) || ollamaData.variants[index]; // Fallback to index match

      // Merge: Ollama data fills in missing weights
      return {
        ...variant,
        weight: variant.weight || (ollamaVariant ? ollamaVariant.weight : null)
      };
    })
  };

  console.log('🔄 Merged variant data with Ollama:', merged);
  return merged;
}

// Handle multiple variants detected from structured data
function handleMultipleVariants(structuredData, firstMaterialField, firstWeightField, firstImageField) {
  const variants = structuredData.variants;
  const images = structuredData.images || [];

  console.log(`🎯 Detected ${variants.length} variants:`, variants);
  console.log(`🖼️ Detected ${images.length} images:`, images);

  // Show notification to user about multiple variants
  showVariantNotification(variants, images);

  // Reset to single variant first, then add the right number
  resetVariants();

  // Auto-add additional variant fields for each variant (starting from 1 since we have 1 by default)
  for (let i = 1; i < variants.length; i++) {
    addVariant();
  }

  // Wait for DOM update, then clear and populate ALL variant fields
  setTimeout(() => {
    const variantItems = document.querySelectorAll('.variant-item');
    console.log(`📝 Found ${variantItems.length} variant items in DOM`);

    variants.forEach((variant, index) => {
      if (index < variantItems.length) {
        const variantItem = variantItems[index];
        const materialField = variantItem.querySelector('.variant-material');
        const weightField = variantItem.querySelector('.variant-weight');
        const imageField = variantItem.querySelector('.variant-image');

        console.log(`📝 Populating variant ${index + 1}:`, variant.name, variant.weight);

        // Clear and set material
        if (materialField) {
          materialField.value = ''; // Clear first
          materialField.value = variant.name;
          console.log(`  ✅ Material set to: "${materialField.value}"`);
        }

        // Clear and set weight
        if (variant.weight && weightField) {
          weightField.value = ''; // Clear first
          weightField.value = variant.weight;
          console.log(`  ✅ Weight set to: "${weightField.value}"`);
        }

        // Clear and set image
        if (imageField) {
          imageField.value = ''; // Clear first
          // Use variant.image if set (from content script or vision model), otherwise use default
          if (variant.image) {
            imageField.value = variant.image;
            console.log(`  ✅ Image set to: "${variant.image.substring(0, 50)}..."`);
          } else if (images.length > 0) {
            // Always use first image as default if no specific image assigned
            imageField.value = images[0];
            console.log(`  ✅ Image set to (default): "${images[0].substring(0, 50)}..."`);
          }
        }
      }
    });
  }, 150); // Increased timeout slightly
}

// Show notification about detected variants
function showVariantNotification(variants, images) {
  const notificationArea = document.querySelector('.mode-selector') || document.querySelector('.header');

  const notification = document.createElement('div');
  notification.className = 'variant-notification';
  notification.style.cssText = `
    background: #3498db;
    color: white;
    padding: 12px;
    margin: 10px 0;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.4;
  `;

  const variantList = variants.map(v => v.name).join(', ');
  notification.innerHTML = `
    <strong>✨ ${variants.length} variants detected!</strong><br>
    ${variantList}<br>
    <small>Auto-filled ${variants.length} variant fields. ${images.length} images found.</small>
  `;

  notificationArea.after(notification);

  // Auto-remove after 8 seconds
  setTimeout(() => notification.remove(), 8000);
}

// Try to enhance data with Ollama if enabled
async function tryOllamaEnhancement(data) {
  try {
    // Check if Ollama is enabled in settings
    const settings = await browser.storage.local.get(['ollamaEnabled', 'ollamaEndpoint', 'ollamaModel']);

    if (!settings.ollamaEnabled) {
      console.log('Ollama is disabled in settings');
      return null;
    }

    if (!settings.ollamaEndpoint || !settings.ollamaModel) {
      console.log('Ollama not fully configured');
      return null;
    }

    // Show loading indicator
    const badge = document.getElementById('queueBadge');
    const originalText = badge.textContent;
    badge.textContent = '🤖 AI parsing...';
    badge.style.background = '#9b59b6';

    console.log('Attempting Ollama enhancement...');

    // Use the full text that was scraped from the page
    const textToAnalyze = data.fullText || data.description || '';

    if (!textToAnalyze) {
      console.log('No text available for Ollama parsing');
      badge.textContent = originalText;
      badge.style.background = '';
      return null;
    }

    // Call Ollama
    const ollamaResult = await window.OllamaClient.parseWithOllama(textToAnalyze, {
      endpoint: settings.ollamaEndpoint,
      model: settings.ollamaModel
    });

    // Restore badge
    badge.textContent = originalText;
    badge.style.background = '';

    if (ollamaResult) {
      console.log('Ollama successfully enhanced data:', ollamaResult);
      return ollamaResult;
    } else {
      console.log('Ollama parsing failed, using regex fallback');
      return null;
    }
  } catch (error) {
    console.error('Error during Ollama enhancement:', error);
    return null;
  }
}

// Show visual feedback for auto-detection
function showAutoDetectFeedback(data, usedOllama = false) {
  const badge = document.getElementById('queueBadge');
  const originalText = badge.textContent;

  // Count how many fields were auto-filled
  let filledCount = 0;
  if (data.title || data.name) filledCount++;
  if (data.groupName) filledCount++;
  if (data.parsedDimensions || data.dimensions) filledCount++;
  if (data.parsedButtonSize || data.button_size) filledCount++;
  if (data.parsedMaterial || data.material) filledCount++;
  if (data.parsedWeight || data.weight) filledCount++;
  if (data.image) filledCount++;

  if (filledCount > 0) {
    const aiIndicator = usedOllama ? '🤖 AI: ' : '✓ ';
    badge.textContent = `${aiIndicator}${filledCount} fields auto-filled`;
    badge.style.background = usedOllama ? '#9b59b6' : '#27AE60';

    setTimeout(() => {
      badge.textContent = originalText;
      badge.style.background = '';
    }, 3000);
  }
}

// Add a new variant
function addVariant() {
  variantCounter++;
  const variantsList = document.getElementById('variantsList');

  const variantDiv = document.createElement('div');
  variantDiv.className = 'variant-item';
  variantDiv.setAttribute('data-variant-index', variantCounter - 1);
  variantDiv.innerHTML = `
    <h4>Variant #${variantCounter}</h4>
    <div class="form-group">
      <label>Material *</label>
      <input type="text" class="variant-material" placeholder="e.g., Tungsten" required>
    </div>
    <div class="form-group">
      <label>Weight</label>
      <input type="text" class="variant-weight" placeholder="e.g., 327g">
    </div>
    <div class="form-group">
      <label>Image URL</label>
      <input type="text" class="variant-image" placeholder="https://... (optional)">
    </div>
    <button type="button" class="btn-remove-variant">Remove Variant</button>
  `;

  variantsList.appendChild(variantDiv);

  // Add remove handler
  variantDiv.querySelector('.btn-remove-variant').addEventListener('click', () => {
    if (document.querySelectorAll('.variant-item').length > 1) {
      variantDiv.remove();
      renumberVariants();
      updateRemoveButtonVisibility();
      cacheFormData(); // Cache after removing variant
    } else {
      alert('You must have at least one variant');
    }
  });

  // Update remove button visibility for all variants
  updateRemoveButtonVisibility();

  // Add input listeners to the new variant fields
  addVariantInputListeners();
}

// Update visibility of remove buttons (show only if 2+ variants)
function updateRemoveButtonVisibility() {
  const variants = document.querySelectorAll('.variant-item');
  const showRemoveButtons = variants.length > 1;

  variants.forEach(variant => {
    const removeBtn = variant.querySelector('.btn-remove-variant');
    if (removeBtn) {
      removeBtn.style.display = showRemoveButtons ? 'block' : 'none';
    }
  });
}

// Renumber variants after removal
function renumberVariants() {
  const variants = document.querySelectorAll('.variant-item');
  variants.forEach((variant, index) => {
    variant.querySelector('h4').textContent = `Variant #${index + 1}`;
    variant.setAttribute('data-variant-index', index);
  });
  variantCounter = variants.length;
}

// Preview JSON output
function previewJSON() {
  const formData = collectFormData();
  alert(JSON.stringify(formData, null, 2));
}

// Collect form data
function collectFormData() {
  const variants = [];
  const variantElements = document.querySelectorAll('.variant-item');

  variantElements.forEach(variantEl => {
    const material = variantEl.querySelector('.variant-material').value.trim();
    const weight = variantEl.querySelector('.variant-weight').value.trim();
    const image = variantEl.querySelector('.variant-image').value.trim();

    if (material) {
      variants.push({
        material,
        weight: weight || null,
        image_url: image || null // Image is now optional
      });
    }
  });

  return {
    group_name: document.getElementById('groupName').value.trim(),
    fidget_name: document.getElementById('fidgetName').value.trim(),
    dimensions: document.getElementById('dimensions').value.trim() || null,
    button_size: document.getElementById('buttonSize').value.trim(),
    variants,
    source_url: null, // Will be filled by content script
    timestamp: new Date().toISOString()
  };
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  let formData = collectFormData();

  // Validate form data
  const validationResult = window.FidgetValidator.validateFormData(formData);
  if (!validationResult.valid) {
    alert('Validation errors:\n\n' + validationResult.errors.join('\n'));
    return;
  }

  // Normalize data (apply standard formats)
  formData = window.FidgetValidator.normalizeFormData(formData);

  // Check for duplicates against live GitHub data
  console.log('Form data before duplicate check:', formData);
  const duplicateCheck = await checkForDuplicates(formData);
  console.log('Duplicate check result:', duplicateCheck);

  if (duplicateCheck.isDuplicate) {
    let warningMessage = `⚠️ Duplicate Detected!\n\n` +
      `"${formData.fidget_name}" already exists in group "${formData.group_name}".\n\n`;

    if (duplicateCheck.duplicateVariants.length > 0) {
      warningMessage += `Duplicate variant(s) found:\n`;
      duplicateCheck.duplicateVariants.forEach(mat => {
        warningMessage += `  • ${mat}\n`;
      });
      warningMessage += `\n`;
    }

    if (duplicateCheck.newVariants.length > 0) {
      warningMessage += `New variant(s) you're adding:\n`;
      duplicateCheck.newVariants.forEach(mat => {
        warningMessage += `  • ${mat}\n`;
      });
      warningMessage += `\n`;
    }

    warningMessage += `Existing variants in repository (${duplicateCheck.existingVariants}):\n`;
    duplicateCheck.existingMaterials.forEach(mat => {
      warningMessage += `  • ${mat}\n`;
    });

    warningMessage += `\nDo you still want to add it to the queue?\n\n` +
      `(Note: The PR will fail if you try to submit duplicate variants)`;

    const proceed = confirm(warningMessage);

    if (!proceed) {
      return; // User cancelled
    }
  }

  try {
    // Check for existing item in queue with same group/fidget name
    const existingItem = await findExistingQueueItem(formData.group_name, formData.fidget_name);

    if (existingItem) {
      const choice = confirm(
        `Found "${formData.fidget_name}" in queue (${existingItem.variants.length} existing variants).\n\n` +
        `Do you want to ADD these variants to the existing item?\n\n` +
        `Click OK to add as variants, or Cancel to create a separate entry.`
      );

      if (choice) {
        // User wants to add as variants - merge into existing item
        await addVariantsToExistingItem(existingItem, formData);

        // Update badge and show success
        await updateQueueBadge();
        alert(`Added ${formData.variants.length} variant(s) to existing item!\n` +
              `Total variants: ${existingItem.variants.length + formData.variants.length}`);

        // Reset form
        document.getElementById('fidgetForm').reset();
        resetVariants();
        await clearCachedFormData();
        return;
      }
      // If Cancel, continue to add as separate item below
    }

    // Show progress indicator
    const badge = document.getElementById('queueBadge');
    const originalBadgeText = badge.textContent;
    badge.textContent = 'Downloading images...';
    badge.style.background = '#3498db';

    // Download and convert images for all variants
    console.log('Downloading images for', formData.variants.length, 'variants...');
    const imageResults = await window.ImageDownloader.downloadVariantImages(
      formData.fidget_name,
      formData.variants
    );

    // Update variants with downloaded image blobs and filenames
    formData.variants = formData.variants.map((variant, index) => {
      const imageResult = imageResults[index];
      if (imageResult.success) {
        // Check if this was a "no image" case
        if (imageResult.noImage) {
          // No image provided - keep variant without image data
          return variant;
        }

        return {
          ...variant,
          image_blob: imageResult.blob,
          image_filename: imageResult.filename,
          image_url: imageResult.originalUrl // Keep original URL for reference
        };
      } else {
        console.warn(`Failed to download image for variant ${index}:`, imageResult.error);
        return variant; // Keep variant even if image download failed
      }
    });

    // Generate group slug
    formData.group_slug = window.ImageDownloader.generateGroupSlug(formData.group_name);

    // Add current page URL as source
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      formData.source_url = tabs[0].url;
    }

    // Add to queue using storage
    const itemId = await window.FidgetStorage.addToQueue(formData);
    console.log('Added to queue with ID:', itemId);

    // Update badge
    await updateQueueBadge();

    // Show success message
    const count = await window.FidgetStorage.getQueueCount();
    const successImages = imageResults.filter(r => r.success).length;
    const failedImages = imageResults.filter(r => !r.success).length;

    let message = `Item added to queue! (${count} items total)\n`;
    message += `Images: ${successImages} downloaded`;
    if (failedImages > 0) {
      message += `, ${failedImages} failed`;
    }

    alert(message);

    // Reset form
    document.getElementById('fidgetForm').reset();
    resetVariants();

    // Clear cached data after successful submission
    await clearCachedFormData();

    // Reset badge
    badge.textContent = originalBadgeText;
    badge.style.background = '';
  } catch (error) {
    console.error('Error adding to queue:', error);
    alert('Error adding to queue: ' + error.message);

    // Reset badge on error
    const badge = document.getElementById('queueBadge');
    badge.style.background = '';
    await updateQueueBadge();
  }
}

// Reset variants to default state
function resetVariants() {
  const variantsList = document.getElementById('variantsList');
  variantsList.innerHTML = `
    <div class="variant-item" data-variant-index="0">
      <h4>Variant #1</h4>
      <div class="form-group">
        <label>Material *</label>
        <input type="text" class="variant-material" placeholder="e.g., Tungsten" required>
      </div>
      <div class="form-group">
        <label>Weight</label>
        <input type="text" class="variant-weight" placeholder="e.g., 327g">
      </div>
      <div class="form-group">
        <label>Image URL</label>
        <input type="text" class="variant-image" placeholder="https://... (optional)">
        <small>Paste image URL or use auto-detected (optional)</small>
      </div>
      <button type="button" class="btn-remove-variant" style="display: none;">Remove Variant</button>
    </div>
  `;
  variantCounter = 1;
}

// Update queue badge count
async function updateQueueBadge() {
  try {
    const count = await window.FidgetStorage.getQueueCount();
    document.getElementById('queueBadge').textContent = `${count} items in queue`;
  } catch (error) {
    console.error('Error updating badge:', error);
    document.getElementById('queueBadge').textContent = '0 items in queue';
  }
}

// Check for duplicates against live GitHub data
async function checkForDuplicates(formData) {
  try {
    console.log('Checking for duplicates in GitHub repository...');

    // Fetch fidgets.json directly from public GitHub repo (no auth needed)
    const response = await fetch('https://raw.githubusercontent.com/thinkjk/thefidgetlist/master/fidgets.json');

    if (!response.ok) {
      console.warn('Could not fetch fidgets.json:', response.status);
      return { isDuplicate: false };
    }

    const fidgetsData = await response.json();
    const currentFidgets = { data: fidgetsData };

    if (!currentFidgets || !currentFidgets.data || !currentFidgets.data.fidgets) {
      console.warn('Could not fetch fidgets.json for duplicate check');
      return { isDuplicate: false };
    }

    // Find the group
    const group = currentFidgets.data.fidgets.find(g => g.group_name === formData.group_name);

    if (!group) {
      console.log('Group not found in repository, no duplicates possible');
      return { isDuplicate: false };
    }

    // Helper function to strip common material prefixes from fidget names
    const stripMaterialPrefix = (name) => {
      const materialPrefixes = [
        'Titanium', 'Zirconium', 'Copper', 'Brass', 'Aluminum', 'Aluminium',
        'Stainless Steel', 'Steel', 'Bronze', 'Mokuti', 'Timascus', 'Damascus'
      ];

      let cleanName = name.trim();
      for (const material of materialPrefixes) {
        const regex = new RegExp(`^${material}\\s+`, 'i');
        cleanName = cleanName.replace(regex, '');
      }
      return cleanName;
    };

    // Try exact match first
    let existingFidget = group.items.find(item => item.name === formData.fidget_name);

    // If no exact match, try with material prefix stripped
    if (!existingFidget) {
      const strippedName = stripMaterialPrefix(formData.fidget_name);
      existingFidget = group.items.find(item => item.name === strippedName);
    }

    if (!existingFidget) {
      return { isDuplicate: false };
    }

    // Fidget exists - now check variants
    console.warn('Fidget found:', formData.fidget_name, 'in', formData.group_name);

    // Get existing materials
    const existingMaterials = existingFidget.variants.map(v => v.material);

    // Get materials from form
    const newMaterials = formData.variants.map(v => v.material);

    // Find duplicate materials (case-insensitive)
    const duplicateVariants = newMaterials.filter(newMat =>
      existingMaterials.some(existMat =>
        existMat.toLowerCase() === newMat.toLowerCase()
      )
    );

    // Find truly new materials
    const newVariants = newMaterials.filter(newMat =>
      !existingMaterials.some(existMat =>
        existMat.toLowerCase() === newMat.toLowerCase()
      )
    );

    // Return detailed duplicate info
    return {
      isDuplicate: true,
      existingVariants: existingFidget.variants.length,
      existingMaterials: existingMaterials,
      duplicateVariants: duplicateVariants,
      newVariants: newVariants,
      existingFidget: existingFidget
    };

  } catch (error) {
    console.error('Error checking for duplicates:', error);
    // Don't block submission on error, just log it
    return { isDuplicate: false };
  }
}

// Find existing queue item with matching group and fidget name
async function findExistingQueueItem(groupName, fidgetName) {
  try {
    const queueItems = await window.FidgetStorage.getQueue();

    // Look for exact match first
    let existing = queueItems.find(item =>
      item.group_name === groupName && item.fidget_name === fidgetName
    );

    // If no exact match, try with material prefix stripped
    if (!existing) {
      const strippedName = window.FidgetValidator.stripMaterialPrefix(fidgetName);
      existing = queueItems.find(item =>
        item.group_name === groupName &&
        window.FidgetValidator.stripMaterialPrefix(item.fidget_name) === strippedName
      );
    }

    return existing || null;
  } catch (error) {
    console.error('Error finding existing queue item:', error);
    return null;
  }
}

// Add variants to existing queue item
async function addVariantsToExistingItem(existingItem, newFormData) {
  try {
    // Download images for new variants first
    const badge = document.getElementById('queueBadge');
    const originalBadgeText = badge.textContent;
    badge.textContent = 'Downloading images...';
    badge.style.background = '#3498db';

    const imageResults = await window.ImageDownloader.downloadVariantImages(
      newFormData.fidget_name,
      newFormData.variants
    );

    // Update variants with downloaded image blobs
    const newVariantsWithImages = newFormData.variants.map((variant, index) => {
      const imageResult = imageResults[index];
      if (imageResult.success) {
        return {
          ...variant,
          image_blob: imageResult.blob,
          image_filename: imageResult.filename,
          image_url: imageResult.originalUrl
        };
      }
      return variant;
    });

    // Merge new variants with existing, avoiding duplicates
    const existingMaterials = new Set(
      existingItem.variants.map(v => v.material.toLowerCase())
    );

    const uniqueNewVariants = newVariantsWithImages.filter(variant =>
      !existingMaterials.has(variant.material.toLowerCase())
    );

    if (uniqueNewVariants.length === 0) {
      badge.textContent = originalBadgeText;
      badge.style.background = '';
      alert('All variants already exist in the queue item!');
      return;
    }

    // Update the existing item with merged variants
    existingItem.variants = [...existingItem.variants, ...uniqueNewVariants];
    existingItem.timestamp = new Date().toISOString();

    await window.FidgetStorage.updateQueueItem(existingItem.id, existingItem);

    badge.textContent = originalBadgeText;
    badge.style.background = '';

    console.log(`Added ${uniqueNewVariants.length} new variants to existing queue item`);
  } catch (error) {
    console.error('Error adding variants to existing item:', error);
    throw error;
  }
}
