// Run from office dir so it can use the project's supabase-js
process.chdir('/home/michael/axis-revenue-os');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zvxlqwoyappxrcxaspbs.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2eGxxd295YXBweHJjeGFzcGJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIzNzc4OCwiZXhwIjoyMDkzODEzNzg4fQ.gbpV8PtMTrDL-HSpcwN-iCk0-1atTOw6yZN3B0jQ_1Y';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  console.log('Checking existing tables...');

  // Try to query agent_runs to see if it exists
  const { data, error } = await supabase.from('agent_runs').select('id').limit(1);

  if (!error) {
    console.log('agent_runs table already exists! Rows:', data ? data.length : 0);
    // Try inserting a test row
    const { error: insErr } = await supabase.from('agent_runs').insert({
      agent_id: 'session-fps-professional-rewrite',
      output: 'Three.js FPS professional rewrite complete. Bloom, HD chars, zone props, particles, loading screen. 1686 lines.',
      last_run: new Date().toISOString()
    });
    if (insErr) console.log('Insert error:', insErr.message);
    else console.log('Inserted session log row OK');
    return;
  }

  console.log('agent_runs does not exist:', error.message);
  console.log('');
  console.log('To create it, run this SQL in your Supabase dashboard:');
  console.log('https://supabase.com/dashboard/project/zvxlqwoyappxrcxaspbs/sql/new');
  console.log('');
  console.log('--- SQL TO RUN ---');
  console.log(`
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    text NOT NULL,
  output      text,
  last_run    timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access" ON public.agent_runs
  FOR ALL USING (true) WITH CHECK (true);

-- Verify
SELECT COUNT(*) FROM public.agent_runs;
  `);
  console.log('--- END SQL ---');
  console.log('');

  // Try via rpc exec_sql if it exists
  console.log('Trying rpc exec_sql...');
  const createSQL = `
    CREATE TABLE IF NOT EXISTS public.agent_runs (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      agent_id text NOT NULL,
      output text,
      last_run timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "service_full" ON public.agent_runs FOR ALL USING (true);
  `;
  const { data: rpcData, error: rpcErr } = await supabase.rpc('exec_sql', { sql: createSQL });
  if (rpcErr) {
    console.log('rpc exec_sql not available:', rpcErr.message);
  } else {
    console.log('Table created via rpc:', rpcData);
  }
}

main().catch(e => console.error('FATAL:', e.message));
