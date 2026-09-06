import HttpError from '../../../common/exceptions/http-error.js';
import { verifyPassword } from '../../../common/utils/security.js';

const createAdminAuthenticator = ({ email, password }) => ({
  authenticate(credentials) {
    if (credentials.email !== email || credentials.password !== password) return null;
    return { id: 'admin', role: 'ADMIN' };
  },
});

const createMemberAuthenticator = ({ role, findByEmail, findApprovedByCode }) => ({
  async authenticate({ email, password, libraryCode }) {
    const user = await findByEmail(email);
    if (!user) return null;
    if (!verifyPassword(password, user.passwordHash)) {
      throw new HttpError('Invalid email or password', 401);
    }

    const library = await findApprovedByCode(libraryCode);
    if (String(library._id) !== String(user.library)) {
      throw new HttpError('Valid libraryCode is required', 401);
    }

    if (user.status === 'REJECTED') {
      throw new HttpError('Your registration request has been rejected', 403);
    }
    if (user.status !== 'APPROVED') {
      throw new HttpError('Your registration is awaiting approval', 403);
    }

    return {
      id: String(user._id),
      role,
      libraryId: String(user.library),
      libraryCode,
      user: { id: user._id, name: user.name, email: user.email },
    };
  },
});

export { createAdminAuthenticator, createMemberAuthenticator };
