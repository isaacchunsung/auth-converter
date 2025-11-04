const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Parse JSON from text input
app.post('/api/parse', (req, res) => {
  try {
    const jsonData = typeof req.body.json === 'string'
      ? JSON.parse(req.body.json)
      : req.body.json;
    res.json({ success: true, data: jsonData });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Upload and parse JSON file
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const jsonData = JSON.parse(fileContent);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, data: jsonData });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  const isElectron = process.env.ELECTRON_MODE === 'true';

  if (isElectron) {
    console.log(`JSON Viewer server is running at http://localhost:${PORT}`);
  } else {
    console.log(`JSON Viewer is running at http://localhost:${PORT}`);
    console.log(`Open your browser and navigate to http://localhost:${PORT}`);
  }
});
