/**
 * Drops and recreates the public schema, then exits.
 * Used by `npm run db:reseed` to rebuild the studio database from the migrations
 * and the seed script.
 */
import pg from 'pg'
import { loadEnv } from './load-env.mjs'

loadEnv()

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
await client.query('DROP SCHEMA IF EXISTS public CASCADE')
await client.query('CREATE SCHEMA public')
// PGlite multiplexes every client onto one shared session, so prepared
// statements from a previously connected app can linger and collide with the
// migration engine ("prepared statement \"s0\" already exists"). Clear them.
await client.query('DEALLOCATE ALL')
await client.end()
console.log('  Public schema dropped and recreated.')
