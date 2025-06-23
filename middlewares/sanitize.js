const sanitize = require('express-mongo-sanitize');

module.exports = sanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized key "${key}" in ${req.method} ${req.originalUrl}`);
  }
});
