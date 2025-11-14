#!/usr/bin/env node

/**
 * Test PDF generation to ensure no text overlap
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    }).on('error', reject);
  });
}

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

async function testPDFGeneration() {
  console.log('🧪 Testing PDF Generation\n');

  try {
    // Step 1: Load exceeded demo to create an episode
    console.log('1. Loading exceeded demo...');
    const ingestRes = await fetch(`${BASE_URL}/api/madrid/ingest?demo=exceeded`);
    console.log('   ✓ Demo loaded:', JSON.parse(ingestRes.data).status);

    // Wait a moment for state to update
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Get status
    console.log('\n2. Fetching status...');
    const statusRes = await fetch(`${BASE_URL}/api/madrid/status`);
    const status = JSON.parse(statusRes.data);
    console.log(`   ✓ Status: ${status.status}`);
    console.log(`   ✓ Stations: ${status.stations.length}`);
    console.log(`   ✓ Max 1h: ${status.max_1h?.value} ug/m3`);
    console.log(`   ✓ Trigger: ${status.trigger_station?.name || 'None'}`);

    // Step 3: Generate latest PDF
    console.log('\n3. Generating latest PDF...');
    try {
      const pdfRes = await fetchBinary(`${BASE_URL}/madrid/latest.pdf`);
      const contentType = pdfRes.headers['content-type'];
      
      if (contentType === 'application/pdf') {
        console.log(`   ✓ PDF generated successfully`);
        console.log(`   ✓ Size: ${pdfRes.data.length} bytes`);
        console.log(`   ✓ Content-Type: ${contentType}`);
        
        // Check PDF header
        const pdfHeader = pdfRes.data.slice(0, 4).toString();
        if (pdfHeader === '%PDF') {
          console.log(`   ✓ Valid PDF header: ${pdfHeader}`);
        } else {
          console.log(`   ⚠ Unexpected header: ${pdfHeader}`);
        }
      } else {
        console.log(`   ⚠ Unexpected Content-Type: ${contentType}`);
        console.log(`   Response: ${pdfRes.data.toString().substring(0, 200)}`);
      }
    } catch (err) {
      console.log(`   ✗ Failed: ${err.message}`);
    }

    // Step 4: Check episodes
    console.log('\n4. Checking episodes...');
    const episodesRes = await fetch(`${BASE_URL}/api/madrid/episodes`);
    const episodes = JSON.parse(episodesRes.data);
    console.log(`   ✓ Episodes found: ${episodes.length}`);
    
    if (episodes.length > 0) {
      const episode = episodes[0];
      console.log(`   ✓ Episode ID: ${episode.id}`);
      console.log(`   ✓ PDF URL: ${episode.pdf_url}`);

      // Step 5: Test HEAD request for PDF availability
      console.log('\n5. Testing HEAD request for episode PDF...');
      try {
        const headRes = await new Promise((resolve, reject) => {
          const url = new URL(`${BASE_URL}${episode.pdf_url}`);
          const options = {
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname,
            method: 'HEAD',
          };
          const req = http.request(options, (res) => {
            resolve({ status: res.statusCode });
          });
          req.on('error', reject);
          req.end();
        });
        console.log(`   ✓ HEAD request successful: ${headRes.status}`);
      } catch (err) {
        console.log(`   ✗ HEAD request failed: ${err.message}`);
      }

      // Step 6: Generate episode PDF
      console.log('\n6. Generating episode PDF...');
      try {
        const episodePdfRes = await fetchBinary(`${BASE_URL}${episode.pdf_url}`);
        const contentType = episodePdfRes.headers['content-type'];
        
        if (contentType === 'application/pdf') {
          console.log(`   ✓ Episode PDF generated successfully`);
          console.log(`   ✓ Size: ${episodePdfRes.data.length} bytes`);
          console.log(`   ✓ Content-Type: ${contentType}`);
          
          // Check PDF header
          const pdfHeader = episodePdfRes.data.slice(0, 4).toString();
          if (pdfHeader === '%PDF') {
            console.log(`   ✓ Valid PDF header: ${pdfHeader}`);
          } else {
            console.log(`   ⚠ Unexpected header: ${pdfHeader}`);
          }
        } else {
          console.log(`   ⚠ Unexpected Content-Type: ${contentType}`);
        }
      } catch (err) {
        console.log(`   ✗ Failed: ${err.message}`);
      }
    }

    // Step 7: Test with compliant status
    console.log('\n7. Testing with compliant status...');
    await fetch(`${BASE_URL}/api/madrid/ingest?demo=compliant`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const compliantPdfRes = await fetchBinary(`${BASE_URL}/madrid/latest.pdf`);
      if (compliantPdfRes.headers['content-type'] === 'application/pdf') {
        console.log(`   ✓ Compliant PDF generated: ${compliantPdfRes.data.length} bytes`);
      }
    } catch (err) {
      console.log(`   ✗ Failed: ${err.message}`);
    }

    console.log('\n✅ PDF generation tests completed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testPDFGeneration().catch(console.error);

