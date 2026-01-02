import fetch from 'node-fetch';

const testDataHindi = {
  page_domain: 'example.com',
  user_language: 'hi-IN',
  field_context: {
    label_text: 'Email Address',
    type: 'email',
    placeholder: 'your@email.com'
  }
};

async function testHindi() {
  try {
    console.log('Testing with Hindi language...\n');
    const response = await fetch('http://localhost:3000/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testDataHindi)
    });
    
    const result = await response.json();
    console.log('✅ Response in Hindi:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testHindi();
