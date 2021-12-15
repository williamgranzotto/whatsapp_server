// init server
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const SockJS = require('sockjs-client');
const Stomp = require('stompjs');

//init whatsapp web
//const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');

//global variables
let client = null;
let sendMessageMap = null;
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
	
	init(req.body.email);
	
	res.status(204).end();
	
});

function init(_email){
	
	if(client == null){
		
		client = new Map();
		
	}

	if(sendMessageMap == null){
		
		sendMessageMap = new Map();
		sendMessageMap.set(_email, true)
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
		
	console.log("init: " + _email);
	
	//this line is to fix error of clear cache
	if(email.includes(_email)){
		
		logout(_email);
		
	}
		
		console.log("!init includes:" + _email);
	
		email.push(_email);
		
		socket.set(_email, new SockJS(endpoint));
		
		stompClient.set(_email, Stomp.over(socket.get(_email)));
		
		stompClient.get(_email).connect({}, function (frame) {

			client.set(_email, new Client({qrTimeoutMs:0}));
		
			initClient(_email);

		});
	
}

function initClient(_email){
	
	//init QRCode
	console.log(11)
		client.get(_email).on('qr', qr => {
		console.log(22)
			console.log("qr: " + _email);
		
			stompClient.get(_email).send("/app/chat/qr-" + _email, {},
				JSON.stringify({ 'from': "", 'to': "", 'message': qr, 'whatsappMessageType': 'QRCODE' }));
	console.log(33)
		});

	//when QRCode read
	client.get(_email).on('ready', async () => {
		
		console.log("ready: " + _email);
		
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
	
		stompClient.get(_email).subscribe(room, async function (messageOutput) {
alert(1)
			let json = JSON.parse(messageOutput.body);
alert(2)			
			let number = json.to;
			number = number.includes('@c.us') ? number : `${number}@c.us`;
		alert(3)	
			sendMessageMap.set(_email, false);
			alert(4)
			if(json.message.includes("base64,")){
				alert(5)
				const media = await new MessageMedia("image/jpeg", json.message.split("base64,")[1], "image.jpg");
			
				client.get(_email).sendMessage(number, media);
			
			}else{
				alert(6)
				client.get(_email).sendMessage(number, json.message);
				
			}

		});
		
    });
	
	//on message created
	client.get(_email).on('message_create', async msg => {
		
		if(sendMessageMap.get(_email)){
		
			sendMessage(_email, msg);
		
			console.log("message created")
		
		}else{
			
			sendMessageMap.set(_email, true);
			
		}
		
	});
	
	client.get(_email).on('message_ack', (msg, ack) => {
    
		//console.log(ack);
	
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

	room = '/topic/messages/logout-' + _email;
	
		stompClient.get(_email).subscribe(room, function (messageOutput) {
			
			logout(_email);
		
		});
		
		client.get(_email).on('disconnected', (reason) => {
   
			console.log('Client was logged out', reason);

		});

	client.get(_email).initialize();//.catch(ex => {
		
		//console.log(">>>ERROR_INITIALIZE<<<");
		//console.log(ex);
		
	//});

}

function sendMessage(_email, msg){
	
	let pic = null;
	let base64Image = null;
		
	(async () => {
			
		try{
				
			pic = await client.get(_email).getProfilePicUrl(msg.from);
			
			if (msg.hasMedia) {
			
				base64Image = await msg.downloadMedia();
			
			}
			
		}catch(err){
			
			console.log(">>>ERROR_PIC<<< " + _email + " - " + msg.from);
			
		}
		
    })();
    
	setTimeout(function(){
			
		let type = msg.id.remote == msg.from ? "INBOUND" : "OUTBOUND";
	
		if(type == "OUTBOUND" && msg.body.startsWith("/9j/")){
			
			return;
			
		}
			
		let _from = type == "INBOUND" ? msg.from.split("@")[0] : msg.to.split("@")[0];
			
		stompClient.get(_email).send("/app/chat/sendmessage-" + _email, {},
		JSON.stringify({ 'from': _email, 'to': _from, 'message': msg.body, 'whatsappMessageType': type, 
		'whatsappImageUrl': pic , 'base64Image': base64Image != null ? base64Image.data : null}));

		
	}, 1000);
	
}

async function loadCustomers(_email) {
	
	let contacts = await client.get(_email).getContacts();
		
		contactsJson = "[";
		
		for (var key in contacts) {
			
			// skip loop if the property is from prototype
			if (!contacts.hasOwnProperty(key)) continue;

			var obj = contacts[key];
	
			let pic = null;
			
			try{
			
				pic = await client.get(_email).getProfilePicUrl(obj.id._serialized);
    
			}catch(err){
				
				console.log(">>>ERROR_PIC_LOADCUSTOMERS<<<")
				
			}
	
			contactsJson += "{'contact':{'pushname':'" + obj.pushname + "','number':'" + obj.number + "','isGroup':'" + obj.isGroup 
			+ "','isWAContact':'"+ obj.isWAContact +  "','pic':'"+ pic + "'}},";
	
		}
	
		contactsJson = contactsJson.substring(0, contactsJson.length - 1);
		contactsJson += "]";
		
		stompClient.get(_email).send("/app/chat/savecustomers-" + _email, {},
		JSON.stringify({ 'from': _email, 'to': "", 'message': "saved customer", 'whatsappMessageType': 'SAVE_CUSTOMERS', 
		'whatsappImageUrl': "", 'whatsappPushname': "", 'contactsJson': contactsJson }));
	
}

function logout(_email){
	
	console.log("logout: " + _email);
	
	try{
		
		if(email.includes(_email)){
		
			socket.delete(_email);
		
			if(stompClient.get(_email) != null){
		
				stompClient.get(_email).disconnect();
		
			}
		
			stompClient.delete(_email);
		
			if(client.get(_email) != null){
		
				client.get(_email).destroy();
		
			}
		
			client.delete(_email);
		
			let index = email.indexOf(_email);
		
			if (index > -1) {
			
				email.splice(index, 1);
		
			}
		
		}
	
	}catch(err){
		
		console.log(">>>ERROR<<<");
		
	}
	
}

app.listen(8080);