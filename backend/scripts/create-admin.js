#!/usr/bin/env node
'use strict';
/*
 * Create (or promote) an EduCycle administrator account.
 *
 *   npm run create-admin
 *
 * Credentials are read from ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (for example
 * in your local .env). Any value that is missing is asked for interactively; the
 * password is never echoed or written anywhere except as a bcrypt hash.
 *
 * Options:
 *   --promote          allow an existing student account with this email to become an admin
 *   --reset-password   reset the password of an existing admin with this email
 */
const readline = require('readline');
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User } = require('../src/models');
const { passwordProblem, EMAIL_RE } = require('../src/utils/validate');
const { logActivity } = require('../src/utils/activity');

const args = new Set(process.argv.slice(2));

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  const name = process.env.ADMIN_NAME || await ask('Admin full name: ');
  const email = (process.env.ADMIN_EMAIL || await ask('Admin email: ')).toLowerCase();
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await ask('Admin password (hidden): ', { hidden: true });
    const again = await ask('Repeat password: ', { hidden: true });
    if (password !== again) throw new Error('Passwords do not match.');
  }

  if (!name || name.length < 2) throw new Error('Admin name must be at least 2 characters.');
  if (!EMAIL_RE.test(email)) throw new Error('Admin email is not valid.');
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  if (password.length < 12) throw new Error('Use at least 12 characters for an administrator password.');

  await connectDB(env.mongoUri);
  await User.syncIndexes();
  let user = await User.findOne({ email }).select('+passwordHash');

  if (user && user.role === 'admin') {
    if (!args.has('--reset-password')) {
      console.log(`An admin account already exists for ${email}. Nothing changed. (Use --reset-password to set a new password.)`);
      return;
    }
    await user.setPassword(password);
    user.status = 'active';
    await user.save();
    console.log(`Password reset for admin ${email}.`);
    return;
  }
  if (user && !args.has('--promote')) {
    throw new Error(`A student account already uses ${email}. Re-run with --promote to make it an admin, or choose another email.`);
  }
  if (!user) user = new User({ name, email });
  user.name = name;
  user.role = 'admin';
  user.status = 'active';
  await user.setPassword(password);
  await user.save();
  await logActivity({ action: 'admin.created', targetType: 'user', targetId: user._id, summary: `Administrator account created for ${user.name} (setup script)` });
  console.log(`Administrator ready: ${email}. Sign in at /admin-login.html`);
}

main()
  .catch((err) => { console.error(`\n[create-admin] ${err.message}\n`); process.exitCode = 1; })
  .finally(() => disconnectDB().catch(() => {}));
