require("dotenv").config();
const { initDb } = require("../src/db");
initDb().then(()=>{ console.log("Turso database initialized."); process.exit(0); }).catch(e=>{ console.error(e); process.exit(1); });
