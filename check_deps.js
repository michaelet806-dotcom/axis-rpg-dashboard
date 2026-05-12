['pg','@supabase/supabase-js','postgres'].forEach(p=>{
  try{require(p);console.log(p+': available');}
  catch(e){console.log(p+': NOT installed');}
});
// Also check office server node_modules
const fs=require('fs');
const path='/home/michael/axis-revenue-os/node_modules';
try{
  const mods=fs.readdirSync(path).filter(m=>['pg','postgres','supabase'].some(x=>m.includes(x)));
  console.log('office node_modules with pg/supabase:',mods.join(', ')||'none found');
}catch(e){console.log('Could not read node_modules:',e.message);}
