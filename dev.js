// Lets you test the API locally with plain `node dev.js` — no Vercel CLI needed.
// (You can also use `vercel dev` instead, which more closely mirrors production.)
require('dotenv').config();
const app = require('./lib/app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Local dev API running at http://localhost:${PORT}/api`));
