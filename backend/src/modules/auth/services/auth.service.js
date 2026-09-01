import HttpError from '../../../common/exceptions/http-error.js';
import { signToken, verifyPassword } from '../../../common/utils/security.js';
import * as libraryService from '../../libraries/services/library.service.js';
import * as librarianService from '../../librarians/services/librarian.service.js';
import * as studentService from '../../students/services/student.service.js';

const login = async ({ email, password, libraryCode }) => {
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    return { token: signToken({ id: 'admin', role: 'ADMIN' }), role: 'ADMIN' };
  }

  let user = await librarianService.findByEmail(email);
  let role = 'LIBRARIAN';
  if (!user) { user = await studentService.findByEmail(email); role = 'STUDENT'; }
  if (!user || !verifyPassword(password, user.passwordHash)) throw new HttpError('Invalid email or password', 401);

  const library = await libraryService.findApprovedByCode(libraryCode);
  if (String(library._id) !== String(user.library)) throw new HttpError('Valid libraryCode is required', 401);
  if (user.status !== 'APPROVED') throw new HttpError('Your registration is awaiting approval', 403);

  return {
    token: signToken({ id: String(user._id), role, libraryId: String(user.library), libraryCode }),
    role,
    user: { id: user._id, name: user.name, email: user.email },
  };
};

const refresh = (user) => ({ token: signToken(user) });

export { login, refresh };
