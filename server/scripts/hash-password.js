import bcrypt   from 'bcrypt';
import readline from 'node:readline';

const SALT_ROUNDS = 12;

const rl = readline.createInterface({
  input : process.stdin,
  output: process.stdout,
});

const askPassword = (prompt) =>
  new Promise((resolve) => {
    process.stdout.write(prompt);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      let password = '';

      const onData = (ch) => {
        ch = ch.toString();
        if (ch === '\n' || ch === '\r' || ch === '\u0003') {
          if (ch === '\u0003') { process.exit(); }
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
        } else if (ch === '\u007f' || ch === '\b') {
          password = password.slice(0, -1);
        } else {
          password += ch;
        }
      };

      process.stdin.resume();
      process.stdin.on('data', onData);
    } else {
      rl.question('', (answer) => resolve(answer));
    }
  });

(async () => {
  try {
    const password = await askPassword('Enter new admin password: ');

    if (!password || password.length < 8) {
      console.error('\n❌  Password must be at least 8 characters.');
      process.exit(1);
    }

    const confirm = await askPassword('Confirm password:        ');

    if (password !== confirm) {
      console.error('\n❌  Passwords do not match.');
      process.exit(1);
    }

    console.log('\n⏳  Hashing…');
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    console.log('\n✅  Done!  Add the following line to your server .env:\n');
    console.log(`ADMIN_PASS=${hash}`);
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
})();