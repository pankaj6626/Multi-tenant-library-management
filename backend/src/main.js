require('dotenv').config();

const cors = require('cors');
const express = require('express');

const connectDatabase = require('./config/database');
const errorHandler = require('./common/middleware/error-handler');
const authController = require('./modules/auth/controllers/auth.controller');
const libraryController = require('./modules/libraries/controllers/library.controller');
const adminLibraryController = require('./modules/libraries/controllers/admin-library.controller');
const librarianController = require('./modules/librarians/controllers/librarian.controller');
const adminLibrarianController = require('./modules/librarians/controllers/admin-librarian.controller');
const studentController = require('./modules/students/controllers/student.controller');
const libraryStudentController = require('./modules/students/controllers/library-student.controller');
const seatController = require('./modules/seats/controllers/seat.controller');
const feeController = require('./modules/fees/controllers/fee.controller');
const concernController = require('./modules/concerns/controllers/concern.controller');
const communityController = require('./modules/community/controllers/community.controller');

require('./events/consumers/audit.consumer');

const app = express();
const apiPrefix = '/api/v1';

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(`${apiPrefix}/auth`, authController);
app.use(`${apiPrefix}/libraries`, libraryController);
app.use(`${apiPrefix}/admin/libraries`, adminLibraryController);
app.use(`${apiPrefix}/librarians`, librarianController);
app.use(`${apiPrefix}/admin/librarians`, adminLibrarianController);
app.use(`${apiPrefix}/students`, studentController);
app.use(`${apiPrefix}/libraries/students`, libraryStudentController);
app.use(`${apiPrefix}/seats`, seatController);
app.use(apiPrefix, feeController);
app.use(`${apiPrefix}/concerns`, concernController);
app.use(`${apiPrefix}/communication`, communityController);

app.use(errorHandler);

connectDatabase().then(() => {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`API running on port ${port}`));
});
