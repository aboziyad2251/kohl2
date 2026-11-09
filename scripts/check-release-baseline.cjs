// Additive routes are allowed; removing any currently deployed route fails the build gate.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = path => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const baseline = read('docs/baselines/production-20261109-routes.json');
const built = read('.next/server/app-paths-manifest.json');
const missing = Object.keys(baseline).filter(route => !(route in built));
assert.deepEqual(missing, [], 'Build removes deployed routes: ' + missing.join(', '));
const { loadTS } = require('../tests/load-ts.cjs');
const { navGroups, navItems } = loadTS('lib/navigation.ts');
assert.equal(navGroups.length, 6, 'Preserve the six navigation categories');
for (const href of ['/today', '/calendar', '/audit', '/activity', '/settings', '/bills-forms']) {
  assert(navItems.some(item => item.href === href), 'Missing navigation item ' + href);
}
assert(fs.readFileSync('app/globals.css', 'utf8').includes('.broker-portal'), 'Broker design CSS missing');
console.log(`PASS release baseline: all ${Object.keys(baseline).length} deployed routes, six navigation categories and broker styles preserved`);
