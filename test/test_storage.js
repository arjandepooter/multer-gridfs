'use strict';

const express = require('express');
const Grid = require('gridfs-stream');
const GridfsStorage = require('..');
const md5 = require('md5-file');
const mongo = require('mongodb');
const multer =require('multer');
const request = require('supertest');

const FILES = ['rickroll.pdf', 'avatar.jpg', 'loremipsum.txt'].map(f => __dirname + '/files/' + f);

const server = new mongo.Server(process.env.MONGO_HOST || '127.0.0.1', process.env.MONGO_PORT || 27017);
const db = new mongo.Db('multer-gridfs_test', server, {w:1});
const gridfs = Grid(db, mongo);

const app = express();

app.use(multer({
	storage: GridfsStorage({
		gfs: gridfs,
		metadata: (req, file) => ({
			ip: req.ip,
			foo: 'bar'
		})
	}),
	limits: {
		files: 2
	}
}).array('files'));

app.post('/', (req, res) => {
	res.send({
		files: req.files
	});
});

const clearCollection = cb =>
	db.collection('fs.files').deleteMany({})
		.then(() => db.collection('fs.chunks').deleteMany({}))
		.then(() => cb());

describe('GridfsStorage ', function() {
	before(done => {
		db.open(done);
	});

	describe('with valid data', function() {
		let response;

		before(done => {
			request(app)
				.post('/')
				.attach('files', FILES[0])
				.attach('files', FILES[1])
				.end((err, res) => {
					response = res.body;
					done();
				});
		});

		it('should put the file objects in the request', done => {
			response.files.forEach(file => file.should.have.property('obj'));
			response.files.forEach(file => file.obj.should.have.property('_id'));
			done();
		});

		it('saved files should have same MD5 as the original files', done => {
			response.files.forEach((file, idx) => file.obj.md5.should.be.equal(md5(FILES[idx])));
			done();
		});

		it('should put the uploaded files in Mongo GridFS', done => {
			gridfs.files.count({}, (err, count) => {
				count.should.be.equal(2);
				done(err);
			});
		});

		it('should add the metadata in mongo', done => {
			response.files.forEach(file => file.obj.should.have.property.metadata);
			response.files.forEach(file => file.obj.metadata.should.have.property.ip);
			response.files.forEach(file => file.obj.metadata.should.have.property.foo);
			response.files.forEach(file => file.obj.metadata.foo.should.be.equal('bar'));
			done();
		})

		after(clearCollection);
	});

	describe('with an invalid request', function() {
		let response;

		before(done => {
			request(app)
				.post('/')
				.attach('files', FILES[0])
				.attach('files', FILES[1])
				.attach('files', FILES[2])
				.end(done);
		});

		it('should delete the already processed files', done => {
			gridfs.files.count({}, (err, count) => {
				count.should.be.equal(0);
				done(err);
			});
		});

		after(clearCollection);
	});

	after(done => {
		db.dropDatabase(done);
	});
});
