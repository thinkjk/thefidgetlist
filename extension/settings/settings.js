// Settings Script

console.log('Settings page loaded');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('settingsForm').addEventListener('submit', saveSettings);
  document.getElementById('btnTestGitHub').addEventListener('click', testGitHubConnection);
  document.getElementById('btnTestOllama').addEventListener('click', testOllamaConnection);
}

// Load settings from storage
async function loadSettings() {
  try {
    const settings = await browser.storage.local.get([
      'githubToken',
      'repoOwner',
      'repoName',
      'baseBranch',
      'ollamaEnabled',
      'ollamaEndpoint',
      'ollamaModel',
      'ollamaVisionModel'
    ]);

    // Populate form with saved settings
    if (settings.githubToken) document.getElementById('githubToken').value = settings.githubToken;
    if (settings.repoOwner) document.getElementById('repoOwner').value = settings.repoOwner;
    if (settings.repoName) document.getElementById('repoName').value = settings.repoName;
    if (settings.baseBranch) document.getElementById('baseBranch').value = settings.baseBranch;
    if (settings.ollamaEnabled) document.getElementById('ollamaEnabled').checked = settings.ollamaEnabled;
    if (settings.ollamaEndpoint) document.getElementById('ollamaEndpoint').value = settings.ollamaEndpoint;
    if (settings.ollamaModel) document.getElementById('ollamaModel').value = settings.ollamaModel;
    if (settings.ollamaVisionModel) document.getElementById('ollamaVisionModel').value = settings.ollamaVisionModel;

    console.log('Settings loaded:', settings);
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings to storage
async function saveSettings(e) {
  e.preventDefault();

  const settings = {
    githubToken: document.getElementById('githubToken').value.trim(),
    repoOwner: document.getElementById('repoOwner').value.trim(),
    repoName: document.getElementById('repoName').value.trim(),
    baseBranch: document.getElementById('baseBranch').value.trim(),
    ollamaEnabled: document.getElementById('ollamaEnabled').checked,
    ollamaEndpoint: document.getElementById('ollamaEndpoint').value.trim(),
    ollamaModel: document.getElementById('ollamaModel').value.trim(),
    ollamaVisionModel: document.getElementById('ollamaVisionModel').value.trim()
  };

  try {
    await browser.storage.local.set(settings);
    alert('Settings saved successfully!');
    console.log('Settings saved:', settings);
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Error saving settings: ' + error.message);
  }
}

// Test GitHub connection
async function testGitHubConnection() {
  const token = document.getElementById('githubToken').value.trim();
  const owner = document.getElementById('repoOwner').value.trim();
  const repo = document.getElementById('repoName').value.trim();

  if (!token || !owner || !repo) {
    alert('Please fill in all GitHub fields first');
    return;
  }

  const btn = document.getElementById('btnTestGitHub');
  btn.disabled = true;
  btn.textContent = 'Testing...';

  try {
    // Save settings temporarily so API can use them
    await browser.storage.local.set({
      githubToken: token,
      repoOwner: owner,
      repoName: repo
    });

    // Test authentication
    const authResult = await window.GitHubAPI.authenticate();

    if (!authResult.success) {
      alert(`❌ Authentication failed:\n\n${authResult.error}\n\nPlease check your Personal Access Token.`);
      return;
    }

    // Test repository access
    try {
      const repoInfo = await window.GitHubAPI.getRepo();

      let message = `✅ Successfully connected to GitHub!\n\n`;
      message += `👤 Authenticated as: ${authResult.username}`;
      if (authResult.name) {
        message += ` (${authResult.name})`;
      }
      message += `\n\n📦 Repository: ${repoInfo.full_name}\n`;
      message += `🔓 Access: ${repoInfo.permissions.push ? 'Write' : 'Read-only'}\n`;
      message += `⭐ Stars: ${repoInfo.stargazers_count}\n`;
      message += `🍴 Forks: ${repoInfo.forks_count}`;

      if (!repoInfo.permissions.push) {
        message += `\n\n⚠️ Warning: You don't have push access to this repository. PR creation may fail.`;
      }

      alert(message);
    } catch (repoError) {
      alert(`❌ Repository access failed:\n\n${repoError.message}\n\nMake sure the repository name is correct and your token has 'repo' scope.`);
    }
  } catch (error) {
    alert(`❌ Error testing connection:\n\n${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test Connection';
  }
}

// Test Ollama connection
async function testOllamaConnection() {
  const endpoint = document.getElementById('ollamaEndpoint').value.trim();
  const model = document.getElementById('ollamaModel').value.trim();

  if (!endpoint || !model) {
    alert('Please fill in all Ollama fields first');
    return;
  }

  const btn = document.getElementById('btnTestOllama');
  btn.disabled = true;
  btn.textContent = 'Testing...';

  try {
    const result = await window.OllamaClient.testOllamaConnection(endpoint, model);

    if (result.success) {
      let message = '✅ Successfully connected to Ollama!\n\n';
      message += `Available models: ${result.available_models.join(', ')}\n\n`;

      if (result.has_requested_model) {
        message += `✓ Model "${model}" is available`;
      } else {
        message += `⚠ Model "${model}" not found. Available models listed above.`;
      }

      alert(message);
    } else {
      alert(`❌ Failed to connect to Ollama:\n\n${result.error}\n\nMake sure Ollama is running and accessible.`);
    }
  } catch (error) {
    alert(`❌ Error testing connection:\n\n${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test Connection';
  }
}
