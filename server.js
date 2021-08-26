// init server
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const SockJS = require('sockjs-client');
const Stomp = require('stompjs');

//init whatsapp web
//const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');

//global variables
let client = null;
let socket = null;
let stompClient = null;

const endpoint = 'https://chefsuite.com.br/chat';
//const endpoint = 'http://localhost:5000/chat';
let email = null;
let contactsJson = null;

app.use(express.static('public'));
app.use(bodyParser.json());

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});
	
// init application
app.post('/init', function (req, res) {
	
	if(client == null){
		
		client = new Map();
		
	}
	
	if(socket == null){
		
		socket = new Map()
		
	}
	
	if(stompClient == null){
		
		stompClient = new Map();
		
	}
	
	if(email == null){
		
		email = new Array();
		
	}
	
	let _email = req.body.email;
	
	if(!email.includes(_email)){
		
		email.push(_email);
		
		socket.set(_email, new SockJS(endpoint));
		
		stompClient.set(_email, Stomp.over(socket.get(_email)));
		
		stompClient.get(_email).connect({}, function (frame) {

		client.set(_email, new Client());
		
		initClient(_email);

	});
		
	}
	
	res.status(204).end();
	
});

function initClient(_email){
	
	//init QRCode
	client.get(_email).on('qr', qr => {
		stompClient.get(_email).send("/app/chat/qr-" + _email, {},
			JSON.stringify({ 'from': "", 'to': "", 'message': qr, 'whatsappMessageType': 'QRCODE' }));
	
	});

	//when QRCode read
	client.get(_email).on('ready', async () => {
		console.log('Client is ready!');
		
		let room = '/topic/messages/loadcustomers-' + _email;
	
		stompClient.get(_email).subscribe(room, function (messageOutput) {
			
			loadCustomers(_email);
		
		});
		
		let info = await client.get(_email).info;
		let pic = null;
		
		if(info != undefined){
		
			pic = await client.get(_email).getProfilePicUrl(client.get(_email).info.wid.user);
		
		}
	
        let pushname = await client.get(_email).info.pushname;
			
		stompClient.get(_email).send("/app/chat/ready-" + _email, {},
		JSON.stringify({ 'from': _email, 'to': "", 'message': "", 'whatsappMessageType': 'READY', 
		'whatsappImageUrl': pic, 'whatsappPushname': pushname, 'contactsJson': contactsJson }));
		
		room = '/topic/messages/sendmessagefromsystem-' + _email;
	
		stompClient.get(_email).subscribe(room, function (messageOutput) {

			let json = JSON.parse(messageOutput.body);
		
			let number = json.to;
			number = number.includes('@c.us') ? number : `${number}@c.us`;
        
			client.get(_email).sendMessage(number, json.message);

		});
		
		room = '/topic/messages/logout-' + _email;
	
		stompClient.get(_email).subscribe(room, function (messageOutput) {
			
			logout(_email);
		
		});
	
    });
	
	//on message received
	client.get(_email).on('message', async msg => {
		
		let pic = null;
		let base64Image = null;
		
		(async () => {
			
			pic = await client.get(_email).getProfilePicUrl(msg.from);
			
			if (msg.hasMedia) {
			
				base64Image = await msg.downloadMedia();
			
			}
		
        })();
    
	    setTimeout(function(){
			
		    stompClient.get(_email).send("/app/chat/sendmessage-" + _email, {},
			JSON.stringify({ 'from': _email, 'to': msg.from.split("@")[0], 'message': msg.body, 'whatsappMessageType': 'INBOUND', 
			'whatsappImageUrl': pic , 'base64Image': base64Image != null ? base64Image.data : ''}));
		
		}, 1000);
		
	});
	
	client.get(_email).on('message_ack', (msg, ack) => {
    
	console.log(ack);
	
	/*
        == ACK VALUES ==
        ACK_ERROR: -1
        ACK_PENDING: 0
        ACK_SERVER: 1
        ACK_DEVICE: 2
        ACK_READ: 3
        ACK_PLAYED: 4
    */

    if(ack == 3) {
		
        stompClient.get(_email).send("/app/chat/messageread-" + _email, {},
		JSON.stringify({ 'from': msg.id.remote.split('@')[0], 'to': "", 'message': "", 'whatsappMessageType': 'READ', 
		'whatsappImageUrl': '', 'whatsappPushname': '', 'contactsJson': '' }));
    }
});

	client.get(_email).initialize();

}

async function loadCustomers(_email) {
	
	let contacts = await client.get(_email).getContacts();
		
		contactsJson = "[";
		
		for (var key in contacts) {
			// skip loop if the property is from prototype
			if (!contacts.hasOwnProperty(key)) continue;

			var obj = contacts[key];
	
			let pic = await client.get(_email).getProfilePicUrl(obj.id._serialized);
    
			contactsJson += "{'contact':{'pushname':'" + obj.pushname + "','number':'" + obj.number + "','isGroup':'" + obj.isGroup 
			+ "','isWAContact':'"+ obj.isWAContact +  "','pic':'"+ pic + "'}},";
	
		}
	
		contactsJson = contactsJson.substring(0, contactsJson.length - 1);
		contactsJson += "]";
		
		stompClient.get(_email).send("/app/chat/savecustomers-" + _email, {},
		JSON.stringify({ 'from': _email, 'to': "", 'message': "", 'whatsappMessageType': 'SAVE_CUSTOMERS', 
		'whatsappImageUrl': "", 'whatsappPushname': "", 'contactsJson': contactsJson }));
	
}

function logout(_email){
	
	if(email.includes(_email)){
		
		Object.keys(client.get(_email)).forEach(function (key) {
		
			if(key.match('^'+ _email)) delete client[key];

		});
		
		Object.keys(socket.get(_email)).forEach(function (key) {
		
			if(key.match('^'+ _email)) delete socket[key];

		});
		
		Object.keys(stompClient.get(_email)).forEach(function (key) {
		
			if(key.match('^'+ _email)) delete stompClient[key];

		});
		
		const index = email.indexOf(_email);
		
		if (index > -1) {
			
			email.splice(index, 1);
		
		}
		
	}
	
	initClient(_email)
	
}

app.listen(8080);