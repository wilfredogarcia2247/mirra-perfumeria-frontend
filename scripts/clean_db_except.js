#!/usr/bin/env node
/**
 * scripts/clean_db_except.js
 *
 * Elimina (trunca) todas las tablas en el esquema `public` excepto las tablas listadas
 * en `KEEP_TABLES`. El script calcula un orden seguro de borrado basado en claves
 * foráneas (topological sort) y maneja componentes fuertemente conectadas (SCC).
 *
 * Requisitos:
 *  - Node.js
 *  - Instalar dependencia: `npm install pg`
 *
 * Uso:
 *  DATABASE_URL="postgresql://user:pass@host:port/db" node scripts/clean_db_except.js
 *
 * Opciones de entorno:
 *  - DATABASE_URL (recomendado)
 *  - KEEP (opcional): lista separada por comas de tablas a preservar (override)
 *
 * Antes de ejecutar realizará una confirmación interactiva listando las tablas a vaciar.
 */

const { Client } = require('pg');
const readline = require('readline');

const KEEP_DEFAULT = ['formas_pago', 'users', 'usuario', 'usuarios'];

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

function tarjan(nodes, edges) {
  // nodes: array of node names
  // edges: map node -> array of neighbor nodes
  let index = 0;
  const indices = Object.create(null);
  const lowlink = Object.create(null);
  const stack = [];
  const onStack = Object.create(null);
  const sccs = [];

  function strongconnect(v) {
    indices[v] = index;
    lowlink[v] = index;
    index += 1;
    stack.push(v);
    onStack[v] = true;
    const neighbors = edges[v] || [];
    for (const w of neighbors) {
      if (indices[w] === undefined) {
        strongconnect(w);
        lowlink[v] = Math.min(lowlink[v], lowlink[w]);
      } else if (onStack[w]) {
        lowlink[v] = Math.min(lowlink[v], indices[w]);
      }
    }
    if (lowlink[v] === indices[v]) {
      const scc = [];
      let w = null;
      do {
        w = stack.pop();
        onStack[w] = false;
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const v of nodes) if (indices[v] === undefined) strongconnect(v);
  return sccs;
}

function topoSort(nodes, edges) {
  // Kahn's algorithm on DAG; edges: node -> array of neighbors (node -> parent)
  // For deletion we want children before parents. We have edges child -> parent (A -> B if A references B).
  // So we must output nodes in order such that A appears before B.
  const inDegree = Object.create(null);
  for (const n of nodes) inDegree[n] = 0;
  for (const u of Object.keys(edges)) {
    for (const v of edges[u]) {
      if (inDegree[v] === undefined) inDegree[v] = 0;
      inDegree[v] += 1;
    }
  }
  const q = [];
  for (const n of nodes) if (inDegree[n] === 0) q.push(n);
  const out = [];
  while (q.length) {
    const n = q.shift();
    out.push(n);
    const neigh = edges[n] || [];
    for (const m of neigh) {
      inDegree[m] -= 1;
      if (inDegree[m] === 0) q.push(m);
    }
  }
  // If out.length < nodes.length, graph had cycles
  return out;
}

(async function main() {
  const db = process.env.DATABASE_URL;
  if (!db) {
    console.error('ERROR: setea DATABASE_URL con la conexión Postgres. Ej: export DATABASE_URL="postgresql://user:pass@host:port/db"');
    process.exit(1);
  }
  const keepEnv = process.env.KEEP;
  const KEEP_TABLES = keepEnv ? keepEnv.split(',').map(s => s.trim()).filter(Boolean) : KEEP_DEFAULT;

  const client = new Client({ connectionString: db });
  await client.connect();

  try {
    // 1) obtener tablas del schema public
    const { rows: tableRows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public';");
    const allTables = tableRows.map(r => r.tablename).filter(Boolean);

    // 2) obtener constraints FK
    const fkQuery = `
      SELECT
        src.relname AS table_from,
        dst.relname AS table_to,
        conname
      FROM pg_constraint c
      JOIN pg_class src ON src.oid = c.conrelid
      JOIN pg_class dst ON dst.oid = c.confrelid
      JOIN pg_namespace ns ON ns.oid = src.relnamespace
      WHERE c.contype = 'f' AND ns.nspname = 'public';
    `;
    const { rows: fkRows } = await client.query(fkQuery);

    const edges = {}; // from -> [to]
    for (const t of allTables) edges[t] = [];
    for (const r of fkRows) {
      edges[r.table_from] = edges[r.table_from] || [];
      edges[r.table_from].push(r.table_to);
    }

    // Compute SCCs to detect cycles
    const sccs = tarjan(allTables, edges);

    // Build list of tables to delete = allTables - KEEP_TABLES
    const keepSet = new Set(KEEP_TABLES.map(s => s.toLowerCase()));
    const toDelete = allTables.filter(t => !keepSet.has(t.toLowerCase()));

    if (toDelete.length === 0) {
      console.log('No hay tablas para borrar (todas están en KEEP).');
      process.exit(0);
    }

    // Check if any SCC contains a keep table -> cannot safely truncate without affecting keep
    for (const comp of sccs) {
      const hasKeep = comp.some(t => keepSet.has(t.toLowerCase()));
      if (hasKeep && comp.some(t => !keepSet.has(t.toLowerCase()))) {
        console.error('\nERROR: Se detectó un componente fuertemente conectado (ciclo) que incluye tablas a conservar y tablas a borrar.');
        console.error('Componente:', comp.join(', '));
        console.error('No puedo continuar automáticamente sin riesgo de borrar las tablas a conservar.');
        process.exit(2);
      }
    }

    // Build deletion order: topological sort on subgraph of toDelete
    const subNodes = toDelete;
    const subEdges = {};
    for (const n of subNodes) {
      subEdges[n] = (edges[n] || []).filter(v => subNodes.includes(v));
    }

    const order = topoSort(subNodes, subEdges);
    // topoSort returns nodes with zero indegree first (parents), but our edges are child->parent,
    // so nodes with zero indegree are children with no references to them. We want children before parents.
    // The returned order is suitable: delete in that order.

    if (order.length !== subNodes.length) {
      console.warn('Advertencia: el grafo contiene ciclos entre las tablas a borrar. Procederé con componentes SCC individualmente.');
      // fallback: process SCCs, delete components not containing keep tables
      const plan = [];
      for (const comp of sccs) {
        const compDel = comp.filter(t => subNodes.includes(t));
        if (compDel.length > 0) plan.push(compDel);
      }
      console.log('Plan de truncado (componentes):');
      plan.forEach((c, i) => console.log(`${i + 1}. ${c.join(', ')}`));
      const ans = (await ask('\n¿Continuar y ejecutar el truncado de estas tablas? (si/no) ')).trim().toLowerCase();
      if (ans !== 'si' && ans !== 's' && ans !== 'yes' && ans !== 'y') {
        console.log('Abortado por usuario.');
        process.exit(0);
      }
      await client.query('BEGIN');
      try {
        for (const comp of plan) {
          // if component size >1 or has self-loop -> use TRUNCATE ... CASCADE
          if (comp.length > 1) {
            const q = `TRUNCATE TABLE ${comp.map(t => 'public."' + t + '"').join(', ')} RESTART IDENTITY CASCADE;`;
            console.log('Executing:', q);
            await client.query(q);
          } else {
            const t = comp[0];
            const q = `TRUNCATE TABLE public."${t}" RESTART IDENTITY;`;
            console.log('Executing:', q);
            await client.query(q);
          }
        }
        await client.query('COMMIT');
        console.log('Truncado completado.');
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error durante truncado:', e);
        process.exit(3);
      }
      process.exit(0);
    }

    // Normal case: order is full list
    console.log('Tablas que se vaciarán (en este orden):');
    order.forEach((t, i) => console.log(`${i + 1}. ${t}`));
    console.log('\nTablas preservadas:', Array.from(keepSet).join(', '));
    const ans = (await ask('\n¿Continuar y ejecutar el truncado de estas tablas? (si/no) ')).trim().toLowerCase();
    if (ans !== 'si' && ans !== 's' && ans !== 'yes' && ans !== 'y') {
      console.log('Abortado por usuario.');
      process.exit(0);
    }

    await client.query('BEGIN');
    try {
      for (const t of order) {
        const q = `TRUNCATE TABLE public."${t}" RESTART IDENTITY;`;
        console.log('Executing:', q);
        await client.query(q);
      }
      await client.query('COMMIT');
      console.log('Truncado completado con éxito.');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error durante truncado:', e);
      process.exit(3);
    }

  } finally {
    await client.end();
  }
})();
