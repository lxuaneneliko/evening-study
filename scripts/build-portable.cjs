const { build, Platform, Arch } = require('electron-builder');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');

(async () => {
  let checked = false;
  const artifacts = await build({
    projectDir: root,
    targets: Platform.WINDOWS.createTarget('portable', Arch.x64),
    publish: 'never',
    async effectiveOptionComputed([defines]) {
      // In the pinned builder 26.15.3, true suppresses UNPACK_DIR_NAME.
      // Its documentation says false, but the actual implementation treats
      // false as a request for one shared directory generated at build time.
      assert.equal(Object.hasOwn(defines, 'UNPACK_DIR_NAME'), false,
        'Portable launches must use separate $PLUGINSDIR/app directories; a second launch must not delete the running app');
      checked = true;
      return false; // Continue the real NSIS build after checking its defines.
    }
  });
  assert.equal(checked, true, 'NSIS configuration was not verified');
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(root, 'test-results', `portable-${version}-report.json`), JSON.stringify({ version, verifiedAt: new Date().toISOString(), perLaunchDirectory: true, sharedUnpackDefine: false, artifacts: artifacts.map(file => path.basename(file)) }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
