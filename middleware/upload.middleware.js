const multer = require("multer");
const ApiError = require("../utils/ApiError");
const { translate } = require("../utils/translation");

const multerStorage = multer.memoryStorage();

// ===== Filters =====

// Image filter (including PDF if needed)
const multerFilterForImage = (req, file, cb) => {
    if (
        file.mimetype.startsWith("image") ||
        file.mimetype === "application/pdf" ||
        file.mimetype === "application/octet-stream"
    ) cb(null, true);
    else
        cb(
            new ApiError(
                translate("Not an image, please upload only Image", req.headers.lang),
                400
            ),
            false
        );
};

// PDF filter
const multerFilterForPDF = (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.mimetype === "application/octet-stream")
        cb(null, true);
    else
        cb(
            new ApiError(
                translate("Not a PDF, please upload only PDFs", req.headers.lang),
                400
            ),
            false
        );
};

// Video filter
const multerFilterForVideo = (req, file, cb) => {
    if (file.mimetype.startsWith("video")) cb(null, true);
    else
        cb(
            new ApiError(
                translate("Not a video, please upload only Video", req.headers.lang),
                400
            ),
            false
        );
};

// Audio/voice filter
const multerFilterForAudio = (req, file, cb) => {
    if (file.mimetype.startsWith("audio")) cb(null, true);
    else
        cb(
            new ApiError(
                translate("Not a voice/audio, please upload only Audio", req.headers.lang),
                400
            ),
            false
        );
};

// Filter for both images and videos
const multerFilterForImageAndVideo = (req, file, cb) => {
    if (file.mimetype.startsWith("image") || file.mimetype.startsWith("video")) cb(null, true);
    else cb(new ApiError("Unsupported file type", 400), false);
};

// ===== Configurations =====

const imageConfiguration = multer({
    storage: multerStorage,
    fileFilter: multerFilterForImage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const PDFConfiguration = multer({
    storage: multerStorage,
    fileFilter: multerFilterForPDF,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const VideoConfiguration = multer({
    storage: multerStorage,
    fileFilter: multerFilterForVideo,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const AudioConfiguration = multer({
    storage: multerStorage,
    fileFilter: multerFilterForAudio,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// Combined image & video & audio configuration
const uploadMediaConfiguration = multer({
    storage: multerStorage,
    fileFilter: (req, file, cb) => {
        const isImage = file.mimetype.startsWith("image");
        const isVideo = file.mimetype.startsWith("video");
        const isAudio = file.mimetype.startsWith("audio");

        if (!isImage && !isVideo && !isAudio)
            return cb(new ApiError("Only images, videos or voice/audio allowed", 400), false);

        req.fileType = isImage ? "image" : isVideo ? "video" : "voice";
        cb(null, true);
    },
    limits: {
        fileSize: (req, file) => {
            if (file.mimetype.startsWith("image")) return 10 * 1024 * 1024;
            if (file.mimetype.startsWith("video")) return 50 * 1024 * 1024;
            if (file.mimetype.startsWith("audio")) return 20 * 1024 * 1024;
            return 10 * 1024 * 1024;
        }
    }
});

// ===== Upload handlers =====

// Single uploads
const uploadSingleImage = (fileKey) => imageConfiguration.single(fileKey);
const uploadSingleFile = (fileKey) => PDFConfiguration.single(fileKey);
const uploadSingleVideo = (fileKey) => VideoConfiguration.single(fileKey);
const uploadSingleAudio = (fileKey) => AudioConfiguration.single(fileKey);

// Multiple uploads
const uploadAnyImages = imageConfiguration.any([
    { name: "profilePicture", maxCount: 1 },
    { name: "stadiumImages", maxCount: 10 },
    { name: "beforeImages", maxCount: 5 },
    { name: "afterImages", maxCount: 5 }
]);

const uploadMultipleVideos = VideoConfiguration.any([{ name: "stadiumVideos", maxCount: 10 }]);
const uploadMultipleAudios = AudioConfiguration.any([{ name: "ticketVoices", maxCount: 10 }]);

const uploadMedia = uploadMediaConfiguration.any([
    { name: "stadiumImages", maxCount: 10 },
    { name: "stadiumVideos", maxCount: 10 },
    { name: "ticketImages", maxCount: 10 },
    { name: "ticketVideos", maxCount: 10 },
    { name: "ticketVoices", maxCount: 10 }
]);

module.exports = {
    uploadAnyImages,
    uploadSingleImage,
    uploadSingleFile,
    uploadSingleVideo,
    uploadSingleAudio,
    uploadMultipleVideos,
    uploadMultipleAudios,
    uploadMedia
};