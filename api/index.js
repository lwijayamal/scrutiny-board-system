// This is the single entry point Vercel turns into a serverless function.
// Every request to /api/* gets routed here, and Express's own router
// (defined in lib/app.js) takes over from there.
//
// IMPORTANT: keep this the ONLY file directly inside /api. Vercel treats
// every file under /api as a potential separate function, so helper files
// (db, middleware, routes) live in /lib instead and get imported here.
module.exports = require('../lib/app');
