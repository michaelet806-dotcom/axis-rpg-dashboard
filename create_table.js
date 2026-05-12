const https = require('https');

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2eGxxd295YXBweHJjeGFzcGJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIzNzc4OCwiZXhwIjoyMDkzODEzNzg4fQ.gbpV8PtMTrDL-HSpcwN-iCk0-1atTOw6yZN3B0jQ_1Y';

function rpc(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'zvxlqwoyappxrcxaspbs.supabase.co',
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

// Use the management API to run SQL directly
function mgmtSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'zvxlqwoyappxrcxaspbs.supabase.co',
      path: '/rest/v1/rpc/run_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

// Insert via the agents table upsert workaround — or create via migrations
// Try direct POST to create table via REST doesn't work — use pg via service role
// Actually let's just try inserting into agent_runs — if 404, create via the SQL editor endpoint

async function createTable() {
  // Try the Supabase SQL execution via pg REST
  const createSQL = `
    CREATE TABLE IF NOT EXISTS public.agent_runs (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      agent_id text NOT NULL,
      output text,
      last_run timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "service_role_all" ON public.agent_runs FOR ALL USING (true);
  `;

  // Use pg connection via the server's existing Supabase client
  // Since we can't run raw SQL via REST API without a function, let's use the office server
  const data = JSON.stringify({ sql: createSQL });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/sql',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

createTable().then(r => console.log('Create table:', r.status, r.body.substring(0, 200)));
