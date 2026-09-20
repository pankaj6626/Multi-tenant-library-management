import crypto from 'crypto';

import redis from '../../../config/redis.js';
import { signToken, verifyToken } from '../../../common/utils/security.js';

const ACCESS_TOKEN_TTL = 30 * 60 * 1000;
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;
const refreshSessions = new Map();

const refreshKey = (tokenId) => `auth:refresh:${tokenId}`;

const createAccessToken = (payload) => signToken(payload, ACCESS_TOKEN_TTL, 'access');

const createRefreshToken = async (user) => {
	const tokenId = crypto.randomUUID();
	const token = signToken({ ...user, tokenId }, REFRESH_TOKEN_TTL, 'refresh');
	await redis.set(refreshKey(tokenId), user, REFRESH_TOKEN_TTL / 1000);
	refreshSessions.set(tokenId, { user, expiresAt: Date.now() + REFRESH_TOKEN_TTL });
	return token;
};

const getRefreshSession = async (token) => {
	const payload = verifyToken(token, 'refresh');
	if (redis.enabled) {
		const user = await redis.get(refreshKey(payload.tokenId));
		if (!user) throw new Error('Refresh session is invalid');
		return { payload, user };
	}

	const memorySession = refreshSessions.get(payload.tokenId);
	if (memorySession) {
		if (memorySession.expiresAt <= Date.now()) {
			refreshSessions.delete(payload.tokenId);
			throw new Error('Refresh session expired');
		}
		return { payload, user: memorySession.user };
	}

	throw new Error('Refresh session is invalid');
};

const revokeRefreshToken = async (token) => {
	const payload = verifyToken(token, 'refresh');
	refreshSessions.delete(payload.tokenId);
	await redis.del(refreshKey(payload.tokenId));
};

export {
	createAccessToken,
	createRefreshToken,
	getRefreshSession,
	revokeRefreshToken,
};
