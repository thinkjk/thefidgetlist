// Queue Manager Script

console.log('Queue Manager loaded');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadQueue();
  setupEventListeners();
});

// State for select mode
let selectModeActive = false;

// Setup event listeners
function setupEventListeners() {
  document.getElementById('btnPreview').addEventListener('click', previewJSON);
  document.getElementById('btnExport').addEventListener('click', exportJSON);
  document.getElementById('btnCreatePR').addEventListener('click', createPullRequest);
  document.getElementById('btnSelectMode').addEventListener('click', toggleSelectMode);
  document.getElementById('btnMergeSelected').addEventListener('click', mergeSelectedItems);
}

// Load queue from storage
async function loadQueue() {
  try {
    const queueItems = await window.FidgetStorage.getQueue();

    if (queueItems.length === 0) {
      showEmptyState();
    } else {
      renderQueue(queueItems);
      updateStats(queueItems);
    }
  } catch (error) {
    console.error('Error loading queue:', error);
    showEmptyState();
  }
}

// Show empty state
function showEmptyState() {
  const queueList = document.getElementById('queueList');
  queueList.innerHTML = '<p class="empty-state">No items in queue. Start adding fidgets!</p>';
  document.getElementById('sessionStats').innerHTML = '<span>0 fidgets</span> · <span>0 groups</span> · <span>0 images</span>';
}

// Render queue items
function renderQueue(items) {
  const queueList = document.getElementById('queueList');
  queueList.innerHTML = '';

  items.forEach((item) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'queue-item';
    itemDiv.dataset.id = item.id;

    // Generate image preview HTML
    let imagePreviewHTML = '';
    if (item.variants && item.variants.length > 0) {
      const firstVariant = item.variants[0];
      if (firstVariant.image_blob) {
        const imageUrl = URL.createObjectURL(firstVariant.image_blob);
        imagePreviewHTML = `
          <div class="queue-item-image">
            <img src="${imageUrl}" alt="${escapeHtml(item.fidget_name)}" />
            <small>${escapeHtml(firstVariant.image_filename || 'image.jpg')}</small>
          </div>
        `;
      }
    }

    // Checkbox for select mode (hidden by default)
    const checkboxHtml = `
      <div class="queue-item-checkbox" style="display:none;">
        <input type="checkbox" class="item-select-checkbox" data-id="${item.id}">
      </div>
    `;

    itemDiv.innerHTML = `
      ${checkboxHtml}
      ${imagePreviewHTML}
      <div class="queue-item-content">
        <h3>${escapeHtml(item.fidget_name)}</h3>
        <div class="queue-item-meta">
          Group: ${escapeHtml(item.group_name)} (${escapeHtml(item.group_slug || '')})
          ${item.button_size ? ` | Button: ${escapeHtml(item.button_size)}` : ''}
          ${item.dimensions ? ` | Dimensions: ${escapeHtml(item.dimensions)}` : ''}
          ${item.variants[0]?.weight ? ` | Weight: ${escapeHtml(item.variants[0].weight)}` : ''}
        </div>
        <div class="queue-item-variants">
          ${item.variants.length} variant(s): ${item.variants.map(v => {
            const hasImage = v.image_blob ? '✓' : '✗';
            return `${escapeHtml(v.material)} ${hasImage}`;
          }).join(', ')}
        </div>
      </div>
      <div class="queue-item-actions">
        <button class="btn-icon edit" data-id="${item.id}">Edit</button>
        <button class="btn-icon delete" data-id="${item.id}">Delete</button>
      </div>
    `;

    queueList.appendChild(itemDiv);
  });

  // Add event listeners for edit/delete buttons
  document.querySelectorAll('.btn-icon.edit').forEach(btn => {
    btn.addEventListener('click', (e) => editItem(parseInt(e.target.dataset.id)));
  });

  document.querySelectorAll('.btn-icon.delete').forEach(btn => {
    btn.addEventListener('click', (e) => deleteItem(parseInt(e.target.dataset.id)));
  });

  // Add event listeners for checkboxes
  document.querySelectorAll('.item-select-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updateMergeButton);
  });

  // Apply select mode if active
  if (selectModeActive) {
    document.querySelectorAll('.queue-item-checkbox').forEach(cb => {
      cb.style.display = 'block';
    });
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update session statistics
function updateStats(items) {
  const uniqueGroups = new Set(items.map(item => item.group_name)).size;
  const totalImages = items.reduce((sum, item) => sum + item.variants.length, 0);

  document.getElementById('sessionStats').innerHTML = `
    <span>${items.length} fidgets</span> ·
    <span>${uniqueGroups} groups</span> ·
    <span>${totalImages} images</span>
  `;

  // Enable/disable Create PR button
  document.getElementById('btnCreatePR').disabled = items.length === 0;
}

// Edit queue item
async function editItem(id) {
  try {
    const item = await window.FidgetStorage.getQueueItem(id);
    if (!item) {
      alert('Item not found!');
      return;
    }

    // Create edit modal
    const modal = createEditModal(item);
    document.body.appendChild(modal);

    // Setup save handler
    document.getElementById('saveEdit').addEventListener('click', async () => {
      try {
        const updatedItem = await collectEditFormData(item.id);
        await window.FidgetStorage.updateQueueItem(item.id, updatedItem);
        modal.remove();
        await loadQueue();
      } catch (error) {
        alert('Error saving changes: ' + error.message);
      }
    });

    // Setup cancel handler
    document.getElementById('cancelEdit').addEventListener('click', () => {
      modal.remove();
    });

    // Setup add variant handler
    document.getElementById('btnAddEditVariant').addEventListener('click', () => {
      addEditVariant();
    });

    // Setup remove variant handlers
    setupRemoveVariantHandlers();

  } catch (error) {
    console.error('Error editing item:', error);
    alert('Error loading item: ' + error.message);
  }
}

// Create edit modal
function createEditModal(item) {
  const modal = document.createElement('div');
  modal.className = 'edit-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;overflow:auto;padding:20px;';

  const variantsHtml = item.variants.map((variant, index) => {
    // Handle both image_url (from form) and image_blob (stored in queue)
    const imageUrl = variant.image_url || (variant.image_blob ? 'Blob image (already downloaded)' : '');

    return `
      <div class="edit-variant-item" data-variant-index="${index}">
        <h4>Variant #${index + 1}</h4>
        <div class="form-group">
          <label>Material *</label>
          <input type="text" class="edit-variant-material" value="${escapeHtml(variant.material)}" required>
        </div>
        <div class="form-group">
          <label>Weight</label>
          <input type="text" class="edit-variant-weight" value="${escapeHtml(variant.weight || '')}">
        </div>
        <div class="form-group">
          <label>Image URL ${variant.image_blob ? '(Downloaded)' : '*'}</label>
          <input type="text" class="edit-variant-image" value="${escapeHtml(imageUrl)}" ${variant.image_blob ? 'readonly' : 'required'}>
          ${variant.image_blob ? '<small style="color:#666;font-size:11px;">Image already downloaded, URL cannot be changed</small>' : ''}
        </div>
        ${item.variants.length > 1 ? '<button type="button" class="btn-remove-edit-variant">Remove</button>' : ''}
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:8px;max-width:600px;width:100%;max-height:90vh;overflow:auto;">
      <h2>Edit Fidget</h2>
      <form id="editForm">
        <div class="form-group">
          <label>Group Name *</label>
          <input type="text" id="editGroupName" value="${escapeHtml(item.group_name)}" required>
        </div>
        <div class="form-group">
          <label>Fidget Name *</label>
          <input type="text" id="editFidgetName" value="${escapeHtml(item.fidget_name)}" required>
        </div>
        <div class="form-group">
          <label>Dimensions</label>
          <input type="text" id="editDimensions" value="${escapeHtml(item.dimensions || '')}">
        </div>
        <div class="form-group">
          <label>Button Size</label>
          <input type="text" id="editButtonSize" value="${escapeHtml(item.button_size || '')}">
        </div>

        <h3 style="margin-top:20px;">Variants</h3>
        <div id="editVariantsList">
          ${variantsHtml}
        </div>
        <button type="button" id="btnAddEditVariant" style="margin-top:10px;padding:8px 16px;background:#27ae60;color:white;border:none;border-radius:4px;cursor:pointer;">Add Variant</button>

        <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
          <button type="button" id="cancelEdit" style="padding:10px 20px;background:#6c757d;color:white;border:none;border-radius:4px;cursor:pointer;">Cancel</button>
          <button type="button" id="saveEdit" style="padding:10px 20px;background:#4A90E2;color:white;border:none;border-radius:4px;cursor:pointer;">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  return modal;
}

// Add variant in edit modal
function addEditVariant() {
  const variantsList = document.getElementById('editVariantsList');
  const currentVariants = variantsList.querySelectorAll('.edit-variant-item');
  const newIndex = currentVariants.length;

  const variantDiv = document.createElement('div');
  variantDiv.className = 'edit-variant-item';
  variantDiv.setAttribute('data-variant-index', newIndex);
  variantDiv.innerHTML = `
    <h4>Variant #${newIndex + 1}</h4>
    <div class="form-group">
      <label>Material *</label>
      <input type="text" class="edit-variant-material" required>
    </div>
    <div class="form-group">
      <label>Weight</label>
      <input type="text" class="edit-variant-weight">
    </div>
    <div class="form-group">
      <label>Image URL *</label>
      <input type="text" class="edit-variant-image" required>
    </div>
    <button type="button" class="btn-remove-edit-variant">Remove</button>
  `;

  variantsList.appendChild(variantDiv);
  setupRemoveVariantHandlers();
  renumberEditVariants();
}

// Setup remove variant handlers
function setupRemoveVariantHandlers() {
  document.querySelectorAll('.btn-remove-edit-variant').forEach(btn => {
    btn.onclick = () => {
      const variants = document.querySelectorAll('.edit-variant-item');
      if (variants.length > 1) {
        btn.closest('.edit-variant-item').remove();
        renumberEditVariants();
      } else {
        alert('Must have at least one variant');
      }
    };
  });
}

// Renumber edit variants
function renumberEditVariants() {
  const variants = document.querySelectorAll('.edit-variant-item');
  variants.forEach((variant, index) => {
    variant.querySelector('h4').textContent = `Variant #${index + 1}`;
    variant.setAttribute('data-variant-index', index);

    // Show/hide remove buttons
    const removeBtn = variant.querySelector('.btn-remove-edit-variant');
    if (removeBtn) {
      removeBtn.style.display = variants.length > 1 ? 'inline-block' : 'none';
    }
  });
}

// Collect edit form data
async function collectEditFormData(id) {
  const variants = [];
  const variantElements = document.querySelectorAll('.edit-variant-item');

  // Get the original item to preserve image blobs
  const originalItem = await window.FidgetStorage.getQueueItem(id);

  // Get new fidget name to check if it changed
  const newFidgetName = document.getElementById('editFidgetName').value.trim();
  const fidgetNameChanged = originalItem && originalItem.fidget_name !== newFidgetName;

  if (fidgetNameChanged) {
    console.log(`Fidget name changed from "${originalItem.fidget_name}" to "${newFidgetName}" - will rename images`);
  }

  variantElements.forEach((variantEl, index) => {
    const material = variantEl.querySelector('.edit-variant-material').value.trim();
    const weight = variantEl.querySelector('.edit-variant-weight').value.trim();
    const imageInput = variantEl.querySelector('.edit-variant-image');
    const image = imageInput.value.trim();

    if (material && image) {
      const variant = {
        material,
        weight: weight || null,
        image_url: image
      };

      // Preserve image_blob if it exists in the original item
      if (originalItem && originalItem.variants[index]) {
        const originalVariant = originalItem.variants[index];
        if (originalVariant.image_blob) {
          variant.image_blob = originalVariant.image_blob;

          // Regenerate filename if fidget name or material changed
          const materialChanged = originalVariant.material !== material;
          if (fidgetNameChanged || materialChanged) {
            const newFilename = window.ImageDownloader.generateImageFilename(newFidgetName, material, index);
            console.log(`Renamed image: "${originalVariant.image_filename}" -> "${newFilename}"`);
            variant.image_filename = newFilename;
          } else {
            variant.image_filename = originalVariant.image_filename;
          }
        }
      }

      variants.push(variant);
    }
  });

  return {
    id: id,
    group_name: document.getElementById('editGroupName').value.trim(),
    fidget_name: newFidgetName,
    dimensions: document.getElementById('editDimensions').value.trim() || null,
    button_size: document.getElementById('editButtonSize').value.trim() || null,
    group_slug: originalItem?.group_slug || null,
    source_url: originalItem?.source_url || null,
    variants: variants,
    timestamp: new Date().toISOString()
  };
}

// Delete queue item
async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) {
    return;
  }

  try {
    await window.FidgetStorage.deleteQueueItem(id);
    console.log('Deleted item:', id);
    await loadQueue();
  } catch (error) {
    console.error('Error deleting item:', error);
    alert('Error deleting item: ' + error.message);
  }
}

// Preview JSON output
async function previewJSON() {
  try {
    const items = await window.FidgetStorage.getQueue();
    const json = JSON.stringify(items, null, 2);

    // Create modal to show JSON
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
    modal.innerHTML = `
      <div style="background:white;padding:20px;border-radius:8px;max-width:80%;max-height:80%;overflow:auto;">
        <h2>Queue JSON Preview</h2>
        <pre style="background:#f5f5f5;padding:10px;border-radius:4px;overflow:auto;max-height:400px;">${json}</pre>
        <button id="closeModal" style="margin-top:10px;padding:8px 16px;background:#4A90E2;color:white;border:none;border-radius:4px;cursor:pointer;">Close</button>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('closeModal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  } catch (error) {
    console.error('Error previewing JSON:', error);
    alert('Error generating preview: ' + error.message);
  }
}

// Export JSON to clipboard
async function exportJSON() {
  try {
    const items = await window.FidgetStorage.getQueue();
    const json = JSON.stringify(items, null, 2);

    await navigator.clipboard.writeText(json);
    alert('JSON copied to clipboard!');
  } catch (error) {
    console.error('Error exporting JSON:', error);
    alert('Error exporting JSON: ' + error.message);
  }
}

// Create Pull Request
async function createPullRequest() {
  try {
    // Get queue items
    const queueItems = await window.FidgetStorage.getQueue();

    if (queueItems.length === 0) {
      alert('No items in queue!');
      return;
    }

    // Check GitHub settings first
    const settings = await window.GitHubAPI.getGitHubSettings();
    if (!settings.token) {
      if (confirm('GitHub token not configured. Would you like to open Settings?')) {
        browser.runtime.openOptionsPage();
      }
      return;
    }

    // Show progress modal
    const modal = createProgressModal();
    document.body.appendChild(modal);

    try {
      // Create PR with progress tracking
      const result = await window.PRCreator.createPRFromQueue(queueItems, (progress) => {
        updateProgressModal(modal, progress);
      });

      // Success!
      showSuccessModal(result);
      modal.remove();

      // Ask if user wants to clear queue
      if (confirm(`Pull request #${result.pr.number} created successfully!\n\nClear queue?`)) {
        await window.FidgetStorage.clearQueue();
        await loadQueue();
      }

    } catch (error) {
      console.error('PR creation failed:', error);
      modal.remove();
      showErrorModal(error.message);
    }

  } catch (error) {
    console.error('Error in createPullRequest:', error);
    alert('Error: ' + error.message);
  }
}

// Create progress modal
function createProgressModal() {
  const modal = document.createElement('div');
  modal.className = 'pr-progress-modal';
  modal.innerHTML = `
    <div class="pr-progress-content">
      <h2>Creating Pull Request</h2>
      <div class="pr-progress-steps">
        <div class="pr-step" data-step="validate">
          <span class="step-icon">⏳</span>
          <span class="step-text">Validating queue items...</span>
        </div>
        <div class="pr-step" data-step="config">
          <span class="step-icon">⏳</span>
          <span class="step-text">Checking GitHub configuration...</span>
        </div>
        <div class="pr-step" data-step="branch">
          <span class="step-icon">⏳</span>
          <span class="step-text">Creating branch...</span>
        </div>
        <div class="pr-step" data-step="images">
          <span class="step-icon">⏳</span>
          <span class="step-text">Uploading images...</span>
          <div class="step-progress"></div>
        </div>
        <div class="pr-step" data-step="fetch">
          <span class="step-icon">⏳</span>
          <span class="step-text">Fetching current JSON files...</span>
        </div>
        <div class="pr-step" data-step="merge">
          <span class="step-icon">⏳</span>
          <span class="step-text">Merging fidget data...</span>
        </div>
        <div class="pr-step" data-step="commit">
          <span class="step-icon">⏳</span>
          <span class="step-text">Committing changes...</span>
        </div>
        <div class="pr-step" data-step="pr">
          <span class="step-icon">⏳</span>
          <span class="step-text">Creating pull request...</span>
        </div>
      </div>
    </div>
  `;
  return modal;
}

// Update progress modal
function updateProgressModal(modal, progress) {
  const step = modal.querySelector(`[data-step="${progress.step}"]`);
  if (!step) return;

  const icon = step.querySelector('.step-icon');
  const text = step.querySelector('.step-text');
  const progressDiv = step.querySelector('.step-progress');

  // Update text
  text.textContent = progress.message;

  // Update icon
  if (progress.progress) {
    // Step with progress (images)
    icon.textContent = '⏳';
    if (progressDiv) {
      progressDiv.textContent = `${progress.progress.current}/${progress.progress.total}`;
    }
  } else {
    // Step completed
    icon.textContent = '✅';
  }

  // Mark all previous steps as complete
  const allSteps = modal.querySelectorAll('.pr-step');
  let foundCurrent = false;
  allSteps.forEach(s => {
    if (s === step) {
      foundCurrent = true;
    } else if (!foundCurrent) {
      const prevIcon = s.querySelector('.step-icon');
      prevIcon.textContent = '✅';
    }
  });
}

// Show success modal
function showSuccessModal(result) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:8px;max-width:500px;text-align:center;">
      <div style="font-size:48px;margin-bottom:20px;">✅</div>
      <h2>Pull Request Created!</h2>
      <p style="margin:20px 0;">
        <strong>PR #${result.pr.number}</strong><br>
        ${escapeHtml(result.pr.title)}
      </p>
      <div style="background:#f5f5f5;padding:15px;border-radius:4px;margin:20px 0;text-align:left;">
        <strong>Statistics:</strong><br>
        • ${result.stats.fidgets} fidget(s)<br>
        • ${result.stats.groups} group(s)<br>
        • ${result.stats.variants} variant(s)<br>
        • ${result.stats.images} image(s) uploaded
      </div>
      <a href="${result.pr.url}" target="_blank" style="display:inline-block;padding:10px 20px;background:#4A90E2;color:white;text-decoration:none;border-radius:4px;margin:10px;">
        View Pull Request
      </a>
      <button id="closeSuccessModal" style="display:inline-block;padding:10px 20px;background:#6c757d;color:white;border:none;border-radius:4px;margin:10px;cursor:pointer;">
        Close
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('closeSuccessModal').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// Show error modal
function showErrorModal(errorMessage) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:8px;max-width:500px;text-align:center;">
      <div style="font-size:48px;margin-bottom:20px;">❌</div>
      <h2>PR Creation Failed</h2>
      <p style="margin:20px 0;color:#d32f2f;">
        ${escapeHtml(errorMessage)}
      </p>
      <button id="closeErrorModal" style="padding:10px 20px;background:#d32f2f;color:white;border:none;border-radius:4px;cursor:pointer;">
        Close
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('closeErrorModal').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// Toggle select mode
function toggleSelectMode() {
  selectModeActive = !selectModeActive;
  const btn = document.getElementById('btnSelectMode');
  const mergeBtn = document.getElementById('btnMergeSelected');

  if (selectModeActive) {
    btn.textContent = 'Cancel Selection';
    btn.style.background = '#d32f2f';
    mergeBtn.style.display = 'inline-block';
    document.querySelectorAll('.queue-item-checkbox').forEach(cb => {
      cb.style.display = 'block';
    });
  } else {
    btn.textContent = 'Select Mode';
    btn.style.background = '';
    mergeBtn.style.display = 'none';
    document.querySelectorAll('.queue-item-checkbox').forEach(cb => {
      cb.style.display = 'none';
    });
    // Uncheck all
    document.querySelectorAll('.item-select-checkbox').forEach(cb => {
      cb.checked = false;
    });
  }

  updateMergeButton();
}

// Update merge button state
function updateMergeButton() {
  const checkedBoxes = document.querySelectorAll('.item-select-checkbox:checked');
  const mergeBtn = document.getElementById('btnMergeSelected');
  mergeBtn.disabled = checkedBoxes.length < 2;

  if (checkedBoxes.length >= 2) {
    mergeBtn.textContent = `Merge ${checkedBoxes.length} Items`;
  } else {
    mergeBtn.textContent = 'Merge Selected';
  }
}

// Merge selected items
async function mergeSelectedItems() {
  try {
    const checkedBoxes = document.querySelectorAll('.item-select-checkbox:checked');

    if (checkedBoxes.length < 2) {
      alert('Please select at least 2 items to merge');
      return;
    }

    const selectedIds = Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.id));
    const items = await window.FidgetStorage.getQueue();
    const selectedItems = items.filter(item => selectedIds.includes(item.id));

    // Validate that all selected items have the same group and fidget name
    const firstItem = selectedItems[0];
    const groupName = firstItem.group_name;
    const fidgetName = firstItem.fidget_name;

    const allSameGroup = selectedItems.every(item => item.group_name === groupName);
    const allSameFidget = selectedItems.every(item => item.fidget_name === fidgetName);

    if (!allSameGroup || !allSameFidget) {
      alert('All selected items must have the same Group Name and Fidget Name to merge.\n\n' +
            'Use the Edit button to fix mismatches first, then try merging again.');
      return;
    }

    // Confirm merge
    const variantCount = selectedItems.reduce((sum, item) => sum + item.variants.length, 0);
    if (!confirm(`Merge ${selectedItems.length} items into one?\n\n` +
                 `This will combine all ${variantCount} variants into a single fidget entry.\n\n` +
                 `Group: ${groupName}\n` +
                 `Fidget: ${fidgetName}`)) {
      return;
    }

    // Merge items
    const mergedItem = {
      id: firstItem.id,
      group_name: groupName,
      group_slug: firstItem.group_slug,
      fidget_name: fidgetName,
      dimensions: firstItem.dimensions || null,
      button_size: firstItem.button_size || null,
      source_url: firstItem.source_url || null,
      variants: [],
      timestamp: new Date().toISOString()
    };

    // Collect all variants, avoiding duplicates
    const seenMaterials = new Set();
    selectedItems.forEach(item => {
      item.variants.forEach(variant => {
        const materialKey = variant.material.toLowerCase();
        if (!seenMaterials.has(materialKey)) {
          seenMaterials.add(materialKey);
          mergedItem.variants.push(variant);
        }
      });
    });

    // Save merged item (update the first item)
    await window.FidgetStorage.updateQueueItem(firstItem.id, mergedItem);

    // Delete the other items
    for (let i = 1; i < selectedItems.length; i++) {
      await window.FidgetStorage.deleteQueueItem(selectedItems[i].id);
    }

    // Exit select mode and reload
    selectModeActive = false;
    toggleSelectMode();
    await loadQueue();

    alert(`Successfully merged ${selectedItems.length} items!\n${mergedItem.variants.length} variants combined.`);

  } catch (error) {
    console.error('Error merging items:', error);
    alert('Error merging items: ' + error.message);
  }
}
