const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Allow CORS so front-end can upload from file:// or other origins during development
app.use(cors());

// Serve the uploads directory statically
app.use('/uploads', express.static(UPLOAD_DIR));

// Multer storage config: keep original extension and add timestamp
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[\s:/\\]/g, '-');
    const unique = `${Date.now()}-${Math.round(Math.random()*1e9)}-${safeName}`;
    cb(null, unique);
  }
});

// Accept only PDF and set a file size limit (e.g., 10 MB)
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  }
});

// Simple upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const host = req.protocol + '://' + req.get('host');
  // Build a URL that points to the uploaded file
  const url = `${host}/uploads/${encodeURIComponent(req.file.filename)}`;
  return res.json({ url });
});

// Default route for verification
app.get('/', (req, res) => {
  res.send('EMMYSTORE file upload service is running. Use POST /upload to send a file.');
});

// Listen on port 3001 by default for local dev so port 3000 (common) is free
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`EMMYSTORE upload server listening on port ${PORT}`);
});
