// Pull Request creation workflow

// Main function to create PR from queue
async function createPRFromQueue(queueItems, onProgress) {
  const log = (message, step) => {
    console.log(`[PR Creator] ${message}`);
    if (onProgress) {
      onProgress({ step, message });
    }
  };

  try {
    // Step 1: Validate queue items
    log('Validating queue items...', 'validate');
    if (!queueItems || queueItems.length === 0) {
      throw new Error('No items in queue');
    }

    // Step 2: Validate GitHub settings
    log('Checking GitHub configuration...', 'config');
    const settings = await window.GitHubAPI.getGitHubSettings();
    if (!settings.token) {
      throw new Error('GitHub token not configured. Please add it in Settings.');
    }

    // Step 3: Generate branch name
    const branchName = generateBranchName();
    log(`Creating branch: ${branchName}...`, 'branch');

    // Check if branch already exists
    const exists = await window.GitHubAPI.branchExists(branchName);
    if (exists) {
      throw new Error(`Branch ${branchName} already exists. Please try again.`);
    }

    // Create branch
    await window.GitHubAPI.createBranch(branchName, settings.baseBranch);
    log(`Branch created: ${branchName}`, 'branch');

    // Step 4: Upload images
    log('Uploading images...', 'images');
    const imageResults = await window.GitHubImageUploader.uploadAllImages(
      window.GitHubAPI,
      queueItems,
      branchName,
      (progress) => {
        if (onProgress) {
          onProgress({
            step: 'images',
            message: `Uploading image ${progress.current}/${progress.total}: ${progress.filename}`,
            progress: {
              current: progress.current,
              total: progress.total
            }
          });
        }
      }
    );

    if (imageResults.failed > 0) {
      console.warn(`${imageResults.failed} images failed to upload`);
    }

    log(`Uploaded ${imageResults.uploaded}/${imageResults.total} images`, 'images');

    // Step 5: Fetch current JSON files
    log('Fetching current JSON files...', 'fetch');
    const currentFidgets = await window.JSONMerger.fetchCurrentFidgets(window.GitHubAPI);
    const currentGroups = await window.JSONMerger.fetchCurrentGroups(window.GitHubAPI);

    // Step 6: Merge queue data
    log('Merging fidget data...', 'merge');
    const mergedFidgets = window.JSONMerger.mergeFidgetData(currentFidgets.data, queueItems);
    const mergedGroups = window.JSONMerger.mergeGroupData(currentGroups.data, queueItems);

    // Check for duplicates
    if (mergedFidgets.duplicates.length > 0) {
      console.warn('Duplicates found:', mergedFidgets.duplicates);
      const dupList = mergedFidgets.duplicates
        .map(d => `${d.group} - ${d.name}`)
        .join(', ');
      throw new Error(`Duplicate fidgets found: ${dupList}. Please remove them from queue first.`);
    }

    // Validate merged JSON
    const fidgetsValidation = window.JSONMerger.validateJSON(mergedFidgets.data, 'fidgets');
    if (!fidgetsValidation.valid) {
      throw new Error(`Invalid fidgets.json: ${fidgetsValidation.errors.join(', ')}`);
    }

    const groupsValidation = window.JSONMerger.validateJSON(mergedGroups.data, 'groups');
    if (!groupsValidation.valid) {
      throw new Error(`Invalid groups.json: ${groupsValidation.errors.join(', ')}`);
    }

    // Step 7: Commit updated JSON files
    log('Committing fidgets.json...', 'commit');
    await window.GitHubAPI.createOrUpdateFile(
      'fidgets.json',
      JSON.stringify(mergedFidgets.data, null, 2),
      'Update fidgets.json with new items',
      branchName,
      currentFidgets.sha
    );

    // Only commit groups.json if new groups were added
    if (mergedGroups.added.length > 0) {
      log('Committing groups.json...', 'commit');
      await window.GitHubAPI.createOrUpdateFile(
        'groups.json',
        JSON.stringify(mergedGroups.data, null, 2),
        'Update groups.json with new groups',
        branchName,
        currentGroups.sha
      );
    } else {
      log('No new groups to commit, skipping groups.json', 'commit');
    }

    // Step 8: Create pull request
    log('Creating pull request...', 'pr');
    const prTitle = generatePRTitle(queueItems, mergedFidgets.added);
    const prBody = generatePRDescription(queueItems, mergedFidgets.added, mergedGroups.added, imageResults);

    const pr = await window.GitHubAPI.createPullRequest(
      prTitle,
      prBody,
      branchName,
      settings.baseBranch
    );

    log(`Pull request created: #${pr.number}`, 'done');

    return {
      success: true,
      pr: {
        number: pr.number,
        url: pr.html_url,
        title: pr.title
      },
      stats: {
        fidgets: mergedFidgets.added.fidgets,
        groups: mergedFidgets.added.groups,
        variants: mergedFidgets.added.variants,
        images: imageResults.uploaded
      },
      branchName
    };

  } catch (error) {
    console.error('PR creation failed:', error);
    throw error;
  }
}

// Generate unique branch name
function generateBranchName() {
  const date = new Date().toISOString().split('T')[0];
  const random = Math.random().toString(36).substring(2, 8);
  return `add-fidgets-${date}-${random}`;
}

// Generate PR title
function generatePRTitle(queueItems, stats) {
  const fidgetCount = stats.fidgets;
  const groupCount = stats.groups;

  if (groupCount > 0) {
    return `Add ${fidgetCount} fidget${fidgetCount > 1 ? 's' : ''} from ${groupCount} group${groupCount > 1 ? 's' : ''}`;
  } else {
    return `Add ${fidgetCount} fidget${fidgetCount > 1 ? 's' : ''}`;
  }
}

// Generate PR description
function generatePRDescription(queueItems, fidgetStats, groupStats, imageStats) {
  let description = '## Summary\n\n';
  description += `Adding ${fidgetStats.fidgets} fidget${fidgetStats.fidgets > 1 ? 's' : ''} `;
  description += `with ${fidgetStats.variants} variant${fidgetStats.variants > 1 ? 's' : ''} `;
  description += `and ${imageStats.uploaded} image${imageStats.uploaded > 1 ? 's' : ''}.\n\n`;

  if (fidgetStats.groups > 0) {
    description += `**New groups:** ${fidgetStats.groups}\n\n`;
  }

  // Group items by group
  const itemsByGroup = {};
  queueItems.forEach(item => {
    if (!itemsByGroup[item.group_name]) {
      itemsByGroup[item.group_name] = [];
    }
    itemsByGroup[item.group_name].push(item);
  });

  description += '### Fidgets Added\n\n';

  Object.keys(itemsByGroup).forEach(groupName => {
    description += `**${groupName}**\n`;
    itemsByGroup[groupName].forEach(item => {
      const materials = item.variants.map(v => v.material).join(', ');
      description += `- ${item.fidget_name} (${materials})\n`;
      if (item.dimensions) {
        description += `  - Dimensions: ${item.dimensions}\n`;
      }
      if (item.button_size) {
        description += `  - Button: ${item.button_size}\n`;
      }
    });
    description += '\n';
  });

  description += `### Images: ${imageStats.uploaded} files\n\n`;

  if (imageStats.failed > 0) {
    description += `⚠️ **Warning:** ${imageStats.failed} image${imageStats.failed > 1 ? 's' : ''} failed to upload.\n\n`;
  }

  description += '\n---\n\n';
  description += '🤖 Generated with [Fidget List Browser Extension](https://github.com/thinkjk/thefidgetlist)\n';

  return description;
}

// Export functions
if (typeof window !== 'undefined') {
  window.PRCreator = {
    createPRFromQueue,
    generateBranchName,
    generatePRTitle,
    generatePRDescription
  };
}
