// Consolidated site configuration
// Single source of truth for all site-specific settings

const SITES = {
  // ziiistudio.com - Shopify with Dawn theme
  'ziiistudio.com': {
    groupName: 'Ziii Studio',
    pageType: 'ziiistudio',
    singleVariant: true,  // Products have one material variant, images show angles not variants
    selectors: {
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
    },
    parsing: {
      useTitleForMaterial: true,
      // Material often in format "Product Name - Material" or in description
      materialPattern: /material\s*:\s*([A-Za-z0-9+&]+)/i
    }
  },

  // twedcstudio.com - Shopify
  'twedcstudio.com': {
    groupName: 'TW EDC',
    pageType: 'twedc',
    singleVariant: true,
    selectors: {
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
    },
    parsing: {
      useTitleForMaterial: true,
      multiMaterialWeights: true,  // Parse "SS 55g Ti 30g Zr 46g W 140g" format
      // Title format: "Product Name - Material - Finish"
      materialPattern: /[-]\s*(Titanium|Zirconium|Tungsten|Stainless\s*Steel|Copper|Brass|Ti|Zr|W|SS|Cu)(?:\s*[-]|$)/i,
      dimensionFormat: 'body-length'  // Uses "body length: 45mm" format
    }
  },

  // cleanedc.com - Shopify
  'cleanedc.com': {
    groupName: 'Clean EDC',
    pageType: 'shopify',
    singleVariant: true,  // Finish variants, not material variants
    selectors: {
      title: [
        '.product-single__title',
        'h1.product__title',
        '.product-title'
      ],
      description: [
        '.product-single__description',
        '.product__description',
        '.product-description'
      ],
      image: [
        '.product__image img',
        '[data-product-image]',
        '.product-single__photo img',
        'meta[property="og:image"]'
      ],
      price: [
        '.product__price',
        'span.money',
        '.price'
      ]
    },
    parsing: {
      // Material is often in product name: "Brass XL Slim Pillar"
      extractMaterialFromName: true,
      // Dimensions in format: "Length: 46mm • Width: 20mm • Thickness: 14mm"
      dimensionFormat: 'lwh-separate'
    }
  },

  // kapedc.com - Shopify
  'kapedc.com': {
    groupName: 'Kinetics Asia Pacific EDC',
    pageType: 'shopify',
    singleVariant: false,  // Has material variants
    selectors: {
      title: [
        '.product-single__title',
        'h1.product__title',
        '.product-title'
      ],
      description: [
        '.product-single__description',
        '.product__description'
      ],
      image: [
        '.product__image img',
        '[data-product-image]',
        'meta[property="og:image"]'
      ],
      price: [
        '.product__price',
        'span.money'
      ]
    },
    parsing: {
      useJsonLd: true  // Has good JSON-LD structured data
    }
  },

  // m3metalcreations.com
  'm3metalcreations.com': {
    groupName: 'M3 Metal Creations',
    pageType: 'shopify',
    singleVariant: false,
    selectors: null,  // Use default shopify selectors
    parsing: {
      useJsonLd: true
    }
  },

  // indythiccedc.myshopify.com
  'indythiccedc.myshopify.com': {
    groupName: 'iNDY THiCC EDC',
    pageType: 'shopify',
    singleVariant: false,
    selectors: null,
    parsing: {
      useJsonLd: true
    }
  },

  // licedc.myshopify.com
  'licedc.myshopify.com': {
    groupName: 'LIC edc',
    pageType: 'shopify',
    singleVariant: false,
    selectors: null,
    parsing: {
      useJsonLd: true
    }
  },

  // modusworks.myshopify.com
  'modusworks.myshopify.com': {
    groupName: 'Modus Works',
    pageType: 'shopify',
    singleVariant: false,
    selectors: null,
    parsing: {
      useJsonLd: true
    }
  }
};

// Default selectors for unknown sites
const DEFAULT_SELECTORS = {
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
      'meta[property="og:image"]',
      'meta[property="og:image:secure_url"]',
      '.product-gallery__image img',
      '.product__image img',
      '.slick-slide img',
      '.product-single__photo img',
      '.product__media img',
      '[data-product-image]',
      '.product-image img',
      'img[itemprop="image"]'
    ],
    price: [
      '.price',
      '[itemprop="price"]',
      '.product-price',
      'meta[property="product:price:amount"]'
    ]
  },

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
    image: [
      '.product__image img',
      '[data-product-image]',
      '.product-single__photo img',
      '.product__media img',
      'img.product__image',
      '.product-gallery__image img',
      '.slick-slide img',
      'meta[property="og:image"]',
      'meta[property="og:image:secure_url"]'
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
    ]
  },

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
  }
};

/**
 * Get site configuration for a hostname
 * @param {string} hostname - The hostname (with or without www.)
 * @returns {object|null} - Site config or null if not found
 */
function getSiteConfig(hostname) {
  // Strip www. prefix
  const cleanHost = hostname.replace(/^www\./, '');
  return SITES[cleanHost] || null;
}

/**
 * Get selectors for a site
 * @param {string} hostname - The hostname
 * @returns {object} - Selectors to use
 */
function getSelectorsForSite(hostname) {
  const config = getSiteConfig(hostname);

  if (config && config.selectors) {
    return config.selectors;
  }

  // Fall back to page type defaults
  if (config && config.pageType && DEFAULT_SELECTORS[config.pageType]) {
    return DEFAULT_SELECTORS[config.pageType];
  }

  return DEFAULT_SELECTORS.generic;
}

/**
 * Detect page type from hostname
 * @param {string} hostname - The hostname
 * @returns {string} - The page type
 */
function detectPageType(hostname) {
  const config = getSiteConfig(hostname);

  if (config && config.pageType) {
    return config.pageType;
  }

  // Check for Shopify patterns
  if (hostname.includes('myshopify.com')) {
    return 'shopify';
  }

  if (hostname.includes('facebook.com')) {
    return 'facebook';
  }

  return 'generic';
}

/**
 * Get group name for a hostname
 * @param {string} hostname - The hostname
 * @returns {string|null} - The group name or null
 */
function getGroupName(hostname) {
  const config = getSiteConfig(hostname);
  return config ? config.groupName : null;
}

/**
 * Check if site has single-variant products
 * @param {string} hostname - The hostname
 * @returns {boolean} - True if single-variant site
 */
function isSingleVariantSite(hostname) {
  const config = getSiteConfig(hostname);
  return config ? config.singleVariant === true : false;
}

/**
 * Get parsing options for a site
 * @param {string} hostname - The hostname
 * @returns {object} - Parsing options
 */
function getParsingOptions(hostname) {
  const config = getSiteConfig(hostname);
  return config && config.parsing ? config.parsing : {};
}

// Export for browser context
if (typeof window !== 'undefined') {
  window.SiteConfig = {
    SITES,
    DEFAULT_SELECTORS,
    getSiteConfig,
    getSelectorsForSite,
    detectPageType,
    getGroupName,
    isSingleVariantSite,
    getParsingOptions
  };
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SITES,
    DEFAULT_SELECTORS,
    getSiteConfig,
    getSelectorsForSite,
    detectPageType,
    getGroupName,
    isSingleVariantSite,
    getParsingOptions
  };
}
