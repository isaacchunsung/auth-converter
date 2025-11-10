const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

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

    // Merge servers ensuring new servers are added at the end
    // This maintains the order: existing servers first, then new servers
    const mergedServers = { ...existingServers, ...serversToAdd };

    console.log('Existing server count:', Object.keys(existingServers).length);
    console.log('New servers being added:', Object.keys(serversToAdd));
    console.log('Total merged servers:', Object.keys(mergedServers).length);

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

// Scan Claude Desktop Extensions
app.get('/api/scan-extensions', (req, res) => {
  try {
    const homeDir = os.homedir();
    const extensionsPath = path.join(homeDir, 'Library', 'Application Support', 'Claude', 'Claude Extensions');

    console.log('Scanning extensions from:', extensionsPath);

    // Check if extensions directory exists
    if (!fs.existsSync(extensionsPath)) {
      return res.json({
        success: true,
        extensions: [],
        message: 'Extensions 폴더가 존재하지 않습니다'
      });
    }

    // Read all directories in extensions folder
    const entries = fs.readdirSync(extensionsPath, { withFileTypes: true });
    const extensionDirs = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.'));

    const extensions = [];

    for (const dir of extensionDirs) {
      const extensionPath = path.join(extensionsPath, dir.name);
      const manifestPath = path.join(extensionPath, 'manifest.json');

      // Check if manifest.json exists
      if (fs.existsSync(manifestPath)) {
        try {
          const manifestContent = fs.readFileSync(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestContent);

          // Extract key information
          const extension = {
            id: dir.name,
            name: manifest.name || dir.name,
            displayName: manifest.display_name || manifest.name || dir.name,
            version: manifest.version || 'unknown',
            description: manifest.description || '',
            author: manifest.author || {},
            path: extensionPath,
            server: manifest.server || null,
            tools: manifest.tools || [],
            userConfig: manifest.user_config || {}
          };

          extensions.push(extension);
        } catch (error) {
          console.error(`Error parsing manifest for ${dir.name}:`, error.message);
        }
      }
    }

    res.json({
      success: true,
      extensions: extensions,
      count: extensions.length
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Convert Extension to MCP Server config
app.post('/api/extension-to-mcp', (req, res) => {
  try {
    const { extension, shareCredentials } = req.body;

    if (!extension || !extension.server) {
      return res.status(400).json({
        success: false,
        error: 'Extension 정보가 유효하지 않습니다'
      });
    }

    const mcpConfig = extension.server.mcp_config;
    if (!mcpConfig) {
      return res.status(400).json({
        success: false,
        error: 'Extension에 MCP 설정이 없습니다'
      });
    }

    // Replace ${__dirname} with actual extension path
    const command = mcpConfig.command;
    const args = (mcpConfig.args || []).map(arg => {
      if (typeof arg === 'string') {
        return arg.replace(/\$\{__dirname\}/g, extension.path);
      }
      return arg;
    });

    // Process environment variables
    const env = {};
    if (mcpConfig.env) {
      Object.keys(mcpConfig.env).forEach(key => {
        const value = mcpConfig.env[key];
        // Skip template variables for now (user needs to configure them)
        if (typeof value === 'string' && !value.includes('${user_config.')) {
          env[key] = value;
        }
      });
    }

    // Add shared credentials directory if requested
    if (shareCredentials) {
      const homeDir = os.homedir();
      const sharedCredentialsDir = path.join(homeDir, '.google-workspace-mcp', 'credentials');

      // Add credential sharing environment variable
      env['GOOGLE_MCP_CREDENTIALS_DIR'] = sharedCredentialsDir;

      console.log('Credentials sharing enabled:', sharedCredentialsDir);
    }

    const mcpServerConfig = {
      command: command,
      args: args
    };

    // Only add env if there are non-empty values
    if (Object.keys(env).length > 0) {
      mcpServerConfig.env = env;
    }

    res.json({
      success: true,
      mcpConfig: mcpServerConfig,
      requiresUserConfig: Object.keys(extension.userConfig || {}).length > 0,
      userConfigFields: extension.userConfig || {},
      credentialsShared: shareCredentials || false,
      credentialsDir: shareCredentials ? env['GOOGLE_MCP_CREDENTIALS_DIR'] : null
    });

  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Save client secret file API
app.post('/api/save-client-secret', (req, res) => {
  try {
    const { clientSecretData, accountId } = req.body;

    if (!clientSecretData || !accountId) {
      return res.status(400).json({
        success: false,
        error: 'clientSecretData와 accountId가 필요합니다'
      });
    }

    // Create directory for client secrets
    const homeDir = os.homedir();
    const baseDir = path.join(homeDir, 'Documents', 'GitHub', 'myproduct_v4', 'google_workspace_mcp');
    const secretDir = path.join(baseDir, `client_secret_${accountId}`);

    if (!fs.existsSync(secretDir)) {
      fs.mkdirSync(secretDir, { recursive: true });
    }

    // Save the client secret file
    const secretPath = path.join(secretDir, 'client_secret.json');
    fs.writeFileSync(secretPath, JSON.stringify(clientSecretData, null, 2));

    console.log('Client secret saved to:', secretPath);

    res.json({
      success: true,
      path: secretPath
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check authentication status for MCP servers
app.post('/api/check-auth-status', (req, res) => {
  try {
    const { mcpServers } = req.body;

    if (!mcpServers) {
      return res.status(400).json({
        success: false,
        error: 'mcpServers 정보가 필요합니다'
      });
    }

    const authStatus = {};
    const homeDir = os.homedir();

    // Keywords that indicate a server needs Google authentication
    const googleWorkspaceKeywords = ['workspace', 'google', 'gmail', 'drive', 'sheets', 'docs', 'calendar'];

    // Check each MCP server for authentication status
    Object.keys(mcpServers).forEach(serverName => {
      const server = mcpServers[serverName];

      // Check if this server needs Google authentication
      const needsGoogleAuth = googleWorkspaceKeywords.some(keyword =>
        serverName.toLowerCase().includes(keyword)
      );

      // Only include servers that need Google authentication
      if (!needsGoogleAuth) {
        return; // Skip this server
      }

      authStatus[serverName] = {
        authenticated: false,
        email: null,
        tokenPath: null,
        needsEmail: false
      };

      // Check if server has env variables for Google email
      if (server.env && server.env.user_google_email) {
        const email = server.env.user_google_email;
        authStatus[serverName].email = email;
        authStatus[serverName].needsEmail = false;

        // Check for token file in .mcp-workspace directory
        const tokenDir = path.join(homeDir, '.mcp-workspace');
        const tokenPath = path.join(tokenDir, `token-${email}.json`);

        if (fs.existsSync(tokenPath)) {
          try {
            const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            // Check if token has required fields
            if (tokenData.access_token || tokenData.refresh_token) {
              authStatus[serverName].authenticated = true;
              authStatus[serverName].tokenPath = tokenPath;
            }
          } catch (err) {
            console.error(`Error reading token for ${email}:`, err);
          }
        }
      } else {
        // Server needs Google auth but doesn't have email configured
        authStatus[serverName].needsEmail = true;
      }
    });

    res.json({
      success: true,
      authStatus
    });

  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start authentication for a specific account
app.post('/api/start-auth', (req, res) => {
  try {
    const { email, serverName } = req.body;

    if (!email || !serverName) {
      return res.status(400).json({
        success: false,
        error: 'email과 serverName이 필요합니다'
      });
    }

    const homeDir = os.homedir();
    const secretDir = path.join(homeDir, '.mcp-workspace');
    const secretPath = path.join(secretDir, 'client_secret.json');

    // Check if client secret exists
    if (!fs.existsSync(secretPath)) {
      return res.json({
        success: false,
        needsClientSecret: true,
        message: 'Google OAuth client secret이 필요합니다. 먼저 client_secret.json을 설정해주세요.'
      });
    }

    // Read client secret to generate auth URL
    const clientSecret = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
    const { client_id, redirect_uris } = clientSecret.installed || clientSecret.web;

    if (!client_id || !redirect_uris || redirect_uris.length === 0) {
      return res.json({
        success: false,
        error: 'client_secret.json 파일이 올바르지 않습니다.'
      });
    }

    // Generate OAuth URL
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/forms',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/presentations',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/gmail.readonly'
    ];

    const redirectUri = redirect_uris[0];
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(client_id)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes.join(' '))}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&login_hint=${encodeURIComponent(email)}`;

    res.json({
      success: true,
      message: `${email} 계정의 인증을 시작합니다`,
      authUrl: authUrl,
      email: email,
      redirectUri: redirectUri
    });

  } catch (error) {
    console.error('Error starting auth:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Exchange authorization code for tokens
app.post('/api/exchange-code', async (req, res) => {
  try {
    const { code, email, redirectUri } = req.body;

    if (!code || !email || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: 'code, email, redirectUri가 필요합니다'
      });
    }

    const homeDir = os.homedir();
    const secretDir = path.join(homeDir, '.mcp-workspace');
    const secretPath = path.join(secretDir, 'client_secret.json');

    if (!fs.existsSync(secretPath)) {
      return res.json({
        success: false,
        error: 'client_secret.json을 찾을 수 없습니다'
      });
    }

    const clientSecret = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
    const { client_id, client_secret: secret } = clientSecret.installed || clientSecret.web;

    // Exchange code for tokens
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      code: code,
      client_id: client_id,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const https = require('https');
    const tokenData = await new Promise((resolve, reject) => {
      const postData = params.toString();
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(tokenUrl, options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Token exchange failed: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    // Save token file
    const tokenPath = path.join(secretDir, `token-${email}.json`);
    fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));

    res.json({
      success: true,
      message: `${email} 계정의 인증이 완료되었습니다`,
      tokenPath: tokenPath
    });

  } catch (error) {
    console.error('Error exchanging code:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete authentication token for a specific account
app.post('/api/delete-auth', (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'email이 필요합니다'
      });
    }

    const homeDir = os.homedir();
    const tokenDir = path.join(homeDir, '.mcp-workspace');
    const tokenPath = path.join(tokenDir, `token-${email}.json`);

    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
      res.json({
        success: true,
        message: `${email} 계정의 인증 토큰이 삭제되었습니다`
      });
    } else {
      res.json({
        success: false,
        message: `${email} 계정의 인증 토큰을 찾을 수 없습니다`
      });
    }

  } catch (error) {
    console.error('Error deleting auth:', error);
    res.status(500).json({ success: false, error: error.message });
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
