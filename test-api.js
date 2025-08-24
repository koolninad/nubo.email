// Test API endpoints locally
const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

async function testEndpoints() {
  console.log('Testing API endpoints...\n');
  
  // Test 1: Health check
  try {
    const health = await axios.get('http://localhost:5001/health');
    console.log('✅ Health check:', health.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
  
  // Test 2: API root
  try {
    const api = await axios.get('http://localhost:5001/api');
    console.log('✅ API root:', api.data);
  } catch (error) {
    console.log('❌ API root failed:', error.message);
  }
  
  // Test 3: Username check (should work even without DB if we handle errors)
  try {
    const username = await axios.get(`${API_URL}/auth/check-username/testuser`);
    console.log('✅ Username check:', username.data);
  } catch (error) {
    console.log('❌ Username check failed:', error.response?.data || error.message);
  }
  
  // Test 4: Login endpoint
  try {
    const login = await axios.post(`${API_URL}/auth/login`, {
      username: 'test',
      password: 'test'
    });
    console.log('✅ Login:', login.data);
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data || error.message);
  }
  
  // Test 5: Signup endpoint
  try {
    const signup = await axios.post(`${API_URL}/auth/signup`, {
      username: 'newuser',
      email: 'new@example.com',
      password: 'password123'
    });
    console.log('✅ Signup:', signup.data);
  } catch (error) {
    console.log('❌ Signup failed:', error.response?.data || error.message);
  }
}

testEndpoints();