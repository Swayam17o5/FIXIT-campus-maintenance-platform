export const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
};

export const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;

  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  res.status(status).json({
    message: err.message || 'Internal server error'
  });
};
