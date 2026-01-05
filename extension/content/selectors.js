// Site-specific selectors for product information extraction
// Uses centralized SiteConfig module if available, otherwise falls back to local definitions

// Check if SiteConfig is available (loaded from config/sites.js)
const useSiteConfig = typeof window !== 'undefined' && window.SiteConfig;

// Get selectors - use SiteConfig if available, otherwise use local SELECTORS
function getSelectors(pageType) {
  if (useSiteConfig) {
    const hostname = window.location.hostname;
    return window.SiteConfig.getSelectorsForSite(hostname);
  }
  return SELECTORS[pageType] || SELECTORS.generic;
}

// Local SELECTORS definition (fallback when SiteConfig not loaded)
const SELECTORS = {
  // Generic selectors (fallback)
  generic: {
    title: [
      'h1',
      '.product-title',
      '.product-name',
      '[itemprop="name"]',
      'meta[property="og:title"]',
      'title'
    ],
    description: [
      '.product-description',
      '[itemprop="description"]',
      'meta[name="description"]',
      'meta[property="og:description"]'
    ],
    image: [
      // Meta tags first (most reliable)
      'meta[property="og:image"]',
      'meta[property="og:image:secure_url"]',
      // Product gallery images (various themes)
      '.product-gallery__image img',
      '.product__image img',
      '.slick-slide img',
      '.product-single__photo img',
      '.product__media img',
      '[data-product-image]',
      // Generic product images
      '.product-image img',
      'img[itemprop="image"]',
      '.main-image img',
      'img.featured-image',
      // Gallery/slider patterns
      '.gallery-image img',
      '.slider-image img',
      '[class*="product"] [class*="image"] img',
      '[class*="product"] [class*="gallery"] img'
    ],
    price: [
      '.price',
      '[itemprop="price"]',
      '.product-price',
      'meta[property="product:price:amount"]'
    ]
  },

  // Shopify-specific selectors
  shopify: {
    title: [
      '.product-single__title',
      'h1.product__title',
      '.product-title',
      'h1.product-single__title'
    ],
    description: [
      '.product-single__description',
      '.product__description',
      '.product-description'
    ],
    price: [
      '.product__price',
      'span.money',
      '.price',
      '.product-price'
    ],
    variants: [
      'select[name="id"] option',
      '.variant-input',
      '.product-form__variants option'
    ],
    image: [
      // Shopify-specific first
      '.product__image img',
      '[data-product-image]',
      '.product-single__photo img',
      '.product__media img',
      'img.product__image',
      '.product-gallery__image img',
      '.slick-slide img',
      // Then fallback to generic
      'meta[property="og:image"]',
      'meta[property="og:image:secure_url"]',
      '.product-image img',
      'img[itemprop="image"]'
    ]
  },

  // Facebook-specific selectors
  facebook: {
    postText: [
      '[data-ad-preview="message"]',
      '.userContent',
      '[data-testid="post_message"]',
      'div[dir="auto"]'
    ],
    postImages: [
      'img[data-visualcompletion="media-vc-image"]',
      '.spotlight img',
      'img[src*="scontent"]'
    ],
    groupName: [
      'h1[role="heading"]',
      'a[role="link"][aria-label*="group"]',
      'h2 a[href*="/groups/"]'
    ]
  },

  // ziiistudio.com-specific selectors (Shopify with Dawn theme)
  ziiistudio: {
    title: [
      'meta[property="og:title"]',
      '.product__title',
      'h1.product__title'
    ],
    description: [
      'meta[name="description"]',
      'meta[property="og:description"]',
      '.product__description'
    ],
    image: [
      // Use OG image first (single main image), avoid gallery which has multiple angles
      'meta[property="og:image"]',
      'meta[property="og:image:secure_url"]',
      // Fallback to first gallery image only if OG image not found
      '.product__media-item.is-active img',
      '.product__media-list img'
    ],
    price: [
      'meta[property="og:price:amount"]',
      '.product__price',
      'span.money'
    ]
  },

  // twedcstudio.com-specific selectors (Shopify)
  twedc: {
    title: [
      'meta[property="og:title"]',
      '.product__title',
      'h1.product__title'
    ],
    description: [
      'meta[name="description"]',
      'meta[property="og:description"]',
      '.product__description'
    ],
    image: [
      'meta[property="og:image"]',
      'meta[property="og:image:secure_url"]',
      '.product__media-item.is-active img',
      '.product__media-list img'
    ],
    price: [
      'meta[property="og:price:amount"]',
      '.product__price',
      'span.money'
    ]
  }
};

// Known maker domains for better detection
// IMPORTANT: Must match group_name exactly as it appears in fidgets.json
const KNOWN_DOMAINS = {
  'cleanedc.com': 'Clean EDC',
  'indythiccedc.myshopify.com': 'iNDY THiCC EDC',
  'licedc.myshopify.com': 'LIC edc',
  'modusworks.myshopify.com': 'Modus Works',
  'kapedc.com': 'Kinetics Asia Pacific EDC',
  'm3metalcreations.com': 'M3 Metal Creations',
  'ziiistudio.com': 'Ziii Studio',
  'twedcstudio.com': 'TW EDC'
};

// Detect page type
function detectPageType() {
  // Use SiteConfig if available
  if (useSiteConfig) {
    return window.SiteConfig.detectPageType(window.location.hostname);
  }

  // Fallback to local detection
  const hostname = window.location.hostname.replace(/^www\./, ''); // Strip www. prefix
  const bodyClasses = document.body.className;

  if (hostname.includes('facebook.com')) {
    return 'facebook';
  } else if (hostname === 'ziiistudio.com') {
    return 'ziiistudio';
  } else if (hostname === 'twedcstudio.com') {
    return 'twedc';
  } else if (bodyClasses.includes('shopify') || hostname.includes('myshopify.com')) {
    return 'shopify';
  }

  return 'generic';
}

// Detect group name from domain
function detectGroupFromDomain() {
  // Use SiteConfig if available
  if (useSiteConfig) {
    return window.SiteConfig.getGroupName(window.location.hostname);
  }

  // Fallback to local lookup
  const hostname = window.location.hostname.replace(/^www\./, ''); // Strip www. prefix
  return KNOWN_DOMAINS[hostname] || null;
}

// Check if site has single-variant products
function isSingleVariantSite() {
  if (useSiteConfig) {
    return window.SiteConfig.isSingleVariantSite(window.location.hostname);
  }

  // Fallback: check known single-variant sites
  const hostname = window.location.hostname.replace(/^www\./, '');
  return ['ziiistudio.com', 'twedcstudio.com', 'cleanedc.com'].includes(hostname);
}

// Get parsing options for current site
function getParsingOptions() {
  if (useSiteConfig) {
    return window.SiteConfig.getParsingOptions(window.location.hostname);
  }
  return {};
}
