import crypto from 'crypto';
import HttpError from '../../../common/exceptions/http-error.js';
import redis from '../../../config/redis.js';
import { hashPassword } from '../../../common/utils/security.js';
import { sendEmail } from './email.service.js';
import { createAdminAuthenticator, createMemberAuthenticator } from './authenticator.service.js';
import {
  createAccessToken,
  createRefreshToken,
  getRefreshSession,
  revokeRefreshToken,
} from './token.service.js';
import * as libraryService from '../../libraries/services/library.service.js';
import * as librarianService from '../../librarians/services/librarian.service.js';
import * as studentService from '../../students/services/student.service.js';
import * as studentHistoryRepository from '../../students/repositories/student-history.repository.js';

const adminAuthenticator = createAdminAuthenticator({
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});

const librarianAuthenticator = createMemberAuthenticator({
  role: 'LIBRARIAN',
  findByEmail: librarianService.findByEmail,
  findApprovedByCode: libraryService.findApprovedByCode,
});

const studentAuthenticator = createMemberAuthenticator({
  role: 'STUDENT',
  findByEmail: studentService.findByEmail,
  findApprovedByCode: libraryService.findApprovedByCode,
  findHistoryByStudent: studentHistoryRepository.findByStudent,
});

const resetCodeTtlSeconds = 10 * 60;
const resetCooldownSeconds = 60;
const maxResetAttempts = 5;
const resetKey = (prefix, email) => {
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  return `auth:password-reset:${prefix}:${emailHash}`;
};
const genericResetResponse = {
  message: 'If an account exists for that email, a verification code has been sent.',
};

const requestPasswordReset = async ({ email }, sourceIp = 'unknown') => {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail || normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new HttpError('Enter a valid email address', 400);
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new HttpError('Password reset is temporarily unavailable', 503, 'RESET_UNAVAILABLE');
  }
  if (!redis.enabled) {
    throw new HttpError('Password reset is temporarily unavailable', 503, 'RESET_UNAVAILABLE');
  }

  let cooldownCreated;
  try {
    const ipHash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(sourceIp).digest('hex');
    const emailRequestCount = await redis.incrementStrict(resetKey('daily-count', normalizedEmail), 24 * 60 * 60);
    const ipRequestCount = await redis.incrementStrict(`auth:password-reset:ip:${ipHash}`, 60 * 60);
    if (emailRequestCount > 5 || ipRequestCount > 20) return genericResetResponse;
    cooldownCreated = await redis.setStrict(
      resetKey('cooldown', normalizedEmail),
      '1',
      resetCooldownSeconds,
      true,
    );
  } catch {
    throw new HttpError('Password reset is temporarily unavailable', 503, 'RESET_UNAVAILABLE');
  }
  if (!cooldownCreated) return genericResetResponse;

  const librarian = await librarianService.findByEmail(normalizedEmail);
  const student = librarian ? null : await studentService.findByEmail(normalizedEmail);
  const user = librarian || student;
  if (!user) return genericResetResponse;

  const role = librarian ? 'LIBRARIAN' : 'STUDENT';
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const challenge = {
    userId: String(user._id),
    role,
    codeHash: crypto.createHmac('sha256', process.env.JWT_SECRET)
      .update(`${normalizedEmail}:${code}`)
      .digest('hex'),
    attempts: 0,
    expiresAt: Date.now() + resetCodeTtlSeconds * 1000,
  };
  const challengeKey = resetKey('code', normalizedEmail);

  try {
    await redis.setStrict(challengeKey, JSON.stringify(challenge), resetCodeTtlSeconds);
    await sendEmail({
      to: normalizedEmail,
      subject: 'Your LibraryHub password reset code',
      text: `Your password reset verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Your LibraryHub password reset verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
    });
  } catch (error) {
    await redis.delStrict(challengeKey, resetKey('cooldown', normalizedEmail)).catch(() => undefined);
    console.error('[Password reset] Could not deliver verification email:', error.message);
  }

  return genericResetResponse;
};

const verifyPasswordReset = async ({ email, code, password, confirmPassword }) => {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new HttpError('Enter the six-digit verification code', 400);
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError('Password must be at least 8 characters long', 400);
  }
  if (password !== confirmPassword) {
    throw new HttpError('Passwords do not match. Please enter the same password in both fields.', 400);
  }
  if (!redis.enabled) {
    throw new HttpError('Password reset is temporarily unavailable', 503, 'RESET_UNAVAILABLE');
  }

  const challengeKey = resetKey('code', normalizedEmail);
  let storedChallenge;
  try {
    storedChallenge = await redis.getStrict(challengeKey);
  } catch {
    throw new HttpError('Password reset is temporarily unavailable', 503, 'RESET_UNAVAILABLE');
  }
  if (!storedChallenge) throw new HttpError('The code is invalid or expired. Request a new one.', 400, 'INVALID_RESET_CODE');

  const challenge = typeof storedChallenge === 'string' ? JSON.parse(storedChallenge) : storedChallenge;
  if (challenge.attempts >= maxResetAttempts || challenge.expiresAt <= Date.now()) {
    await redis.delStrict(challengeKey);
    throw new HttpError('The code is invalid or expired. Request a new one.', 400, 'INVALID_RESET_CODE');
  }

  const submittedHash = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`${normalizedEmail}:${code}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(challenge.codeHash, 'hex');
  const submittedBuffer = Buffer.from(submittedHash, 'hex');
  if (expectedBuffer.length !== submittedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, submittedBuffer)) {
    challenge.attempts += 1;
    const remainingTtl = Math.max(1, Math.ceil((challenge.expiresAt - Date.now()) / 1000));
    await redis.setStrict(challengeKey, JSON.stringify(challenge), remainingTtl);
    throw new HttpError('The code is invalid or expired. Request a new one.', 400, 'INVALID_RESET_CODE');
  }

  const accountService = challenge.role === 'LIBRARIAN' ? librarianService : studentService;
  const user = await accountService.findByEmail(normalizedEmail);
  if (!user || String(user._id) !== challenge.userId) {
    await redis.delStrict(challengeKey);
    throw new HttpError('The code is invalid or expired. Request a new one.', 400, 'INVALID_RESET_CODE');
  }

  user.passwordHash = hashPassword(password);
  await user.save();
  await redis.delStrict(challengeKey, resetKey('cooldown', normalizedEmail));
  return { message: 'Password updated successfully. You can now login.' };
};

const login = async (credentials) => {
  const admin = adminAuthenticator.authenticate(credentials);
  if (admin) {
    return {
      accessToken: createAccessToken(admin),
      refreshToken: await createRefreshToken(admin),
      role: admin.role,
    };
  }

  const member = await librarianAuthenticator.authenticate(credentials)
    || await studentAuthenticator.authenticate(credentials);
  if (!member) {
    throw new HttpError('Invalid email or password', 401);
  }

  const { user, ...tokenPayload } = member;
  const seatAssigned = member.role === 'STUDENT'
    ? await studentService.hasSeatAssignment(member.id, member.libraryId)
    : true;

  return {
    accessToken: createAccessToken(tokenPayload),
    refreshToken: await createRefreshToken(tokenPayload),
    role: member.role,
    seatAssigned,
    user: member.user,
  };
};

const refresh = async (token) => {
  if (!token) throw new HttpError('Refresh token is required', 401);

  let session;
  try {
    session = await getRefreshSession(token);
  } catch {
    throw new HttpError('Invalid or expired refresh token', 401);
  }

  const { payload, user } = session;
  await revokeRefreshToken(token);
  return {
    accessToken: createAccessToken(user),
    refreshToken: await createRefreshToken(user),
    role: user.role,
    user: user.user,
    seatAssigned: payload.role !== 'STUDENT' || payload.seatAssigned === true,
  };
};

const logout = async (token) => {
  if (!token) return;
  try {
    await revokeRefreshToken(token);
  } catch {
    // Logout is idempotent when the cookie is already expired or revoked.
  }
};

export { login, requestPasswordReset, verifyPasswordReset, refresh, logout };
