// Shim for Node.js crypto module in React Native.
// bcryptjs conditionally uses crypto but falls back to Math.random when unavailable.
// We export an empty object so the require('crypto') call doesn't crash Metro.
module.exports = {};
