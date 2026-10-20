import multer from 'multer';

interface UploadRule {
  types: string[];
  maxBytes: number;
  /** Shown when the file is missing or of the wrong type. */
  typeMessage: string;
  sizeMessage: string;
}

/**
 * Accepts one file in form field `field` as req.file (kept in memory, checked and
 * re-written by the controller). Other multipart fields land in req.body.
 * Answers 400 with a readable message on bad uploads.
 */
export const singleFileUpload = (field: string, rule: UploadRule) => {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: rule.maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, rule.types.includes(file.mimetype)),
  });

  return (req, res, next) =>
    parser.single(field)(req, res, (err) => {
      if (!err) {
        if (!req.file) return res.status(400).json({ success: false, message: rule.typeMessage });
        return next();
      }
      const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' ? rule.sizeMessage : 'Invalid upload';
      res.status(400).json({ success: false, message });
    });
};
