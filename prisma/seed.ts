console.error(
  [
    'Blocked: destructive seed flow is disabled to protect registration/payment data.',
    'Use `npm run sync:events:user-data` for non-destructive event updates.',
  ].join('\n')
);
process.exit(1);
