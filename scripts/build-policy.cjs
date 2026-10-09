const path = require('node:path');

function buildPolicy(args = [], env = process.env) {
  if (args.some(arg => arg !== '--unsigned')) throw new Error('Unknown build option. Use --unsigned only for an explicitly unsigned test package.');
  const unsigned = args.includes('--unsigned');
  const thumbprint = env.EVENING_STUDY_CERT_SHA1;
  if (!unsigned && thumbprint && !/^[a-f\d]{40}$/i.test(thumbprint)) throw new Error('EVENING_STUDY_CERT_SHA1 must be a 40-character certificate thumbprint.');
  if (!unsigned && !thumbprint && !env.WIN_CSC_LINK && !env.CSC_LINK) {
    throw new Error('Release blocked: configure a trusted code-signing certificate via EVENING_STUDY_CERT_SHA1 or CSC_LINK. No unsigned release was created. See SIGNING.md.');
  }
  return {
    unsigned,
    suffix: unsigned ? '-unsigned' : '',
    output: unsigned ? 'release/unsigned' : 'release',
    config: {
      forceCodeSigning: !unsigned,
      directories: { output: unsigned ? 'release/unsigned' : 'release' },
      win: {
        signExecutable: !unsigned,
        signtoolOptions: { signingHashAlgorithms: ['sha256'], ...(!unsigned && thumbprint ? { certificateSha1: thumbprint } : {}) }
      },
      portable: { artifactName: unsigned ? 'EveningStudy-${version}-Windows-UNSIGNED.exe' : 'EveningStudy-${version}-Windows.exe' }
    }
  };
}

function assertTrustedSignatures(signatures) {
  if (signatures.length < 2) throw new Error('Both the App executable and the portable launcher must be verified.');
  for (const signature of signatures) {
    if (signature.Status !== 'Valid' || !signature.SignerThumbprint || !signature.Timestamped) {
      throw new Error(`Release blocked: ${path.basename(signature.Path || 'artifact')} lacks a valid, timestamped Authenticode signature.`);
    }
  }
  if (new Set(signatures.map(item => item.SignerThumbprint)).size !== 1) throw new Error('Release blocked: App and launcher have different signing certificates.');
}

module.exports = { buildPolicy, assertTrustedSignatures };
