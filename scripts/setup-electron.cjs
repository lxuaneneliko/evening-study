// Use Electron's checksum-verified distribution with a JavaScript ZIP extractor.
// This avoids requiring a native ZIP helper on Windows systems with App Control.
const fs = require('node:fs');
const path = require('node:path');
const { downloadArtifact } = require('@electron/get');
const extract = require('extract-zip');
(async () => {
  const packageDir = path.dirname(require.resolve('electron/package.json'));
  const version = require(path.join(packageDir, 'package.json')).version;
  const file = await downloadArtifact({ version, artifactName: 'electron', platform: process.platform, arch: process.arch, checksums: require(path.join(packageDir, 'checksums.json')) });
  await extract(file, { dir: path.join(packageDir, 'dist') });
  fs.writeFileSync(path.join(packageDir, 'path.txt'), process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron');
  console.log(`Electron ${version} distribution verified and extracted.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
