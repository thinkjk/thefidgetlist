// Background script for Fidget List Quick Add extension
// Handles context menus and background tasks

console.log('Fidget List Quick Add: Background script loaded');

// Create context menu items
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'add-to-fidget-queue',
    title: 'Add to Fidget Queue',
    contexts: ['image', 'link', 'page']
  });
});

// Handle context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-to-fidget-queue') {
    // Send message to content script or open popup
    console.log('Context menu clicked:', info);
    // TODO: Implement context menu handler
  }
});

// Listen for messages from popup or content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  // TODO: Implement message handlers
  return false;
});
