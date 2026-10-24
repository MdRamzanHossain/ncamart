import fs from 'fs';
import path from 'path';

const modules = [
  'identity', 'catalog', 'inventory', 'orders', 'preorder', 'payments',
  'ledger', 'logistics', 'sourcing', 'trust', 'rma', 'promotions',
  'pos', 'finance', 'notifications', 'search', 'analytics', 'audit',
  'media', 'engagement', 'settings'
];

const baseDir = path.resolve('src/modules');

for (const mod of modules) {
  const modDir = path.join(baseDir, mod);
  fs.mkdirSync(modDir, { recursive: true });

  // schema.ts
  fs.writeFileSync(
    path.join(modDir, 'schema.ts'),
    `// Schema definition for module: ${mod}\n// NOTE: Internal to this module. Other modules MUST NOT import directly.\nexport {};\n`
  );

  // repo.ts
  fs.writeFileSync(
    path.join(modDir, 'repo.ts'),
    `// Repository layer for module: ${mod}\n// NOTE: Internal to this module. Other modules MUST NOT import directly.\nexport const ${mod}Repo = {};\n`
  );

  // service.ts
  fs.writeFileSync(
    path.join(modDir, 'service.ts'),
    `// Public domain service for module: ${mod}\nexport const ${mod}Service = {\n  healthCheck: async () => ({ module: '${mod}', status: 'ok' }),\n};\n`
  );

  // events.ts
  fs.writeFileSync(
    path.join(modDir, 'events.ts'),
    `// Outbox event definitions for module: ${mod}\nexport type ${mod.charAt(0).toUpperCase() + mod.slice(1)}Event = {\n  id: string;\n  name: string;\n  timestamp: string;\n};\n`
  );

  // policies.ts
  fs.writeFileSync(
    path.join(modDir, 'policies.ts'),
    `// RBAC permission checks and policies for module: ${mod}\nexport const ${mod}Policies = {\n  canRead: () => true,\n  canWrite: () => true,\n};\n`
  );

  // dto.ts
  fs.writeFileSync(
    path.join(modDir, 'dto.ts'),
    `// Data Transfer Objects (DTO) and Zod schemas for module: ${mod}\nimport { z } from 'zod';\n\nexport const ${mod}StatusDto = z.object({\n  status: z.string(),\n});\n`
  );

  // index.ts (public module boundary: ONLY service, events, dto, policies)
  fs.writeFileSync(
    path.join(modDir, 'index.ts'),
    `// Public boundary for module: ${mod}\n// ONLY export service, events, policies, and DTOs. Never export schema or repo.\nexport * from './service';\nexport * from './events';\nexport * from './policies';\nexport * from './dto';\n`
  );
}

console.log('Scaffolded all 21 modules successfully.');
