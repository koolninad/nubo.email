#!/usr/bin/env node

const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdmin() {
  console.log('\n🔐 Admin User Setup\n');
  
  try {
    const username = await question('Admin username: ');
    const email = await question('Admin email: ');
    const password = await question('Admin password: ');
    const adminSecret = process.env.ADMIN_SETUP_SECRET || await question('Admin setup secret (from .env): ');
    
    const response = await axios.post('http://localhost:5001/api/admin/setup', {
      username,
      email,
      password,
      adminSecret
    });
    
    console.log('\n✅ Admin user created successfully!');
    console.log('User ID:', response.data.user.id);
    console.log('Username:', response.data.user.username);
    console.log('Email:', response.data.user.email);
    console.log('\nYou can now login at /admin with these credentials.');
    
  } catch (error) {
    if (error.response) {
      console.error('\n❌ Error:', error.response.data.error);
    } else {
      console.error('\n❌ Error:', error.message);
    }
  }
  
  rl.close();
}

createAdmin();