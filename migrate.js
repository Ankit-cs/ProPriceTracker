const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// 1. Ensure 'pg' is installed
try {
  require.resolve('pg');
} catch (e) {
  console.log("Installing 'pg' database driver...");
  execSync('npm install pg', { stdio: 'inherit' });
}

const { Client } = require('pg');

// Load .env
require('dotenv').config();

const projectRef = 'ufpkvotcfmyznquivxjz';
const prefixes = ['aws-0', 'aws-1'];
const regions = [
  'ap-south-1',     // Mumbai
  'ap-southeast-1', // Singapore
  'us-east-1',      // N. Virginia
  'us-east-2',      // Ohio
  'us-west-2',      // Oregon
  'eu-west-1',      // Ireland
  'eu-central-1',   // Frankfurt
  'ap-southeast-2', // Sydney
  'ap-northeast-1', // Tokyo
  'ca-central-1'    // Canada
];

async function main() {
  let dbPassword = process.env.DB_PASSWORD;

  if (!dbPassword) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    dbPassword = await new Promise((resolve) => {
      rl.question('Please enter your Supabase Database Password: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  if (!dbPassword) {
    console.error('Database password is required to run migrations.');
    process.exit(1);
  }

  let activeClient = null;
  let activeHost = '';

  console.log('Testing connection to Supabase database pooler across hosts and regions...');
  outerLoop: for (const prefix of prefixes) {
    for (const region of regions) {
      const host = `${prefix}-${region}.pooler.supabase.com`;
      console.log(`Trying ${host}...`);
      
      const client = new Client({
        host: host,
        port: 5432,
        user: `postgres.${projectRef}`,
        password: dbPassword,
        database: 'postgres',
        ssl: {
          rejectUnauthorized: false
        },
        connectionTimeoutMillis: 3000 // 3 seconds timeout
      });

      try {
        await client.connect();
        activeClient = client;
        activeHost = host;
        console.log(`\nSuccessfully connected to: ${host}!`);
        break outerLoop; // Exit all loops on success
      } catch (err) {
        await client.end().catch(() => {});
        // If the error is wrong password, we should stop and tell them
        if (err.message.includes('password authentication failed')) {
          console.error(`\nConnection failed: Invalid Password!`);
          process.exit(1);
        }
        // Otherwise, it's a routing/DNS issue, continue trying
      }
    }
  }

  if (!activeClient) {
    console.error('\nCould not connect to any database pooler. Please check if your database password is correct.');
    console.log('Or find your connection string in Supabase Dashboard -> Settings -> Database -> Connection string (Pooler) and let me know.');
    process.exit(1);
  }

  try {
    console.log('\nReading schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    console.log('Executing migration schema...');
    await activeClient.query(schemaSql);
    console.log('Migration completed successfully! Tables created.');

    // Save configuration to .env
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    let updated = false;
    if (!envContent.includes('DB_PASSWORD=')) {
      envContent += `\nDB_PASSWORD=${dbPassword}`;
      updated = true;
    }
    if (!envContent.includes('DATABASE_URL=')) {
      const encodedPassword = encodeURIComponent(dbPassword);
      envContent += `\nDATABASE_URL=postgres://postgres.${projectRef}:${encodedPassword}@${activeHost}:6543/postgres?sslmode=require`;
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(envPath, envContent + '\n', 'utf8');
      console.log('Updated .env with DB_PASSWORD and DATABASE_URL.');
    }

  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await activeClient.end();
  }
}

main();
