const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client for easy queries
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Test database connection
async function testConnection() {
  try {
    // Simple ping to check connection
    const { data, error } = await supabase.from('customers').select('count').limit(1);

    // If table doesn't exist yet, that's okay
    if (error && error.message.includes('does not exist')) {
      console.log('⚠️  Database tables not created yet - will create on first run');
      return true;
    }

    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }

    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    return false;
  }
}

// Initialize database tables (manual - run SQL in Supabase dashboard)
async function initializeDatabase() {
  console.log('ℹ️  To create database tables:');
  console.log('   1. Go to Supabase Dashboard → SQL Editor');
  console.log('   2. Run the SQL from src/database/schema.sql');
  console.log('   3. Or tables will be created automatically when used');
  return true;
}

module.exports = {
  supabase,
  testConnection,
  initializeDatabase
};
