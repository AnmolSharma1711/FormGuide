import fetch from 'node-fetch';

// Replace this with your actual Vercel URL
const VERCEL_URL = "https://form-guide.vercel.app";

const testData = {
  page_domain: 'example.com',
  user_language: 'hi-IN',
  field_context: {
    label_text: 'Email Address',
    type: 'email'
  }
};

async function testDeployment() {
  try {
    console.log(`Testing: ${VERCEL_URL}/guidance\n`);
    
    const response = await fetch(`${VERCEL_URL}/guidance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    if (!response.ok) {
      console.error(`❌ Error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Backend is working! Response:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDeployment();
