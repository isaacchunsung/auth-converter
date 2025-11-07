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

// Merge MCP servers
app.post('/api/merge-mcp', (req, res) => {
  try {
    const { existingConfig, newServers, serverNameMap } = req.body;

    if (!existingConfig || !newServers) {
      return res.status(400).json({
        success: false,
        error: 'existingConfig와 newServers가 필요합니다'
      });
    }

    // Parse JSON strings if needed
    const existing = typeof existingConfig === 'string'
      ? JSON.parse(existingConfig)
      : existingConfig;
    const newSrvs = typeof newServers === 'string'
      ? JSON.parse(newServers)
      : newServers;

    // Determine if we're working with mcpServers wrapper or direct servers
    let existingServers = existing.mcpServers || existing;
    let serversToAdd = newSrvs.mcpServers || newSrvs;

    // Apply server name mapping if provided
    if (serverNameMap && Object.keys(serverNameMap).length > 0) {
      const renamedServers = {};
      Object.keys(serversToAdd).forEach(oldName => {
        const newName = serverNameMap[oldName] || oldName;
        renamedServers[newName] = serversToAdd[oldName];
      });
      serversToAdd = renamedServers;
    }

    // Merge servers (new servers will override existing ones with same name)
    const mergedServers = { ...existingServers, ...serversToAdd };

    // Prepare result with same structure as input
    let result;
    if (existing.mcpServers) {
      result = { mcpServers: mergedServers };
    } else {
      result = mergedServers;
    }

    res.json({
      success: true,
      data: result,
      addedServers: Object.keys(serversToAdd),
      totalServers: Object.keys(mergedServers).length
    });
  } catch (error) {
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
