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
//const endpoint = 'https://chefsuite.com.br/chat';
const endpoint = 'http://localhost:5000/chat';
let email = null;
let contactsJson = null;

app.use(express.static('public'));
app.use(bodyParser.json());

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');

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

	let data = '';
	
    req.on('data', chunk => {
		data += chunk;
    });
	
    req.on('end', () => {
		email = JSON.parse(data).email;
		console.log(email);
		res.end();
    });
	
	socket = new SockJS(endpoint);
    stompClient = Stomp.over(socket);

	stompClient.connect({}, function (frame) {

		client = new Client();
		
		initClient();

	});
	
	res.status(204).end();
	
});

async function loadCustomers() {
	
	let contacts = await client.getContacts();
		
		contactsJson = "[";
		
		let i = 0;
		for (var key in contacts) {
			// skip loop if the property is from prototype
			if (!contacts.hasOwnProperty(key)) continue;

			var obj = contacts[key];
	
			let pic = await client.getProfilePicUrl(obj.id._serialized);
    
			contactsJson += "{'contact':{'pushname':'" + obj.pushname + "','number':'" + obj.number + "','isGroup':'" + obj.isGroup 
			+ "','isWAContact':'"+ obj.isWAContact +  "','pic':'"+ pic + "'}},";
				
			i++;
			if(i == 5){
				
			break;
				
			}
	
		}
	
		contactsJson = contactsJson.substring(0, contactsJson.length - 1);
		contactsJson += "]";
		
		console.log(contactsJson);
		
		stompClient.send("/app/chat/savecustomers" + email, {},
		JSON.stringify({ 'from': email, 'to': "", 'message': "", 'whatsappMessageType': 'SAVE_CUSTOMERS', 
		'whatsappImageUrl': "", 'whatsappPushname': "", 'contactsJson': contactsJson }));
	
}

function initClient(){
	
	//init QRCode
	client.on('qr', qr => {
    
		stompClient.send("/app/chat/qr-" + email, {},
			JSON.stringify({ 'from': "", 'to': "", 'message': qr, 'whatsappMessageType': 'QRCODE' }));
	
	});

	//when QRCode read
	client.on('ready', async () => {
		console.log('Client is ready!');
		
		let room = '/topic/messages/loadcustomers-' + email;
	
		stompClient.subscribe(room, function (messageOutput) {
			
			loadCustomers();
		
		});
		
		let pic = await client.getProfilePicUrl(client.info.wid.user);

        let pushname = await client.info.pushname;
			
		stompClient.send("/app/chat/ready-" + email, {},
		JSON.stringify({ 'from': "", 'to': "", 'message': "", 'whatsappMessageType': 'READY', 
		'whatsappImageUrl': pic, 'whatsappPushname': pushname, 'contactsJson': contactsJson }));
		
		room = '/topic/messages/sendmessage-' + email;
	
		stompClient.subscribe(room, function (messageOutput) {

			let json = JSON.parse(messageOutput.body);
		
			let number = json.to;
			number = number.includes('@c.us') ? number : `${number}@c.us`;
        
			client.sendMessage(number, json.message);

		});
	
    });
	
	//on message received
	client.on('message', async msg => {
		console.log('MESSAGE RECEIVED', await client.info.wid.use);
		
		let pic = null;
		
		let socket = new SockJS(endpoint);
		let stompClient = Stomp.over(socket);
		
		(async () => {
			
			pic = await client.getProfilePicUrl(msg.from);
		
        })();

        stompClient.connect({}, function (frame) {
    
	    setTimeout(function(){
		    stompClient.send("/app/chat/sendmessage-" + email, {},
			JSON.stringify({ 'from': email, 'to': msg.from.split("@")[0], 'message': msg.body, 'whatsappMessageType': 'INBOUND', 
			'whatsappImageUrl': pic }));
		
		}, 1000);
		
		});
		
		if (msg.body === '!mention') {
			const contact = await msg.getContact();
			const chat = await msg.getChat();
			chat.sendMessage(`Hi @${contact.number}!`, {
				mentions: [contact]
			});
		} else if (msg.body === '!delete') {
			if (msg.hasQuotedMsg) {
				const quotedMsg = await msg.getQuotedMessage();
				if (quotedMsg.fromMe) {
					quotedMsg.delete(true);
				} else {
					msg.reply('I can only delete my own messages');
				}
			}
		} else if (msg.body === '!pin') {
			const chat = await msg.getChat();
			await chat.pin();
		} else if (msg.body === '!archive') {
			const chat = await msg.getChat();
			await chat.archive();
		} else if (msg.body === '!mute') {
			const chat = await msg.getChat();
			// mute the chat for 20 seconds
			const unmuteDate = new Date();
			unmuteDate.setSeconds(unmuteDate.getSeconds() + 20);
			await chat.mute(unmuteDate);
		} else if (msg.body === '!typing') {
			const chat = await msg.getChat();
			// simulates typing in the chat
			chat.sendStateTyping();
		} else if (msg.body === '!recording') {
			const chat = await msg.getChat();
			// simulates recording audio in the chat
			chat.sendStateRecording();
		} else if (msg.body === '!clearstate') {
			const chat = await msg.getChat();
			// stops typing or recording in the chat
			chat.clearState();
		} else if (msg.body === '!jumpto') {
			if (msg.hasQuotedMsg) {
				const quotedMsg = await msg.getQuotedMessage();
				client.interface.openChatWindowAt(quotedMsg.id._serialized);
			}
		}
	});

	client.initialize();

}

app.listen(8080);