const AWS = require("aws-sdk");

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Updated upload function to handle multer-s3 file objects
exports.uploadFile = async (file, folder = "") => {
  if (!file || !file.key) {
    throw new Error("Invalid file object");
  }

  // If the file is already in the desired folder, return the key as-is
  if (file.key.startsWith(folder)) {
    return file.key;
  }

  // If you want to organize files in folders, copy to the new location
  const fileExt = file.originalname.split(".").pop();
  const newKey = `${folder}${Date.now()}_${Math.random()
    .toString(36)
    .substring(2)}.${fileExt}`;

  try {
    // Copy the file to the desired folder
    await s3
      .copyObject({
        Bucket: process.env.AWS_BUCKET_NAME,
        CopySource: `${process.env.AWS_BUCKET_NAME}/${file.key}`,
        Key: newKey,
        ACL: "private",
      })
      .promise();

    // Delete the original file
    await s3
      .deleteObject({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: file.key,
      })
      .promise();

    return newKey;
  } catch (err) {
    throw new Error(`S3 file organization failed: ${err.message}`);
  }
};

// Generate signed URL with custom expiry
exports.getSignedUrl = async (key, expires = 3600) => {
  if (!key) return null;

  try {
    return await s3.getSignedUrlPromise("getObject", {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Expires: expires,
    });
  } catch (err) {
    console.error(`Error generating URL for ${key}:`, err);
    return null;
  }
};

// Enhanced delete function
exports.deleteFile = async (key) => {
  if (!key) return;

  try {
    await s3
      .deleteObject({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      })
      .promise();
  } catch (err) {
    console.error(`Error deleting file ${key}:`, err);
    throw err;
  }
};
