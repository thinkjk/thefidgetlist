// JSON merging utilities for fidgets.json and groups.json

// Fetch and parse current fidgets.json from GitHub
async function fetchCurrentFidgets(githubAPI) {
  try {
    const file = await githubAPI.getFile('fidgets.json');
    if (file) {
      return {
        data: JSON.parse(file.content),
        sha: file.sha
      };
    }
  } catch (error) {
    console.error('Error fetching fidgets.json:', error);
  }

  // Return empty structure if file doesn't exist
  return {
    data: { fidgets: [] },
    sha: null
  };
}

// Fetch and parse current groups.json from GitHub
async function fetchCurrentGroups(githubAPI) {
  try {
    const file = await githubAPI.getFile('groups.json');
    if (file) {
      return {
        data: JSON.parse(file.content),
        sha: file.sha
      };
    }
  } catch (error) {
    console.error('Error fetching groups.json:', error);
  }

  // Return empty structure if file doesn't exist
  return {
    data: { groups: [] },
    sha: null
  };
}

// Merge queue items into fidgets.json structure
function mergeFidgetData(currentData, queueItems) {
  const fidgets = currentData.fidgets || [];
  const duplicates = [];
  const added = {
    groups: 0,
    fidgets: 0,
    variants: 0
  };

  // Process each queue item
  queueItems.forEach(item => {
    // Find or create group
    let group = fidgets.find(g => g.group_name === item.group_name);

    if (!group) {
      // Create new group
      group = {
        group_name: item.group_name,
        items: []
      };
      fidgets.push(group);
      added.groups++;
    }

    // Check for duplicate fidget
    const existingFidget = group.items.find(f => f.name === item.fidget_name);

    if (existingFidget) {
      // Fidget exists - only add new variants (don't update dimensions/button_size)
      const existingMaterials = existingFidget.variants.map(v => v.material.toLowerCase());
      const newVariants = [];
      const duplicateVariants = [];

      item.variants.forEach(variant => {
        const materialLower = variant.material.toLowerCase();

        if (existingMaterials.includes(materialLower)) {
          // This variant already exists
          duplicateVariants.push(variant.material);
        } else {
          // This is a new variant - add it (only material, weight, image)
          const newVariant = {
            material: variant.material,
            weight: variant.weight || null
          };

          // Only add image field if image was provided
          if (variant.image_filename) {
            newVariant.image = `images/${item.group_slug}/${variant.image_filename}`;
          }

          existingFidget.variants.push(newVariant);
          newVariants.push(variant.material);
          added.variants++;
        }
      });

      // Only report as duplicate if ALL variants were duplicates
      if (duplicateVariants.length > 0 && newVariants.length === 0) {
        duplicates.push({
          group: item.group_name,
          name: item.fidget_name,
          variants: duplicateVariants
        });
      }
      return; // Done processing this item
    }

    // Create fidget entry with consistent field order: name, dimensions, button_size, variants
    const fidget = {
      name: item.fidget_name,
      dimensions: item.dimensions || null,
      button_size: item.button_size,
      variants: []
    };

    // Add variants
    item.variants.forEach(variant => {
      const newVariant = {
        material: variant.material,
        weight: variant.weight || null
      };

      // Only add image field if image was provided
      if (variant.image_filename) {
        newVariant.image = `images/${item.group_slug}/${variant.image_filename}`;
      }

      fidget.variants.push(newVariant);
      added.variants++;
    });

    group.items.push(fidget);
    added.fidgets++;
  });

  return {
    data: { fidgets },
    duplicates,
    added
  };
}

// Merge queue items into groups.json structure
function mergeGroupData(currentData, queueItems) {
  const groups = currentData.groups || [];
  const added = [];

  // Get unique groups from queue
  const uniqueGroups = {};
  queueItems.forEach(item => {
    if (!uniqueGroups[item.group_name]) {
      uniqueGroups[item.group_name] = {
        name: item.group_name,
        slug: item.group_slug,
        source_url: item.source_url
      };
    }
  });

  // Add new groups
  Object.values(uniqueGroups).forEach(queueGroup => {
    const exists = groups.find(g => g.name === queueGroup.name);

    if (!exists) {
      groups.push({
        name: queueGroup.name,
        description: `Fidgets from ${queueGroup.name}`,
        link: queueGroup.source_url || '',
        image: `images/${queueGroup.slug}/logo.jpg`,
        categories: []
      });
      added.push(queueGroup.name);
    }
  });

  return {
    data: { groups },
    added
  };
}

// Validate JSON structure
function validateJSON(data, type) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid JSON structure');
    return { valid: false, errors };
  }

  if (type === 'fidgets') {
    if (!data.fidgets || !Array.isArray(data.fidgets)) {
      errors.push('Missing or invalid "fidgets" array');
      return { valid: false, errors };
    }

    // Validate fidgets.json structure
    data.fidgets.forEach((group, i) => {
      if (!group.group_name) {
        errors.push(`Group ${i}: Missing group_name`);
      }
      if (!group.items || !Array.isArray(group.items)) {
        errors.push(`Group ${i}: Missing or invalid items array`);
      } else {
        group.items.forEach((item, j) => {
          if (!item.name) {
            errors.push(`Group ${i}, Item ${j}: Missing name`);
          }
          if (!item.variants || !Array.isArray(item.variants) || item.variants.length === 0) {
            errors.push(`Group ${i}, Item ${j}: Missing or empty variants`);
          }
        });
      }
    });
  } else if (type === 'groups') {
    if (!data.groups || !Array.isArray(data.groups)) {
      errors.push('Missing or invalid "groups" array');
      return { valid: false, errors };
    }

    // Validate groups.json structure
    data.groups.forEach((group, i) => {
      if (!group.name) {
        errors.push(`Group ${i}: Missing name`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Generate diff preview
function generateDiffPreview(currentData, newData, type) {
  const preview = {
    additions: [],
    modifications: [],
    unchanged: 0
  };

  if (type === 'fidgets') {
    preview.unchanged = currentData.fidgets ? currentData.fidgets.length : 0;

    if (newData.fidgets) {
      newData.fidgets.forEach(newGroup => {
        const oldGroup = currentData.fidgets ? currentData.fidgets.find(g => g.group_name === newGroup.group_name) : null;

        if (!oldGroup) {
          preview.additions.push({
            type: 'group',
            name: newGroup.group_name,
            items: newGroup.items.length
          });
        } else {
          newGroup.items.forEach(newItem => {
            const oldItem = oldGroup.items.find(i => i.name === newItem.name);
            if (!oldItem) {
              preview.additions.push({
                type: 'fidget',
                group: newGroup.group_name,
                name: newItem.name,
                variants: newItem.variants.length
              });
            }
          });
        }
      });
    }
  }

  return preview;
}

// Export functions
if (typeof window !== 'undefined') {
  window.JSONMerger = {
    fetchCurrentFidgets,
    fetchCurrentGroups,
    mergeFidgetData,
    mergeGroupData,
    validateJSON,
    generateDiffPreview
  };
}
