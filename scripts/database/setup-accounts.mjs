import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes, randomUUID, generateKeyPairSync } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../../backend/dist/database/models.js';
import { migrateAuth } from '../../backend/dist/database/authMigration.js';
import {
  hashPassword,
  activeBranches,
} from '../../backend/dist/modules/auth/core.js';

const file = new URL('../../backend/.env', import.meta.url);
let source = readFileSync(file, 'utf8');
const values = { ...dotenv.parse(source), ...process.env };
if (
  values.NODE_ENV !== 'development' ||
  !/^mongodb:\/\/127\.0\.0\.1:27018\//.test(values.MONGODB_URI || '')
)
  throw new Error(
    'Initial accounts are restricted to the configured isolated local development database.',
  );
if (!values.JWT_SECRET) {
  source += `\nJWT_SECRET=${randomBytes(48).toString('base64url')}\n`;
}
source = source
  .replace(/^DEV_IDENTITY_ENABLED=.*$/m, 'DEV_IDENTITY_ENABLED=false')
  .replace(/^FRONTEND_URL=.*$/m, 'FRONTEND_URL=http://127.0.0.1:5173');
if (!values.AUTH_PRIVATE_KEY) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  source += `\nAUTH_PRIVATE_KEY=${privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')}\n`;
  const frontendFile = new URL('../../frontend/.env', import.meta.url);
  let frontendSource = readFileSync(frontendFile, 'utf8');
  const publicValue = publicKey
    .export({ format: 'der', type: 'spki' })
    .toString('base64');
  frontendSource = frontendSource.replace(/^VITE_AUTH_PUBLIC_KEY=.*$/m, '');
  writeFileSync(
    frontendFile,
    frontendSource + `\nVITE_AUTH_PUBLIC_KEY=${publicValue}\n`,
  );
}
writeFileSync(file, source);
const directory = new URL('../../Acount/', import.meta.url);
mkdirSync(directory, { recursive: true });
const saved = new URL('accounts.json', directory);
const accounts = existsSync(saved)
  ? JSON.parse(readFileSync(saved, 'utf8'))
  : [];
const definitions = [
  {
    name: 'Company Admin',
    email: 'admin@myt.local',
    role: 'admin',
    branchId: null,
  },
  ...activeBranches.flatMap((branchId) =>
    ['manager', 'employee'].map((role) => ({
      name: `${branchId.replaceAll('-', ' ')} ${role}`,
      email: `${branchId}.${role}@myt.local`,
      role,
      branchId,
    })),
  ),
];
try {
  await mongoose.connect(values.MONGODB_URI, { autoIndex: false });
  await migrateAuth();
  for (const definition of definitions) {
    if (await User.exists({ normalizedEmail: definition.email })) continue;
    const password = `Aa1!${randomBytes(20).toString('base64url')}`;
    await User.create({
      _id: randomUUID(),
      name: definition.name,
      normalizedEmail: definition.email,
      passwordHash: await hashPassword(password),
      role: definition.role,
      branchIds: definition.branchId ? [definition.branchId] : activeBranches,
      assignedBranchId: definition.branchId,
      allow: [],
      deny: [],
      disabled: false,
      accountStatus: 'active',
      language: 'fa-AF',
      createdBy: 'owner:initial-setup',
      updatedBy: 'owner:initial-setup',
    });
    accounts.push({
      ...definition,
      password,
      url: 'http://127.0.0.1:5173',
      createdAt: new Date().toISOString(),
    });
    // Save immediately: a failed later account never discards already issued credentials.
    writeFileSync(saved, JSON.stringify(accounts, null, 2));
  }
  writeFileSync(
    new URL('LOGIN_DETAILS.txt', directory),
    'PRIVATE OWNER COPY - INITIAL LOCAL ACCOUNTS\r\nURL: http://127.0.0.1:5173\r\nUse the exact employee name, email, role and branch below. Admin has no branch selection.\r\nSolve the fresh on-screen CAPTCHA. Never share this folder publicly.\r\nPasswords are stored only as Argon2id hashes in MongoDB. This owner-requested file is the sole initial plaintext handoff; password changes do not update it.\r\n\r\n' +
      accounts
        .map(
          (account) =>
            `Name: ${account.name}\r\nRole: ${account.role}\r\nBranch: ${account.branchId || 'GLOBAL (all three active branches)'}\r\nEmail: ${account.email}\r\nPassword: ${account.password}\r\n`,
        )
        .join('\r\n'),
  );
  console.log(
    'Authentication migration and initial local accounts completed. Credentials saved privately under Acount; existing accounts were not reset.',
  );
} catch {
  console.error(
    'Account setup failed. Inspect database availability/uniqueness and rerun; existing accounts and saved handoff are preserved.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
