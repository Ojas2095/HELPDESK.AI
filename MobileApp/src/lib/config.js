/**
 * Mobile App Configuration
 *
 * Supabase credentials are loaded from environment variables.
 * Create a .env file in the MobileApp/ directory with:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_ANON_KEY=your-anon-key-here
 *
 * See .env.example for the required variables.
 */

// In React Native / Expo, environment variables are injected at build time.
// For Expo: use expo-constants with extra in app.json, or use react-native-dotenv.
// For bare React Native: use react-native-config.
// Fallback to process.env which works with most bundlers (Metro, Webpack).

export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
