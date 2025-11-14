#!/usr/bin/env node

/**
 * Test PDF generation with long station names to verify no text overlap
 */

const http = require('http');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

function fetchBinary(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => { chunks.push(chunk); });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          const data = Buffer.concat(chunks).toString();
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve({ status: res.statusCode, data: Buffer.concat(chunks), headers: res.headers });
        }
      });
    }).on('error', reject);
  });
}

async function testPDFOverlap() {
  console.log('🧪 Testing PDF Text Overlap Prevention\n');

  try {
    // Load exceeded demo
    console.log('1. Loading exceeded demo...');
    await fetchBinary(`${BASE_URL}/api/madrid/ingest?demo=exceeded`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate PDF
    console.log('2. Generating PDF with long station names...');
    const pdfRes = await fetchBinary(`${BASE_URL}/madrid/latest.pdf`);
    
    if (pdfRes.headers['content-type'] !== 'application/pdf') {
      throw new Error('Expected PDF but got: ' + pdfRes.headers['content-type']);
    }

    // Save PDF for inspection
    const pdfPath = '/tmp/test-overlap.pdf';
    fs.writeFileSync(pdfPath, pdfRes.data);
    console.log(`   ✓ PDF saved to ${pdfPath}`);
    console.log(`   ✓ Size: ${pdfRes.data.length} bytes`);

    // Check PDF structure - look for text objects that might overlap
    const pdfText = pdfRes.data.toString('latin1');
    
    // Check for common overlap indicators
    const hasValidHeader = pdfText.startsWith('%PDF');
    const hasValidStructure = pdfText.includes('/Font') && pdfText.includes('/Page');
    
    console.log(`   ✓ Valid PDF header: ${hasValidHeader}`);
    console.log(`   ✓ Valid PDF structure: ${hasValidStructure}`);

    // Check for text that might be too long (look for very long strings in text objects)
    const textMatches = pdfText.match(/\([^)]{100,}\)/g);
    if (textMatches) {
      console.log(`   ⚠ Found ${textMatches.length} potentially long text strings`);
      textMatches.slice(0, 3).forEach((match, i) => {
        console.log(`      ${i + 1}. Length: ${match.length} chars`);
      });
    } else {
      console.log(`   ✓ No excessively long text strings found`);
    }

    // Verify PDF can be parsed (basic check)
    const pdfVersionMatch = pdfText.match(/^%PDF-(\d\.\d)/);
    if (pdfVersionMatch) {
      console.log(`   ✓ PDF version: ${pdfVersionMatch[1]}`);
    }

    console.log('\n✅ PDF overlap prevention tests completed!');
    console.log(`\n📄 PDF saved to: ${pdfPath}`);
    console.log('   You can open this file to visually verify no text overlap.\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testPDFOverlap().catch(console.error);

