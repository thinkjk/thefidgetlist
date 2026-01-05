// Debug helper - Manually extract page info
// Run this in the browser console to see what the extension sees

function debugExtract() {
  console.log('=== DEBUG EXTRACTION ===');

  // Get all text from the page
  const pageText = document.body.innerText || document.body.textContent;
  console.log('Page text length:', pageText.length);
  console.log('First 1000 chars:', pageText.substring(0, 1000));

  // Try to find dimensions
  const dimPatterns = [
    /(?:dimensions?|size|measurements?)[\s:]+(\d+(?:\.\d+)?)\s*(?:mm)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?/i,
    /(\d+(?:\.\d+)?)\s*(?:mm)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?/,
  ];

  console.log('--- Looking for dimensions ---');
  dimPatterns.forEach((pattern, i) => {
    const match = pageText.match(pattern);
    if (match) {
      console.log(`Pattern ${i} matched:`, match[0]);
      console.log('Groups:', match[1], match[2], match[3]);
    } else {
      console.log(`Pattern ${i}: No match`);
    }
  });

  // Try to find button size
  console.log('--- Looking for button size ---');
  const buttonPatterns = [
    /button[\s:]+(\d+(?:\.\d+)?)\s*(?:mm)?/i,
    /(\d+(?:\.\d+)?)\s*mm\s*button/i,
    /(\d+(?:\.\d+)?)\s*(?:mm)?\s*(?:button|buttons)/i,
  ];

  buttonPatterns.forEach((pattern, i) => {
    const match = pageText.match(pattern);
    if (match) {
      console.log(`Pattern ${i} matched:`, match[0]);
      console.log('Size:', match[1]);
    } else {
      console.log(`Pattern ${i}: No match`);
    }
  });

  // Search for specific keywords
  console.log('--- Searching for keywords ---');
  const keywords = ['dimensions', 'button', 'size', 'mm', 'weight', 'copper'];
  keywords.forEach(keyword => {
    const index = pageText.toLowerCase().indexOf(keyword);
    if (index !== -1) {
      const snippet = pageText.substring(Math.max(0, index - 50), Math.min(pageText.length, index + 100));
      console.log(`"${keyword}" found at position ${index}:`);
      console.log(`...${snippet}...`);
    } else {
      console.log(`"${keyword}" not found`);
    }
  });

  console.log('=== END DEBUG ===');
}

console.log('Debug helper loaded. Run debugExtract() to see extraction details.');
