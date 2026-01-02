import fetch from 'node-fetch';

const testData = {
  page_domain: 'example.com',
  user_language: 'en',
  field_context: {
    label: 'Email Address',
    type: 'email'
  }
};

async function testEndpoint() {
  try {
    const response = await fetch('http://localhost:3000/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    console.log('✅ Success! Response from /guidance endpoint:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEndpoint();
