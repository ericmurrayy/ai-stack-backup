const API_KEY = process.env.API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4NGQ2N2YzMC0xMGM5LTQ2MDMtOGI0MC1iZWNjM2NhZGE5M2MiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDUzMWJhYjYtZTlkYy00MGYwLWE4YTgtOWM3Mjg1NTk3YWRmIiwiaWF0IjoxNzczMDMzMTQ0LCJleHAiOjE3NzU2MjA4MDB9.h5p5lR4XcLirW47GNOAnMezQZBAv1j9ZlD-C_pdH3ls';

async function test() {
  const res = await fetch('http://localhost:5678/api/v1/workflows', {
    headers: { 'X-N8N-API-KEY': API_KEY }
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
