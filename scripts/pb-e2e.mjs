/**
 * End-to-end verification of the Dagara PocketBase contract against the LIVE
 * instance (https://dagara.185-7-81-99.sslip.io), using the same SDK and the
 * same call shapes as src/lib/pocketbase.ts and src/lib/auth-context.tsx.
 * Run with: node scripts/pb-e2e.mjs   (ADMIN_PW env = superuser password)
 */
import PocketBase from 'pocketbase';

const URL = 'https://dagara.185-7-81-99.sslip.io';
const pass = (n) => console.log(`  [ok] ${n}`);
const fail = (n) => { console.log(`  [FAIL] ${n}`); process.exitCode = 1; };

const pb = new PocketBase(URL);
const email = `e2e-${Date.now()}@dagara.local`;
const password = 'E2eTest1234!';
const projectId = String(Date.now());
let userId = null;

const adminPb = new PocketBase(URL);
try {
  await adminPb.collection('_superusers').authWithPassword('admin@dagara.local', process.env.ADMIN_PW);
} catch {
  console.log('  [warn] admin auth failed — cleanup skipped');
}

// --- 1. sign up (auth-context signUp flow) -----------------------------------
try {
  await pb.collection('users').create({ email, password, passwordConfirm: password, emailVisibility: true });
  pass(`signup ${email}`);
} catch (e) {
  fail(`signup: ${e.status} ${e.message} ${JSON.stringify(e.data)}`);
  process.exit(1);
}

// --- 2. sign in (auth-context signIn flow) ------------------------------------
try {
  const auth = await pb.collection('users').authWithPassword(email, password);
  userId = auth.record.id;
  pass(`signin -> uid=${userId} token=${!!pb.authStore.token} valid=${pb.authStore.isValid}`);
} catch (e) {
  fail(`signin: ${e.status} ${e.message}`);
  process.exit(1);
}

// --- 3. create project (repository.saveProject insert path) -------------------
try {
  await pb.collection('projects').create({
    id: projectId, owner: userId, name: 'E2E projet', brief: '',
    last_modified: new Date().toISOString(), subject: 'Sujet', cycle: 'Cycle',
    context: 'Contexte', language: 'fr',
    literature_review: null, hypotheses: [], questions: [],
    objectives_json: { general: '', specific: [] }, tools_json: {},
    analyses_json: [], bibliography_json: null, resources_json: [],
  });
  pass(`create project id=${projectId} (13-digit custom id accepted)`);
} catch (e) {
  fail(`create project: ${e.status} ${e.message} ${JSON.stringify(e.data)}`);
}

// --- 4. read back (repository.loadProjects path) ------------------------------
try {
  const records = await pb.collection('projects').getFullList({ sort: '-last_modified' });
  const own = records.filter(r => r.owner === userId);
  if (own.length === 1 && own[0].id === projectId) pass(`loadProjects -> 1 own record, id preserved`);
  else fail(`loadProjects -> ${records.length} records, ${own.length} own`);
} catch (e) {
  fail(`loadProjects: ${e.status} ${e.message}`);
}

// --- 5. update (repository.saveProject update path) ---------------------------
try {
  await pb.collection('projects').update(projectId, { name: 'E2E projet (modifié)' });
  const rec = await pb.collection('projects').getOne(projectId);
  if (rec.name === 'E2E projet (modifié)') pass('update path works');
  else fail('update did not persist');
} catch (e) {
  fail(`update: ${e.status} ${e.message}`);
}

// --- 6. version snapshot (saveProjectVersion path) ----------------------------
try {
  const page = await pb.collection('project_versions').getList(1, 1, { filter: `project_id = "${projectId}"` });
  await pb.collection('project_versions').create({
    project_id: projectId, owner: userId,
    snapshot: { id: projectId, name: 'E2E projet (modifié)' }, version_number: page.totalItems + 1,
  });
  pass(`saveProjectVersion -> version_number=${page.totalItems + 1}`);
} catch (e) {
  fail(`saveProjectVersion: ${e.status} ${e.message} ${JSON.stringify(e.data)}`);
}

// --- 7. generation log (logGeneration path) -----------------------------------
try {
  await pb.collection('generations').create({
    owner: userId, project_id: projectId, phase: 'phase1', tool_type: 'test',
    model_used: 'step-5-preview', tokens_estimated: 10, status: 'success', error_message: '',
  });
  pass('logGeneration works');
} catch (e) {
  fail(`logGeneration: ${e.status} ${e.message} ${JSON.stringify(e.data)}`);
}

// --- 8. security: anonymous reads must return nothing --------------------------
const anon = new PocketBase(URL);
try {
  const items = await anon.collection('projects').getFullList();
  if (items.length === 0) pass('anon read of projects -> 0 records (owner rule enforced)');
  else fail(`anon read leaked ${items.length} records!`);
} catch (e) {
  pass(`anon read rejected (${e.status}) — acceptable`);
}
try {
  await anon.collection('projects').create({ id: 'anonprobe', name: 'x', owner: userId });
  fail('ANON WRITE ALLOWED — critical');
} catch (e) {
  pass(`anon write rejected (${e.status})`);
}

// --- 9. auth error messages (validates mapAuthError patterns) ------------------
try {
  await new PocketBase(URL).collection('users').authWithPassword(email, 'WrongPassword1');
  fail('wrong password accepted?!');
} catch (e) {
  console.log(`  [info] wrong-password message: status=${e.status} message="${e.message}"`);
}
try {
  await new PocketBase(URL).collection('users').create({ email, password: password, passwordConfirm: password });
  fail('duplicate email accepted?!');
} catch (e) {
  console.log(`  [info] duplicate-email error: status=${e.status} message="${e.message}" data=${JSON.stringify(e.data)}`);
}

// --- 10. cleanup (cascade-deletes projects/versions/generations) ---------------
if (process.env.ADMIN_PW) {
  try {
    await adminPb.collection('users').delete(userId);
    pass('cleanup: e2e user deleted (cascade)');
  } catch (e) {
    console.log(`  [warn] cleanup failed: ${e.message}`);
  }
}
console.log('E2E DONE');
