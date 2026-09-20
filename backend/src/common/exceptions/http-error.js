class HttpError extends Error {
	constructor(message, status = 400, code = 'BAD_REQUEST', details) {
		super(message);
		this.name = 'HttpError';
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export default HttpError;
