const { allow } = require('../guards/auth.guard');
module.exports = (...roles) => allow(...roles);
