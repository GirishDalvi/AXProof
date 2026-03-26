import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: process.env.NODE_ENV });
  });

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Ensure uploads and temp directories exist
  const isProd = process.env.NODE_ENV === 'production';
  const uploadsDir = isProd ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');
  const tempDir = isProd ? '/tmp/temp' : path.join(process.cwd(), 'temp');

  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`CWD: ${process.cwd()}`);
  console.log(`Uploads Dir: ${uploadsDir}`);
  console.log(`Temp Dir: ${tempDir}`);

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const upload = multer({ 
    dest: tempDir,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
      fieldSize: 100 * 1024 * 1024 // 100MB
    }
  });

  app.post('/api/upload-zip', (req, res, next) => {
    console.log('Handling ZIP upload request...');
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('Multer error during ZIP upload:', err);
        return res.status(400).json({ error: 'File upload failed', details: err.message });
      }
      console.log('File uploaded to temp successfully:', req.file?.path);
      next();
    });
  }, (req, res) => {
    try {
      if (!req.file) {
        console.error('No file in request after multer');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileId = req.body.id || Date.now().toString();
      const extractPath = path.join(uploadsDir, fileId);

      console.log(`Extracting ZIP to: ${extractPath}`);

      if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath, { recursive: true });
      }

      const zip = new AdmZip(req.file.path);
      
      // Extract first, then find entry file
      zip.extractAllTo(extractPath, true);
      console.log('ZIP extracted successfully');

      const entries = zip.getEntries();
      
      const isHtmlFile = (name: string) => {
        const lower = name.toLowerCase();
        return lower.endsWith('.html') || lower.endsWith('.htm');
      };

      const isValidEntry = (e: AdmZip.IZipEntry) => {
        if (e.isDirectory) return false;
        if (e.entryName.includes('__MACOSX')) return false;
        const parts = e.entryName.split('/');
        if (parts.some(p => p.startsWith('.'))) return false;
        return isHtmlFile(e.entryName);
      };

      // Find index.html first, then any html file
      let entryFile = entries.find(e => isValidEntry(e) && path.basename(e.entryName).toLowerCase() === 'index.html');
      
      if (!entryFile) {
        entryFile = entries.find(e => isValidEntry(e));
      }

      // Clean up temp file
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) {
        console.error('Failed to clean up temp file:', e);
      }

      if (!entryFile) {
        console.error('No valid HTML file found in ZIP');
        return res.status(400).json({ error: 'No valid HTML file found in ZIP' });
      }

      // Ensure paths are normalized for URLs
      const normalizedEntry = entryFile.entryName.replace(/\\/g, '/');
      const url = `/uploads/${fileId}/${normalizedEntry}`;

      console.log(`ZIP processing complete. Entry URL: ${url}`);
      res.json({ url, id: fileId });
    } catch (error: any) {
      console.error('Error extracting ZIP:', error);
      // Clean up temp file on error
      if (req.file && req.file.path) {
        try {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (e) {
          console.error('Failed to clean up temp file after error:', e);
        }
      }
      res.status(500).json({ error: 'Failed to extract ZIP', details: error.message });
    }
  });

  // Catch-all for other API routes to avoid returning index.html for POST/PUT/DELETE
  app.all('/api/*', (req, res) => {
    console.log(`Unknown API route: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'API route not found' });
  });

  app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      // Ensure correct MIME types and CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.js' || ext === '.mjs') {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (ext === '.css') {
        res.setHeader('Content-Type', 'text/css');
      } else if (ext === '.json') {
        res.setHeader('Content-Type', 'application/json');
      } else if (ext === '.svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
      } else if (ext === '.png') {
        res.setHeader('Content-Type', 'image/png');
      } else if (ext === '.jpg' || ext === '.jpeg') {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (ext === '.gif') {
        res.setHeader('Content-Type', 'image/gif');
      } else if (ext === '.mp4') {
        res.setHeader('Content-Type', 'video/mp4');
      } else if (ext === '.webm') {
        res.setHeader('Content-Type', 'video/webm');
      } else if (ext === '.woff') {
        res.setHeader('Content-Type', 'font/woff');
      } else if (ext === '.woff2') {
        res.setHeader('Content-Type', 'font/woff2');
      } else if (ext === '.ttf') {
        res.setHeader('Content-Type', 'font/ttf');
      } else if (ext === '.otf') {
        res.setHeader('Content-Type', 'font/otf');
      }
    }
  }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  });
}

startServer();
