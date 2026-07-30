import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    // avoid trusting the client-supplied filename directly (path traversal /
    // collision risk) - keep the extension but generate a unique base name
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeExt = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, "");
    cb(null, `${uniqueSuffix}${safeExt}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB cap to prevent unbounded uploads
  },
});
