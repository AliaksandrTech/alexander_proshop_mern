import path from 'path'
import express from 'express'
import multer from 'multer'
import { protect, admin } from '../middleware/authMiddleware.js'
const router = express.Router()

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/')
  },
  filename(req, file, cb) {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    )
  },
})

function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png/
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = filetypes.test(file.mimetype)

  if (extname && mimetype) {
    return cb(null, true)
  } else {
    cb(new Error('Images only!'))
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb)
  },
})

router.post('/', protect, admin, upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400)
    throw new Error('No file uploaded')
  }
  res.send(`/${req.file.path}`)
})

export default router
