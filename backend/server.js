require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./database/db');
const api = require('./routes/api');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/v1', api);
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'Internal server error' });
});

connectDB().then(() => app.listen(process.env.PORT || 5000, () => console.log(`API running on port ${process.env.PORT || 5000}`)));
