const fs = require('fs');
const path = require('path');

const API_KEY = process.env.API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4NGQ2N2YzMC0xMGM5LTQ2MDMtOGI0MC1iZWNjM2NhZGE5M2MiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDUzMWJhYjYtZTlkYy00MGYwLWE4YTgtOWM3Mjg1NTk3YWRmIiwiaWF0IjoxNzczMDMzMTQ0LCJleHAiOjE3NzU2MjA4MDB9.h5p5lR4XcLirW47GNOAnMezQZBAv1j9ZlD-C_pdH3ls';
const N8N_URL = 'http://localhost:5678/api/v1/workflows';

const dir = path.join(__dirname, '..', 'docs', 'n8n');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

async function run() {
  for (const file of files) {
    const contentText = fs.readFileSync(path.join(dir, file), 'utf8');
    let content;
    try {
      content = JSON.parse(contentText);
    } catch {
      continue;
    }
    
    // Only send the core workflow properties 
    const cleanContent = {
      name: content.name,
      nodes: content.nodes,
      connections: content.connections,
      settings: content.settings,
    };
    
    const res = await fetch(N8N_URL, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cleanContent)
    });
    
    if (res.status === 200 || res.status === 201) {
       const w = await res.json();
       console.log(`[SUCCESS] Imported ${file} (ID: ${w.id})`);
       
       // Activate workflow
       const actRes = await fetch(`${N8N_URL}/${w.id}/activate`, {
         method: 'POST',
         headers: { 'X-N8N-API-KEY': API_KEY }
       });
       if (actRes.ok) {
         console.log(`  -> Activated ${w.id}`);
       } else {
         console.log(`  -> Failed to activate ${w.id} (${actRes.status})`);
       }
    } else {
       console.log(`[FAILED] Imported ${file} - Status: ${res.status}`);
       console.log(await res.text());
    }
  }
}
run();
