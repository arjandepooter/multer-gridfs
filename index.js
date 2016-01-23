'use strict';

function getMetadata(req, file) {
	return {};
}

function GridfsStorage(opts) {
	this.gfs = opts.gfs;
	this.getMetadata = (opts.metadata || getMetadata);
}

GridfsStorage.prototype._handleFile = function _handleFile(req, file, cb) {
	const metadata = this.getMetadata(req, file);

	const writer = this.gfs.createWriteStream({
		filename: file.originalname,
		content_type: file.mimetype, // eslint-disable-line
		metadata: metadata
	});

	writer.on('close', file => cb(null, {
		obj: file
	}));

	writer.on('error', cb);

	file.stream.pipe(writer);
};

GridfsStorage.prototype._removeFile = function _removeFile(req, file, cb) {
	const fileId = file.obj._id;

	if(fileId) {
		return this.gfs.remove({_id: fileId}, cb);
	}
	cb();
};

module.exports = opts => new GridfsStorage(opts);
