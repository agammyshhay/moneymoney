const releaseRules = {
  preset: 'angular',
  releaseRules: [
    { type: 'feat', release: 'minor' },
    { type: 'fix', release: 'patch' },
    { type: 'chore', release: 'patch' },
    { type: 'docs', release: 'patch' },
    { type: 'refactor', release: 'patch' },
    { type: 'build', release: 'minor' },
    { type: 'perf', release: 'patch' },
    { breaking: true, release: 'major' },
  ],
};

export default {
  branches: ['master'],
  plugins: [['@semantic-release/commit-analyzer', releaseRules], '@semantic-release/github'],
};
