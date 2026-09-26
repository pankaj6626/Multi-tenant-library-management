import express from 'express';

import asyncHandler from '../../../common/utils/async-handler.js';
import * as authService from '../services/auth.service.js';

const router = express.Router();
const refreshCookie = 'library_refresh_token';
const secureCookie = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const sameSite = process.env.COOKIE_SAMESITE || (secureCookie ? 'none' : 'lax');
const cookieOptions = {
  httpOnly: true,
  secure: secureCookie,
  sameSite,
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const getRefreshToken = (req) => {
  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader.split(';').find((entry) => entry.trim().startsWith(`${refreshCookie}=`));
  return cookie ? decodeURIComponent(cookie.trim().slice(refreshCookie.length + 1)) : null;
};

const setRefreshCookie = (res, token) => res.cookie(refreshCookie, token, cookieOptions);
const clearRefreshCookie = (res) => res.clearCookie(refreshCookie, cookieOptions);

router.post('/login', asyncHandler(async (req, res) => {
  const session = await authService.login(req.body);
  setRefreshCookie(res, session.refreshToken);
  const { refreshToken, ...response } = session;
  res.json(response);
}));

router.post('/password-reset/request', asyncHandler(async (req, res) => {
  res.json(await authService.requestPasswordReset(req.body, req.ip));
}));

router.post('/password-reset/verify', asyncHandler(async (req, res) => {
  res.json(await authService.verifyPasswordReset(req.body));
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = getRefreshToken(req);
  if (!token) {
    res.status(204).end();
    return;
  }

  const session = await authService.refresh(token);
  setRefreshCookie(res, session.refreshToken);
  const { refreshToken, ...response } = session;
  res.json(response);
}));

router.post('/logout', asyncHandler(async (req, res) => {
  await authService.logout(getRefreshToken(req));
  clearRefreshCookie(res);
  res.status(204).end();
}));

export default router;
