import { signToken } from '../../../common/utils/security.js';

const createAccessToken = (payload) => signToken(payload);

const createRefreshToken = (user) => ({ token: signToken(user) });

export { createAccessToken, createRefreshToken };
