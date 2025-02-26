// errorUtils.ts

// Main type for error details
export interface ErrorDetails {
  message: string;
  stack?: string;
  code?: string;
  type?: string;
}

// Handle standard Error objects
function handleStandardError(error: Error): ErrorDetails {
  return {
    message: error.message,
    stack: error.stack,
    type: error.constructor.name,
  };
}

// Handle Drizzle database-specific errors
function handleDrizzleError(
  error: Error & Record<string, unknown>
): ErrorDetails {
  const details: ErrorDetails = handleStandardError(error);

  // Add code if present
  if ("code" in error) {
    details.code = String(error.code);
  }

  // Handle specific database error codes
  if (error.code === "23503" || error.code === "23505") {
    if (error.detail) {
      details.message = `Database constraint error: ${error.detail}`;
    }
  } else if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
    details.message = `Database connection error: ${error.message}`;
  }

  return details;
}

// Handle generic objects that are not Error instances
function handleObjectError(error: Record<string, unknown>): ErrorDetails {
  const details: ErrorDetails = {
    message: error.message ? String(error.message) : String(error),
    type: "Object",
  };

  if (error.stack) {
    details.stack = String(error.stack);
  }

  if (error.code) {
    details.code = String(error.code);
  }

  return details;
}

// Handle primitive values
function handlePrimitiveError(error: unknown): ErrorDetails {
  return {
    message: String(error),
    type: typeof error,
  };
}

/**
 * Extract useful details from any error type in a type-safe way
 * @param error Any error object or value
 * @returns Structured error details
 */
export function getErrorDetails(error: unknown): ErrorDetails {
  // Standard Error object
  if (error instanceof Error) {
    // Check if it looks like a database error
    const anyError = error as any;
    if (anyError.code || anyError.detail || anyError.constraint) {
      return handleDrizzleError(anyError);
    }
    return handleStandardError(error);
  }
  // Non-Error object
  else if (typeof error === "object" && error !== null) {
    return handleObjectError(error as Record<string, unknown>);
  }
  // Primitive value
  else {
    return handlePrimitiveError(error);
  }
}
