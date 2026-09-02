/**
 * A typed application error carrying an HTTP status. Throw these from
 * controllers/services; the central error handler turns them into clean JSON
 * responses without leaking internals.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  static badRequest(message: string, code = 'bad_request') {
    return new ApiError(400, code, message);
  }
  static unauthorized(message = 'Not authenticated', code = 'unauthorized') {
    return new ApiError(401, code, message);
  }
  static forbidden(message = "You don't have permission to do that", code = 'forbidden') {
    return new ApiError(403, code, message);
  }
  static notFound(message = 'Not found', code = 'not_found') {
    return new ApiError(404, code, message);
  }
  static conflict(message: string, code = 'conflict') {
    return new ApiError(409, code, message);
  }
  static tooManyRequests(message = 'Rate limit exceeded', code = 'too_many_requests') {
    return new ApiError(429, code, message);
  }
  static gone(message = 'Resource is no longer available', code = 'gone') {
    return new ApiError(410, code, message);
  }
}
