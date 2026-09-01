import { allow } from '../guards/auth.guard.js';
export default (...roles) => allow(...roles);
