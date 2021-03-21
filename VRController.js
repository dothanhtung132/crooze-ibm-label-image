const { FilesReader, SkillsWriter, SkillsErrorEnum } = require('./skills-kit-2.1');

const VisualRecognitionV3 = require('ibm-watson/visual-recognition/v3');
const VisualRecognitionV4 = require('ibm-watson/visual-recognition/v4');
const { IamAuthenticator } = require('ibm-watson/auth');

const fs = require('fs');
const ReadableStreamClone = require("readable-stream-clone");

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const vr_apiKey = process.env.vr_apiKey;
const vr_versionV3 = process.env.vr_versionV3;
const vr_versionV4 = process.env.vr_versionV4;
const vr_url = process.env.vr_url;
const vr_classifierIds = JSON.parse(process.env.vr_classifierIds);
const vr_collectionIds = JSON.parse(process.env.vr_collectionIds);
const vr_features = JSON.parse(process.env.vr_features);
const vr_threshold = JSON.parse(process.env.vr_threshold);

const auth = new IamAuthenticator({ apikey: vr_apiKey});

//https://cloud.ibm.com/apidocs/visual-recognition/visual-recognition-v3?code=node#classify-images
const visualRecognitionV3 = new VisualRecognitionV3({
  version: vr_versionV3,
  authenticator: auth,
  url: vr_url
});

//https://cloud.ibm.com/apidocs/visual-recognition-v4?code=node#analyze-images
const visualRecognitionV4 = new VisualRecognitionV4({
  version: vr_versionV4,
  authenticator: auth,
  url: vr_url
});

const classifierIds = vr_classifierIds;
const threshold = vr_threshold;
const collectionIds = vr_collectionIds;

exports.analyze = async (req, res) => {
	const filesReader = new FilesReader(req.body);
	const fileContext = filesReader.getFileContext();
	const skillsWriter = new SkillsWriter(fileContext);

	var message = '';
	try {
		var keywords = [];

		var stream = await filesReader.getContentStream();

		const stream1 = new ReadableStreamClone(stream);
		const stream2 = new ReadableStreamClone(stream);

		var classifyResult = await classifyImages(stream1);
		keywords = keywords.concat(classifyResult);

		var analyzeResult = await analyzeImages(stream2);
		keywords = keywords.concat(analyzeResult);

        var cardData = keywords.map((item) => {
            return {
                type: 'text',
                text: item.class
            }
        });
        const keywordCards = skillsWriter.createTopicsCard(cardData);
		await skillsWriter.saveDataCards([keywordCards]);
		message = 'Save Card Success';        
    } catch (error) {
		message = error.message;
		console.error(`Skill processing failed for file: ${fileContext.fileId} with error: ${message}`);
		console.error(message);
		await skillsWriter.saveErrorCard(SkillsErrorEnum.UNKNOWN, message);
	} finally {
		console.log('keywords: ', keywords);
		res.json({
			statusCode: 200,
			body: JSON.stringify({
				message: message
			}),
		});
	}
};

var classifyImages = function(stream) {
	return new Promise((resolve, reject) => {
		const classifyParams = {
			imagesFile: stream,
			classifierIds: classifierIds,
			threshold: threshold,
		};
		visualRecognitionV3.classify(classifyParams)
		.then(response => {
			const classifiedImages = response.result;
			// console.log(JSON.stringify(classifiedImages, null, 2));
			var classifiers = classifiedImages.images[0].classifiers;
			var keywords = [];
			classifiers.forEach(item => {
				keywords = keywords.concat(item.classes);
			});
			resolve(keywords);
		})
		.catch(err => {
			console.log('error:', err);
			reject(err);
		});
	});
}

var analyzeImages = function(stream) {
	return new Promise((resolve, reject) => {
		const analyzeParams = {
			imagesFile: stream,
			collectionIds: collectionIds,
			features: vr_features,
		};
		visualRecognitionV4.analyze(analyzeParams)
		.then(response => {
			const verifiedImages = response.result;
			var objects = verifiedImages.images[0].objects;
			var collections = objects.collections;
			var keywords = [];
			collections.forEach(item => {
				item.objects.forEach(object => {
					keywords.push({
						class: object.object,
						score: object.score
					});
				});
			});
			resolve(keywords);
		})
		.catch(err => {
			console.log('error: ', err);
			reject(err);
		});
	});
}