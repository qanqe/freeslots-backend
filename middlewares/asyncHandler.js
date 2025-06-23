module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next))
    .catch((err) => {
      console.error('AsyncHandler error:', err);
      next(err);
    });
};
