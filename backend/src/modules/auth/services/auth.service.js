import HttpError from '../../../common/exceptions/http-error.js';
import { createAdminAuthenticator, createMemberAuthenticator } from './authenticator.service.js';
import { createAccessToken, createRefreshToken } from './token.service.js';
import * as libraryService from '../../libraries/services/library.service.js';
import * as librarianService from '../../librarians/services/librarian.service.js';
import * as studentService from '../../students/services/student.service.js';

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
});

const login = async (credentials) => {
  const admin = adminAuthenticator.authenticate(credentials);
  if (admin) return { token: createAccessToken(admin), role: admin.role };

  const member = await librarianAuthenticator.authenticate(credentials)
    || await studentAuthenticator.authenticate(credentials);
  if (!member) {
    throw new HttpError('Invalid email or password', 401);
  }

  const { user, ...tokenPayload } = member;

  return {
    token: createAccessToken(tokenPayload),
    role: member.role,
    user: member.user,
  };
};

const refresh = (user) => createRefreshToken(user);

export { login, refresh };
