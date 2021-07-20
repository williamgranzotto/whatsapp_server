// init server
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const SockJS = require('sockjs-client');
const Stomp = require('stompjs');

app.use(express.static('public'));
app.use(bodyParser.json());

// create a Nexmo client
// create a Nexmo client
const Nexmo = require('nexmo');
const nexmo = new Nexmo({
  apiKey: '67141185',
  apiSecret: 'f84iQpRvb3KdI2WG',
  applicationId: '6e6125a4-55d1-4f11-a13c-168840584141',
  privateKey: 'C:/Users/Usuario/Downloads' + '/private.key' 
}, {
  apiHost: 'messages-sandbox.nexmo.com'
});

// when someone messages the number linked to this app, this endpoint "answers"
app.post('/answer', function (req, res) {
	
    let from = req.body.from.number.split(" ").join("").replace("+", "").replace("(", "").replace("}", "").replace("-", "");
	let to = req.body.to.number.split(" ").join("").replace("+", "").replace("(", "").replace("}", "").replace("-", "");
	let message = req.body.message.content.text;
	let endpoint = 'https://chefsuite.com.br/chat';
	//let endpoint = 'http://localhost:5000/chat';
	
	let socket = new SockJS(endpoint);
    let stompClient = Stomp.over(socket);
	stompClient.connect({}, function (frame) {
    
	stompClient.send("/app/chat/" + to + "-" + from, {},
        JSON.stringify({ 'from': from, 'to': to, 'message': message, 'whatsappMessageType': 'INBOUND' }));
	
	});
	
  res.status(204).end();

});

// this endpoint receives information about events in the app
app.post('/event', function (req, res) {

  res.status(204).end();

});

const port = process.env.port || 3000
app.listen(port);
