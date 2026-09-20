import HttpError from '../../../common/exceptions/http-error.js';
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

export { login, refresh, logout };
