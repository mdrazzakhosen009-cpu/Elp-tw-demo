require('dotenv').config();
const { initDb } = require('../src/db');
initDb().then(()=>{console.log('Database initialized.');process.exit(0);}).catch(err=>{console.error(err);process.exit(1);});
