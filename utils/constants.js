exports.USER = "user";

exports.ROLES = [exports.USER];
exports.LANG = ["en", "ar"]

exports.LOGIN_TYPE_LIST = ["apple", "google", "email", "social"];
exports.LOGIN_TYPE_PLATFORM_LIST = ["apple", "google", "social"];
exports.GENDER_LIST_EN = ["male", "female"];
exports.GENDER_LIST_AR = ["ذكر", "أنثى", "أنثي", "انثي", "انثى"];

// Media types
exports.MEDIA_MESSAGE_TYPES = ["image", "video", "audio", "file"];
exports.LABEL = "Label";
exports.MESSAGE_TYPES = ["text", exports.LABEL, ...exports.MEDIA_MESSAGE_TYPES];