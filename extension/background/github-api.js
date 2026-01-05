// GitHub API client for repository operations

const GITHUB_API_BASE = 'https://api.github.com';

// Get GitHub settings from storage
async function getGitHubSettings() {
  const settings = await browser.storage.local.get([
    'githubToken',
    'repoOwner',
    'repoName',
    'baseBranch'
  ]);

  return {
    token: settings.githubToken || '',
    owner: settings.repoOwner || 'thinkjk',
    repo: settings.repoName || 'thefidgetlist',
    baseBranch: settings.baseBranch || 'master'
  };
}

// Make authenticated GitHub API request
async function githubRequest(endpoint, options = {}) {
  const settings = await getGitHubSettings();

  if (!settings.token) {
    throw new Error('GitHub token not configured. Please add it in Settings.');
  }

  const url = `${GITHUB_API_BASE}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${settings.token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Check for rate limiting
  const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
  if (rateLimitRemaining && parseInt(rateLimitRemaining) < 10) {
    console.warn('GitHub API rate limit low:', rateLimitRemaining);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `GitHub API error: ${response.status}`);
  }

  return response.json();
}

// Authenticate and validate token
async function authenticate() {
  try {
    const user = await githubRequest('/user');
    return {
      success: true,
      username: user.login,
      name: user.name
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Get repository information
async function getRepo() {
  const settings = await getGitHubSettings();
  return githubRequest(`/repos/${settings.owner}/${settings.repo}`);
}

// Get reference (branch/tag) SHA
async function getRef(ref) {
  const settings = await getGitHubSettings();
  const data = await githubRequest(`/repos/${settings.owner}/${settings.repo}/git/ref/heads/${ref}`);
  return data.object.sha;
}

// Create a new branch
async function createBranch(branchName, fromRef) {
  const settings = await getGitHubSettings();

  // Get SHA of the source branch
  const sha = await getRef(fromRef || settings.baseBranch);

  // Create the new branch
  return githubRequest(`/repos/${settings.owner}/${settings.repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: sha
    })
  });
}

// Get file contents from repository
async function getFile(path, ref) {
  const settings = await getGitHubSettings();
  const branch = ref || settings.baseBranch;

  try {
    const data = await githubRequest(
      `/repos/${settings.owner}/${settings.repo}/contents/${path}?ref=${branch}`
    );

    // Decode base64 content with proper UTF-8 handling
    const binaryString = atob(data.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const content = new TextDecoder().decode(bytes);

    return {
      content: content,
      sha: data.sha,
      path: data.path
    };
  } catch (error) {
    // File doesn't exist
    if (error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

// Create or update a file in the repository
async function createOrUpdateFile(path, content, message, branch, sha = null) {
  const settings = await getGitHubSettings();

  // Encode content to base64 with proper UTF-8 handling
  const encodedContent = btoa(
    new TextEncoder().encode(content).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  const body = {
    message: message,
    content: encodedContent,
    branch: branch
  };

  // If updating an existing file, include its SHA
  if (sha) {
    body.sha = sha;
  }

  return githubRequest(`/repos/${settings.owner}/${settings.repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

// Create a pull request
async function createPullRequest(title, body, headBranch, baseBranch) {
  const settings = await getGitHubSettings();
  const base = baseBranch || settings.baseBranch;

  return githubRequest(`/repos/${settings.owner}/${settings.repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: title,
      body: body,
      head: headBranch,
      base: base
    })
  });
}

// Get current user (for validation)
async function getCurrentUser() {
  return githubRequest('/user');
}

// List branches
async function listBranches() {
  const settings = await getGitHubSettings();
  return githubRequest(`/repos/${settings.owner}/${settings.repo}/branches`);
}

// Check if branch exists
async function branchExists(branchName) {
  try {
    await getRef(branchName);
    return true;
  } catch (error) {
    return false;
  }
}

// Export functions for background script
if (typeof window !== 'undefined') {
  window.GitHubAPI = {
    authenticate,
    getRepo,
    getRef,
    createBranch,
    getFile,
    createOrUpdateFile,
    createPullRequest,
    getCurrentUser,
    listBranches,
    branchExists,
    getGitHubSettings
  };
}
