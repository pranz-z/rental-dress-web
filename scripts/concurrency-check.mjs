import pg from 'pg'
const { Client } = pg

const url = 'postgresql://postgres:postgres@127.0.0.1:54329/postgres'
const clients = Array.from({ length: 3 }, () => new Client({ connectionString: url }))

for (const [index, client] of clients.entries()) {
  try {
    await client.connect()
    const res = await client.query('SELECT $1::int AS n, now() AS now', [index])
    console.log('client', index, 'ok', res.rows[0].n, res.rows[0].now)
  } catch (error) {
    console.log('client', index, 'FAILED', error.message)
  }
}
// hold all three and query in parallel
const results = await Promise.allSettled(clients.map((c, i) => c.query('SELECT count(*)::int AS c FROM pg_class WHERE $1 = $1', []).then(r => `c${i}:${r.rows[0].c}`)))
console.log(JSON.stringify(results.map(r => (r.status === 'fulfilled' ? r.value : r.reason?.message))))
for (const client of clients) await client.end().catch(() => {})
console.log('CONCURRENCY_TEST_DONE')
