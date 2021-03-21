const express = require('express');
const VRController = require('./VRController');

const app = express();
app.use(express.text({
	type: 'application/json'
}));

app.post('/', VRController.analyze);

const port = process.env.PORT || 3005;
app.listen(port, () => {
	console.log(`App UI available http://localhost:${port}`);
});