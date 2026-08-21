import assert from "node:assert/strict";
import test from "node:test";

import { supabaseAdminConfig } from "../src/server/supabase-admin.ts";

test("current Supabase secret keys are sent only as API keys", () => {
  const config = supabaseAdminConfig({
    SUPABASE_URL: "https://project.supabase.co/",
    SUPABASE_SECRET_KEY: "sb_secret_current",
  });

  assert.equal(config?.url, "https://project.supabase.co");
  assert.equal(config?.headers.apikey, "sb_secret_current");
  assert.equal(config?.headers.Authorization, undefined);
});

test("legacy service-role JWTs remain supported during migration", () => {
  const config = supabaseAdminConfig({
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role-jwt",
  });

  assert.equal(config?.headers.apikey, "legacy-service-role-jwt");
  assert.equal(
    config?.headers.Authorization,
    "Bearer legacy-service-role-jwt",
  );
});

test("publishable Supabase keys cannot configure server access", () => {
  assert.equal(
    supabaseAdminConfig({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SECRET_KEY: "sb_publishable_public",
    }),
    null,
  );
});
