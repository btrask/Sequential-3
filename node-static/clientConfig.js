var config = {};
config.rootIndexURLFromHash = function(hash) {
	return "//data.sequentialweb.com/"+hash+".json";
};
config.exts = [
	".jpg", ".jpeg",
	".png",
	".gif",
	".zip", ".cbz",
	".rar", ".cbr",
	".7z",
	".gz",
	".bz2", ".bzip2", ".bz",
	".tar",
	".gtar"
];
config.mimes = [
	"image/jpeg", "image/jpg", "image/pjpeg",
	"image/png", "application/png", "application/x-png",
	"image/gif",
	"application/zip", "application/x-zip", "application/x-zip-compressed", "multipart/x-zip",
	"application/rar", "application/x-rar", "application/x-rar-compressed", "compressed/rar",
	"application/x-7z-compressed",
	"application/gzip", "application/x-gzip",
	"application/bzip2", "application/bzip", "application/x-bzip2", "application/x-bzip",
	"application/x-tar", "application/tar",
	"application/x-gtar", "application/gnutar"
];
