import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

async function database() {
  const db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role;",
  );
  const first = await readFile(
    "supabase/migrations/0001_lead_requests.sql",
    "utf8",
  );
  // PGlite has gen_random_uuid built in, but does not ship the pgcrypto extension.
  await db.exec(first.replace("create extension if not exists pgcrypto;", ""));
  await db.exec(
    await readFile(
      "supabase/migrations/0004_discovery_analysis_results.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile("supabase/migrations/0005_email_outbox.sql", "utf8"),
  );
  return db;
}
const insert = `insert into public.lead_requests (request_id,case_id,case_revision,work_email,organisation,consent_version,consented_at,request_hash,snapshot)
 values (gen_random_uuid(),'TEST',1,'test@example.com','Example','test',now(),'test',$1) returning id`;

test("database queues once, handles completed reports, and cascades retention deletion", async () => {
  const db = await database();
  try {
    const {
      rows: [lead],
    } = await db.query(insert, [JSON.stringify({ kind: "discovery-release" })]);
    assert.equal((await db.query("select * from email_jobs")).rows.length, 1);
    for (let i = 0; i < 2; i++)
      await db.query(
        "update lead_requests set analysis_result=$1 where id=$2",
        [JSON.stringify({ report: { schemaVersion: 2 } }), lead.id],
      );
    assert.deepEqual(
      (await db.query("select kind from email_jobs order by kind")).rows.map(
        (r) => r.kind,
      ),
      ["lead", "report"],
    );
    const {
      rows: [first],
    } = await db.query("select * from claim_email_job()");
    const {
      rows: [second],
    } = await db.query("select * from claim_email_job()");
    assert.notEqual(first.id, second.id);
    assert.notEqual(first.lock_token, second.lock_token);
    assert.equal(
      (await db.query("select * from claim_email_job()")).rows.length,
      0,
    );
    await db.query("delete from lead_requests where id=$1", [lead.id]);
    assert.equal((await db.query("select * from email_jobs")).rows.length, 0);
  } finally {
    await db.close();
  }
});
test("contact queues only an internal email, unknown legacy kinds queue nothing", async () => {
  const db = await database();
  try {
    for (const kind of ["contact-enquiry", "legacy"])
      await db.query(insert, [JSON.stringify({ kind })]);
    const { rows } = await db.query("select kind from email_jobs");
    assert.deepEqual(rows, [{ kind: "lead" }]);
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from email_jobs"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from claim_email_job()"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("expired leases recover; old retry windows stop without resending", async () => {
  const db = await database();
  try {
    await db.query(insert, [JSON.stringify({ kind: "contact-enquiry" })]);
    const {
      rows: [first],
    } = await db.query("select * from claim_email_job()");
    await db.exec("update email_jobs set locked_at=now()-interval '6 minutes'");
    const {
      rows: [retry],
    } = await db.query("select * from claim_email_job()");
    assert.equal(retry.id, first.id);
    assert.notEqual(retry.lock_token, first.lock_token);
    assert.equal(retry.attempts, 2);
    await db.exec(
      "update email_jobs set first_attempt_at=now()-interval '24 hours',locked_at=now()-interval '6 minutes'",
    );
    assert.equal(
      (await db.query("select * from claim_email_job()")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select status from email_jobs")).rows[0].status,
      "failed",
    );
  } finally {
    await db.close();
  }
});
