export default {
  extends: ['@commitlint/config-conventional'],
  // The very first commit of a repository is exempt from the Conventional Commits rule.
  ignores: [(message) => message.trim() === 'Initial push'],
}
