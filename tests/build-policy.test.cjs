const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPolicy, assertTrustedSignatures } = require('../scripts/build-policy.cjs');

test('a normal release fails closed before packaging without an explicit signing identity', () => {
  assert.throws(() => buildPolicy([], {}), /Release blocked/);
  assert.throws(() => buildPolicy(['--ignore-signing'], {}), /Unknown build option/);
  assert.throws(() => buildPolicy([], { EVENING_STUDY_CERT_SHA1: 'invalid' }), /thumbprint/);
});

test('a signed build requires signing and keeps credential values out of its config', () => {
  const result = buildPolicy([], { CSC_LINK: 'secret-certificate-data', CSC_KEY_PASSWORD: 'secret-password' });
  assert.equal(result.config.forceCodeSigning, true);
  assert.equal(result.config.win.signExecutable, true);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  const thumbprint = 'a'.repeat(40);
  assert.equal(buildPolicy([], { EVENING_STUDY_CERT_SHA1: thumbprint }).config.win.signtoolOptions.certificateSha1, thumbprint);
});

test('explicit unsigned test output cannot overwrite the signed release path or filename', () => {
  const result = buildPolicy(['--unsigned'], {});
  assert.equal(result.config.forceCodeSigning, false);
  assert.equal(result.config.win.signExecutable, false);
  assert.equal(result.output, 'release/unsigned');
  assert.match(result.config.portable.artifactName, /-UNSIGNED\.exe$/);
  assert.equal(result.suffix, '-unsigned');
});

test('both executables must have valid timestamped signatures from the same signer', () => {
  const valid = { Path: 'app.exe', Status: 'Valid', Timestamped: true, SignerThumbprint: 'trusted-signer' };
  assert.doesNotThrow(() => assertTrustedSignatures([valid, { ...valid, Path: 'portable.exe' }]));
  assert.throws(() => assertTrustedSignatures([valid]), /Both/);
  for (const mismatch of [{ Status: 'NotSigned' }, { Status: 'UnknownError' }, { Timestamped: false }, { SignerThumbprint: null }, { SignerThumbprint: 'different' }]) {
    assert.throws(() => assertTrustedSignatures([valid, { ...valid, Path: 'portable.exe', ...mismatch }]), /Release blocked/);
  }
});
