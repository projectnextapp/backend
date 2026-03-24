const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for member profile photos
const memberPhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "agms/members",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "fill" }],
  },
});

// Storage for association logos
const logoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "agms/logos",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "svg"],
    transformation: [{ width: 300, height: 300, crop: "fill" }],
  },
});

// Storage for candidate photos
const candidatePhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "agms/candidates",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "fill" }],
  },
});

// Storage for advert banners
const advertStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "agms/adverts",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 1200, height: 400, crop: "limit", quality: "auto" },
    ],
  },
});

const uploadMemberPhoto = multer({ storage: memberPhotoStorage });
const uploadLogo = multer({ storage: logoStorage });
const uploadCandidatePhoto = multer({ storage: candidatePhotoStorage });
const uploadAdvertImage = multer({
  storage: advertStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

module.exports = {
  cloudinary,
  uploadMemberPhoto,
  uploadLogo,
  uploadCandidatePhoto,
  uploadAdvertImage,
};
