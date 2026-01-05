#!/usr/bin/env node

/**
 * Parser Tests
 * Run with: node extension/tests/parser-tests.js
 *
 * Tests the parsing logic without needing to load the browser extension.
 * This helps catch regressions when modifying regex patterns.
 */

// Load modules (using require for Node.js)
const path = require('path');

// Mock window object for browser modules
global.window = {};

// Load our modules
require(path.join(__dirname, '../utils/materials.js'));
require(path.join(__dirname, '../utils/text-normalizer.js'));
require(path.join(__dirname, '../utils/parsers.js'));

const { Materials, TextNormalizer, Parsers } = global.window;

// Test results tracking
let passed = 0;
let failed = 0;
const failures = [];

// Test helper
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed++;
    failures.push({ name, error: error.message });
    console.log(`  ❌ ${name}`);
    console.log(`     ${error.message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n     Expected: "${expected}"\n     Actual:   "${actual}"`);
  }
}

function assertNotNull(actual, message = '') {
  if (actual === null || actual === undefined) {
    throw new Error(`${message}\n     Expected non-null value, got: ${actual}`);
  }
}

// ============================================================
// Text Normalizer Tests
// ============================================================
console.log('\n📝 Text Normalizer Tests');

test('normalizes fullwidth colon', () => {
  const result = TextNormalizer.normalizeText('Weight：113g');
  assertEqual(result, 'Weight:113g');
});

test('normalizes multiplication sign', () => {
  const result = TextNormalizer.normalizeText('48mm × 29mm × 16mm');
  assertEqual(result, '48mm x 29mm x 16mm');
});

test('normalizes en-dash', () => {
  const result = TextNormalizer.normalizeText('Dawn T – Titanium');
  assertEqual(result, 'Dawn T - Titanium');
});

test('normalizes multiple spaces', () => {
  const result = TextNormalizer.normalizeText('Weight:   113g');
  assertEqual(result, 'Weight: 113g');
});

test('normalizes fullwidth numbers', () => {
  const result = TextNormalizer.normalizeText('１２３');
  assertEqual(result, '123');
});

test('detects price pattern with .00', () => {
  const result = TextNormalizer.looksLikePrice('225.00');
  assertEqual(result, true);
});

test('does not detect weight as price', () => {
  const result = TextNormalizer.looksLikePrice('113g');
  assertEqual(result, false);
});

test('normalizes weight string', () => {
  const result = TextNormalizer.normalizeWeightString('113 grams');
  assertEqual(result, '113g');
});

test('handles double g in weight', () => {
  const result = TextNormalizer.normalizeWeightString('113gg');
  assertEqual(result, '113g');
});

// ============================================================
// Material Tests
// ============================================================
console.log('\n🔧 Material Tests');

test('expands Ti abbreviation', () => {
  const result = Materials.expandMaterialAbbreviation('Ti');
  assertEqual(result, 'Titanium');
});

test('expands SS abbreviation', () => {
  const result = Materials.expandMaterialAbbreviation('SS');
  assertEqual(result, 'Stainless Steel');
});

test('expands Zr abbreviation', () => {
  const result = Materials.expandMaterialAbbreviation('Zr');
  assertEqual(result, 'Zirconium');
});

test('expands Zirc abbreviation', () => {
  const result = Materials.expandMaterialAbbreviation('Zirc');
  assertEqual(result, 'Zirconium');
});

test('expands W abbreviation', () => {
  const result = Materials.expandMaterialAbbreviation('W');
  assertEqual(result, 'Tungsten');
});

test('expands compound material Zr+W', () => {
  const result = Materials.expandMaterialAbbreviation('Zr+W');
  assertEqual(result, 'Zirconium + Tungsten');
});

test('expands compound material Ti&Cu', () => {
  const result = Materials.expandMaterialAbbreviation('Ti&Cu');
  assertEqual(result, 'Titanium & Copper');
});

test('preserves full material name', () => {
  const result = Materials.expandMaterialAbbreviation('Titanium');
  assertEqual(result, 'Titanium');
});

test('finds material in text', () => {
  const result = Materials.findMaterial('This is made of Titanium');
  assertEqual(result, 'Titanium');
});

test('finds abbreviated material in text', () => {
  const result = Materials.findMaterial('Material: SS polished');
  assertEqual(result, 'Stainless Steel');
});

test('identifies finish correctly', () => {
  const result = Materials.isFinish('Stonewashed');
  assertEqual(result, true);
});

test('does not identify material as finish', () => {
  const result = Materials.isFinish('Titanium');
  assertEqual(result, false);
});

test('strips material prefix from name', () => {
  const result = Materials.stripMaterialFromName('Titanium Stubby');
  assertEqual(result, 'Stubby');
});

test('strips material suffix from name', () => {
  const result = Materials.stripMaterialFromName('Dawn T Brass');
  assertEqual(result, 'Dawn T');
});

test('strips material-finish combo from name', () => {
  const result = Materials.stripMaterialFromName('Dawn T Brass-Distressed');
  assertEqual(result, 'Dawn T');
});

test('strips TWEDC style name format', () => {
  const result = Materials.stripMaterialFromName('Cloudspin - Titanium - Sand blasted');
  assertEqual(result, 'Cloudspin');
});

// ============================================================
// Parser Tests - Dimensions
// ============================================================
console.log('\n📐 Dimension Parser Tests');

test('parses 3D dimensions with mm', () => {
  const result = Parsers.parseDimensions('48mm x 29mm x 16mm');
  assertEqual(result.dimensions, '48mm x 29mm x 16mm');
});

test('parses labeled dimensions', () => {
  const result = Parsers.parseDimensions('Dimensions: 48mm x 29mm x 16mm');
  assertEqual(result.dimensions, '48mm x 29mm x 16mm');
});

test('parses dimensions without units', () => {
  const result = Parsers.parseDimensions('Size: 48 x 29 x 16');
  assertEqual(result.dimensions, '48mm x 29mm x 16mm');
});

test('parses LWH separate format', () => {
  const result = Parsers.parseDimensions('Length: 46mm • Width of body: 20mm • Thickness: 14mm');
  assertEqual(result.dimensions, '46mm x 20mm x 14mm');
});

test('parses body length only format', () => {
  const result = Parsers.parseDimensions('body length: 45.5mm');
  assertEqual(result.dimensions, '45.5mm');
});

test('parses decimal dimensions', () => {
  const result = Parsers.parseDimensions('48.5mm x 29.5mm x 16.5mm');
  assertEqual(result.dimensions, '48.5mm x 29.5mm x 16.5mm');
});

test('parses KapEDC long/wide/thickness format', () => {
  const result = Parsers.parseDimensions('the size is 50mm long, 27mm wide,thickness is 15mm');
  assertEqual(result.dimensions, '50mm x 27mm x 15mm');
});

test('parses KapEDC size is format', () => {
  const result = Parsers.parseDimensions('size is 50mm long, 27mm wide');
  assertEqual(result.dimensions, '50mm x 27mm');
});

// ============================================================
// Parser Tests - Weight
// ============================================================
console.log('\n⚖️ Weight Parser Tests');

test('parses labeled weight', () => {
  const result = Parsers.parseWeight('Weight: 113g');
  assertEqual(result.weight, '113g');
});

test('parses inline weight', () => {
  const result = Parsers.parseWeight('The spinner weighs about 95g and');
  assertEqual(result.weight, '95g');
});

test('parses weight with grams unit', () => {
  const result = Parsers.parseWeight('Weight: 113 grams');
  assertEqual(result.weight, '113g');
});

test('parses weight in oz', () => {
  const result = Parsers.parseWeight('Weight: 4oz');
  assertEqual(result.weight, '4oz');
});

test('parses multi-material weights', () => {
  const result = Parsers.parseWeight('SS 55g Ti 30g Zr 46g W 140g');
  assertNotNull(result.allWeights, 'Should have allWeights array');
  assertEqual(result.allWeights.length, 4);
});

test('matches multi-material weight to target', () => {
  const result = Parsers.parseWeight('SS 55g Ti 30g Zr 46g W 140g', 'Titanium');
  assertEqual(result.weight, '30g');
});

test('matches multi-material weight to Zirconium', () => {
  const result = Parsers.parseWeight('SS 55g Ti 30g Zr 46g W 140g', 'Zirconium');
  assertEqual(result.weight, '46g');
});

test('matches multi-material weight to Tungsten', () => {
  const result = Parsers.parseWeight('SS 55g Ti 30g Zr 46g W 140g', 'Tungsten');
  assertEqual(result.weight, '140g');
});

test('does not match price as weight', () => {
  const text = 'Price: $225.00 Weight: 95g';
  const result = Parsers.parseWeight(text);
  assertEqual(result.weight, '95g');
});

// ============================================================
// Parser Tests - Button Size
// ============================================================
console.log('\n🔘 Button Size Parser Tests');

test('parses button size labeled', () => {
  const result = Parsers.parseButtonSize('Button Size: 24.5mm');
  assertEqual(result.buttonSize, '24.5mm');
});

test('parses button diameter', () => {
  const result = Parsers.parseButtonSize('button diameter: 24.5mm');
  assertEqual(result.buttonSize, '24.5mm');
});

test('parses button sizes with slash', () => {
  const result = Parsers.parseButtonSize('Button Sizes: 24.5mm / 17mm');
  assertEqual(result.buttonSize, '24.5mm');
});

test('parses mm button format', () => {
  const result = Parsers.parseButtonSize('comes with a 24.5mm button');
  assertEqual(result.buttonSize, '24.5mm');
});

test('parses KapEDC button is format', () => {
  const result = Parsers.parseButtonSize('button is 24.5mmX15mm');
  assertEqual(result.buttonSize, '24.5mm');
});

// ============================================================
// Parser Tests - Material
// ============================================================
console.log('\n🧱 Material Parser Tests');

test('parses material from title with dash', () => {
  const result = Parsers.parseMaterial('Cloudspin - Titanium - Sand blasted');
  assertEqual(result.material, 'Titanium');
});

test('parses labeled material', () => {
  const result = Parsers.parseMaterial('Material: Tungsten Finish: Polished');
  assertEqual(result.material, 'Tungsten');
});

test('parses compound material', () => {
  const result = Parsers.parseMaterial('Material: Zr+W');
  assertNotNull(result.material);
  // Should contain both expanded materials
  assertEqual(result.material.includes('Zirconium'), true);
  assertEqual(result.material.includes('Tungsten'), true);
});

test('expands material abbreviation SS', () => {
  const result = Parsers.parseMaterial('Product - SS - Polished');
  assertEqual(result.material, 'Stainless Steel');
});

// ============================================================
// Full Product Info Parser Tests
// ============================================================
console.log('\n📦 Full Product Info Parser Tests');

test('parses ziiistudio product', () => {
  const text = 'Dawn T Material: Zr+W Weight: 113g Button: 24mm';
  const result = Parsers.parseProductInfo(text);

  assertNotNull(result.material, 'Should have material');
  assertEqual(result.weight, '113g');
  assertEqual(result.buttonSize, '24mm');
});

test('parses TWEDC product with multi-material', () => {
  const text = 'Cloudspin - Titanium - Sand blasted body length: 45.5mm button diameter: 24.5mm SS 55g Ti 30g Zr 46g W 140g';
  const result = Parsers.parseProductInfo(text);

  assertEqual(result.material, 'Titanium');
  assertEqual(result.weight, '30g'); // Should match Titanium weight
  assertEqual(result.buttonSize, '24.5mm');
  assertEqual(result.dimensions, '45.5mm');
});

test('parses CleanEDC product', () => {
  const text = 'Stainless Steel XL Slim Pillar Length: 46mm • Width: 20mm • Thickness: 14mm Weight: 90g Button Size: 17mm';
  const result = Parsers.parseProductInfo(text);

  assertEqual(result.dimensions, '46mm x 20mm x 14mm');
  assertEqual(result.weight, '90g');
  assertEqual(result.buttonSize, '17mm');
});

test('handles fullwidth characters', () => {
  const text = 'Material：Titanium Weight：113g Dimensions：48mm×29mm×16mm';
  const result = Parsers.parseProductInfo(text);

  assertEqual(result.material, 'Titanium');
  assertEqual(result.weight, '113g');
  assertEqual(result.dimensions, '48mm x 29mm x 16mm');
});

test('parses KapEDC product', () => {
  const text = 'Bar cell hand spinner Standard material the size is 50mm long, 27mm wide,thickness is 15mm button is 24.5mmX15mm Weight:90g Stainless Steel';
  const result = Parsers.parseProductInfo(text);

  assertEqual(result.dimensions, '50mm x 27mm x 15mm');
  assertEqual(result.buttonSize, '24.5mm');
  assertEqual(result.weight, '90g');
});

test('parses Facebook post format', () => {
  const text = `New Drop! Phantom Mini
Titanium version available now!
50mm x 28mm x 15mm
Weight: 45g
Button size: 22mm
$185 shipped`;
  const result = Parsers.parseProductInfo(text);

  assertEqual(result.dimensions, '50mm x 28mm x 15mm');
  assertEqual(result.weight, '45g');
  assertEqual(result.buttonSize, '22mm');
  assertEqual(result.material, 'Titanium');
});

test('parses Facebook post with inline specs', () => {
  const text = 'Tungsten Stubby - 48x29x16mm, 95g, 24mm buttons. Pre-order now at $225';
  const result = Parsers.parseProductInfo(text);

  assertEqual(result.dimensions, '48mm x 29mm x 16mm');
  assertEqual(result.weight, '95g');
  assertEqual(result.material, 'Tungsten');
});

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\n❌ Failed Tests:');
  failures.forEach(({ name, error }) => {
    console.log(`  - ${name}`);
    console.log(`    ${error}`);
  });
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
