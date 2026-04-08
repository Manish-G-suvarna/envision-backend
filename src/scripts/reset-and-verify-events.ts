import { spawnSync } from 'child_process';
import path from 'path';

type Step = {
  label: string;
  command: string;
};

const rootDir = path.resolve(__dirname, '../..');

const steps: Step[] = [
  { label: 'Sync events from canonical data', command: 'npm run sync:events:user-data' },
  { label: 'Sync event metadata', command: 'npx ts-node prisma/syncEventMetadata.ts' },
  { label: 'Verify event data', command: 'npx ts-node compare_events.ts' },
];

function runStep(step: Step) {
  console.log(`\n[events] ${step.label}...`);

  const result = spawnSync(step.command, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });

  if (result.error || result.status !== 0) {
    throw new Error(`${step.label} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

async function main() {
  console.log('[events] Starting non-destructive sync and verification flow.');

  for (const step of steps) {
    runStep(step);
  }

  console.log('\n[events] Completed successfully. Database is clean and verified.');
}

main().catch((error) => {
  console.error('[events] Flow failed:', error);
  process.exit(1);
});
