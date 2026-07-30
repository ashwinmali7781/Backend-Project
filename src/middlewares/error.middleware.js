import { ApiError } from "../utils/ApiError.js";

// Centralized error handler. Every route funnels thrown errors here via
// asyncHandler's next(err) call (or Express's own error propagation).
// Without this, errors thrown as ApiError never got formatted as the
// project's standard JSON response shape.
const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Something went wrong";
    error = new ApiError(statusCode, message, error?.errors || [], err.stack);
  }

  const response = {
    success: false,
    message: error.message,
    errors: error.errors,
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  return res.status(error.statusCode).json(response);
};

export { errorHandler };
