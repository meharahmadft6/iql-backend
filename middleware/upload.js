const fileUpload = require("express-fileupload");
const ErrorResponse = require("../utils/errorResponse");

exports.uploadFiles = fileUpload({
  useTempFiles: true,
  tempFileDir: "/tmp/",
  limits: { fileSize: process.env.MAX_FILE_UPLOAD },
  abortOnLimit: true,
  createParentPath: true,
  safeFileNames: true,
  preserveExtension: true,
});

// File upload error handler
exports.handleUploadErrors = (err, req, res, next) => {
  if (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(
        new ErrorResponse(
          `File size too large. Maximum is ${process.env.MAX_FILE_UPLOAD} bytes`,
          400
        )
      );
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(new ErrorResponse("Too many files uploaded", 400));
    }
    return next(new ErrorResponse("File upload error", 500));
  }
  next();
};
