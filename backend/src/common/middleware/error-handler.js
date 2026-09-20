const errorHandler = (error, req, res, _next) => {
    const requestId = req.id || 'unknown';
    let status = error.status || 500;
    let code = error.code || 'INTERNAL_SERVER_ERROR';
    let message = error.message || 'Internal server error';
    let details = error.details;

    if (error.name === 'ValidationError') {
        status = 400;
        code = 'VALIDATION_ERROR';
        message = 'Request validation failed';
        details = Object.fromEntries(
            Object.entries(error.errors).map(([field, value]) => [field, value.message]),
        );
    } else if (error.name === 'CastError') {
        status = 400;
        code = 'INVALID_PARAMETER';
        message = `Invalid ${error.path}`;
    } else if (error.code === 11000) {
        status = 409;
        code = 'DUPLICATE_RESOURCE';
        message = 'A resource with the provided value already exists';
        details = Object.keys(error.keyPattern || {});
    } else if (error.type === 'entity.parse.failed') {
        status = 400;
        code = 'INVALID_JSON';
        message = 'Request body contains invalid JSON';
    }

    if (status >= 500) {
        console.error(`[${requestId}] ${error.stack || error.message || error}`);
        message = 'Internal server error';
        details = undefined;
    } else {
        console.warn(`[${requestId}] ${code}: ${message}`);
    }

    res.status(status).json({
        success: false,
        message,
        code,
        ...(details ? { details } : {}),
        requestId,
    });
};

export default errorHandler;
