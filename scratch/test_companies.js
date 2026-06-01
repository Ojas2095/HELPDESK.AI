const https = require('https');

// Load credentials from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL) {
  console.error('[ERROR] SUPABASE_URL not set. Export it or add to .env');
  process.exit(1);
}

if (!SUPABASE_KEY) {
  console.error('[ERROR] SUPABASE_SERVICE_KEY not set. Export it or add to .env');
  process.exit(1);
}

const hostname = new URL(SUPABASE_URL).hostname;

const getRequest = (path) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      path,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

async function run() {
  console.log("Querying single ticket...");
  const res = await getRequest('/rest/v1/tickets?select=*&limit=1');
  console.log("Ticket status:", res.status);
  console.log("Ticket data:", res.data);
}

run();
