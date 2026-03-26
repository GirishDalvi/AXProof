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
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Ensure uploads and temp directories exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const tempDir = path.join(process.cwd(), 'temp');
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

  app.post('/api/upload-zip', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: 'File upload failed', details: err.message });
      }
      next();
    });
  }, (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileId = req.body.id || Date.now().toString();
      const extractPath = path.join(uploadsDir, fileId);

      if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath, { recursive: true });
      }

      const zip = new AdmZip(req.file.path);
      
      // Extract first, then find entry file
      zip.extractAllTo(extractPath, true);

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
        return res.status(400).json({ error: 'No valid HTML file found in ZIP' });
      }

      // Ensure paths are normalized for URLs
      const normalizedEntry = entryFile.entryName.replace(/\\/g, '/');
      const url = `/uploads/${fileId}/${normalizedEntry}`;

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
}

startServer();
