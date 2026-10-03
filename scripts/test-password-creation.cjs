// Exercise the real route and validation with Auth/RPC boundaries replaced by fakes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
function load(path, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => dependencies[name] || require(name),
    process, crypto: { randomUUID }, console });
  return exports;
}
const validation = load('lib/portal/validation.ts', {});
let calls, denied, failSave;
class PortalError extends Error { constructor(status, message) { super(message); this.status = status; } }
const server = {
  PortalError, json: data => ({ status: 200, data }), apiError: e => ({ status: e.status || 500 }),
  requireIdentity: async (_req, executive) => {
    assert.equal(executive, true);
    if (denied) throw new PortalError(403, 'Denied');
    return { user: { id: randomUUID() } };
  },
  invitationRedirect: () => 'https://example.invalid/auth/set-password',
  adminClient: () => ({ auth: { admin: {
    createUser: async input => { calls.push(['CREATE', input]); return { data: { user: { id: randomUUID() } } }; },
    deleteUser: async id => { calls.push(['DELETE', id]); return { error: null }; },
    inviteUserByEmail: async () => { throw Error('Password creation must not send invitations'); },
    generateLink: async () => { throw Error('Password creation must not generate invitations'); },
  } } }),
  administrative: async (_actor, operation, payload) => {
    calls.push([operation, payload]);
    if (operation === 'LIST') return { users: [] };
    if (operation === 'SAVE' && failSave) throw new PortalError(400, 'Invalid link');
    assert.ok(!payload || !('password' in payload), 'Password must never enter RPC/audit payloads');
    return {};
  },
};
const route = load('app/api/access/users/route.ts', {
  '@/lib/portal/server': server, '@/lib/portal/validation': validation,
});
const password = 'Fake-test-password-2026!';
const base = { email: 'fake@test.invalid', full_name: 'Fake account', mobile: '0500000000', password };
const payloads = [
  { ...base, role: 'OWNER', owners: [{ property_id: randomUUID(), ownership_share: 10 }] },
  { ...base, role: 'TENANT', leases: [randomUUID()] },
  { ...base, role: 'BROKER', agreement: { agreement_number: 'TEST', commission_type: 'FIXED', commission_value: 100, percentage_basis: null } },
];
const request = payload => ({ json: async () => payload });
(async () => {
  for (const google of ['false', 'true']) {
    process.env.GOOGLE_LOGIN_ENABLED = google;
    for (const payload of payloads) {
      calls = []; denied = false; failSave = false;
      const response = await route.POST(request(payload));
      assert.equal(response.status, 200);
      assert.equal(response.data.invitation_sent, false);
      assert.equal(calls[0][0], 'CREATE');
      assert.equal(calls[0][1].password, password);
      assert.equal(calls[0][1].email_confirm, true);
      assert.deepEqual(calls.map(x => x[0]), ['CREATE', 'LIST', 'SAVE', 'STATUS']);
      assert.ok(!JSON.stringify(response).includes(password));
    }
  }
  for (const payload of [{ ...payloads[0], password: 'short' },
    { ...payloads[0], user_id: randomUUID() }, { ...payloads[0], role: 'ADMIN' }]) {
    calls = [];
    assert.equal((await route.POST(request(payload))).status, 400);
    assert.equal(calls.length, 0);
  }
  calls = []; denied = true;
  assert.equal((await route.POST(request(payloads[0]))).status, 403);
  assert.equal(calls.length, 0);
  calls = []; denied = false; failSave = true;
  assert.equal((await route.POST(request(payloads[0]))).status, 400);
  assert.equal(calls.at(-1)[0], 'DELETE');
  console.log('Password creation checks passed: all three roles, Google modes, validation, authorization boundary, password privacy and failed-link cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
