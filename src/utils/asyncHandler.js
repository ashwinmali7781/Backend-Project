const asyncHandler = (requestHandler) => {
  (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };




// export { asyncHandler };

// const asyncHandler = (fn) => (res, res, next) => {};

// try {
//   await fn(req, res, next);
// } catch (error) {
//   res.status(error.code || 5000).json({
//     success: false,
//     message: error.message,
//   });
// }
