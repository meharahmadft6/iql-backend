const AWS = require("aws-sdk");

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Updated upload function to handle buffer
exports.uploadFile = async (file, folder = "") => {
  if (!file || !file.buffer) {
    throw new Error("Invalid file object");
  }

  const fileExt = file.originalname.split(".").pop();
  const uniqueKey = `${folder}${Date.now()}_${Math.random()
    .toString(36)
    .substring(2)}.${fileExt}`;

  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Body: file.buffer,
    Key: uniqueKey,
    ContentType: file.mimetype,
    ACL: "private",
  };

  try {
    const data = await s3.upload(uploadParams).promise();
    return data.Key;
  } catch (err) {
    throw new Error(`S3 upload failed: ${err.message}`);
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
