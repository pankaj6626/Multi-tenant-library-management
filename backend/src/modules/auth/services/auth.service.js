const HttpError = require('../../../common/exceptions/http-error');
const { signToken, verifyPassword } = require('../../../common/utils/security');
const libraryService = require('../../libraries/services/library.service');
const librarianService = require('../../librarians/services/librarian.service');
const studentService = require('../../students/services/student.service');

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

module.exports = { login, refresh };
