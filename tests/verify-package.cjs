const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '..');
const archive = path.join(root, 'release/win-unpacked/resources/app.asar');
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const version = require('../package.json').version;
const portableConfig = JSON.parse(fs.readFileSync(path.join(root, 'test-results', `portable-${version}-report.json`), 'utf8'));
assert.equal(portableConfig.version, version);
assert.equal(portableConfig.perLaunchDirectory, true);
assert.equal(portableConfig.sharedUnpackDefine, false);
const files = ['package.json'];
for (const dir of ['electron', 'renderer', 'shared', 'assets']) {
  for (const entry of fs.readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) files.push(path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'));
  }
}
for (const file of files) {
  const packaged = asar.extractFile(archive, file);
  if (file === 'package.json') {
    const actual = JSON.parse(packaged), expected = require('../package.json');
    for (const key of ['name', 'version', 'main']) assert.equal(actual[key], expected[key]);
  }
  else assert.equal(hash(packaged), hash(fs.readFileSync(path.join(root, file))), `Packaged file mismatch: ${file}`);
}
const portable = path.join(root, 'release', `EveningStudy-${version}-Windows.exe`);
const report = { version, verifiedAt: new Date().toISOString(), verifiedFiles: files, archiveSha256: hash(fs.readFileSync(archive)), portableSha256: hash(fs.readFileSync(portable)), sourceFilesMatch: true, perLaunchDirectory: portableConfig.perLaunchDirectory, runtimeTest: 'not-performed-by-this-static-verifier' };
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(root, 'test-results', `packaged-${version}-report.json`), JSON.stringify(report, null, 2));
console.log(`PASS ${files.length} packaged files verified; version ${version}; portable SHA256 ${report.portableSha256}; executable NOT launched`);
