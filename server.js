// init server
//const v8 = require('v8');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const SockJS = require('sockjs-client');
const Stomp = require('stompjs');

//init whatsapp web
//const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');

//global variables
const endpoint = 'https://chefsuite.com.br/chat';
//const endpoint = 'http://localhost:5000/chat';
let client = null;
let sendMessageMap = null;
let socket = null;
let stompClient = null;
let email = null;
let contactsJson = null;
let messagesJson = null;
let cancelLoading = null;

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
app.get('/', async function (req, res) {
	
	//console.log(v8.getHeapStatistics());
	//console.log("Cycle", i, process.memoryUsage().heapUsed);
	//200 OK to prevent severe warning on aws
	res.status(200).end();
	
});
	
// init application
app.post('/init', function (req, res) {
	
	try{
	
		init(req.body.email);
	
		res.status(204).end();
	
	}catch(ex){
		
		console.log("Error inside full code.");
		console.log(ex);
		
	}
	
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
	
	if(cancelLoading == null){
		
		cancelLoading = new Array();
		
	}
		
	console.log("init: " + _email);
	
	//this line is to fix error of clear cache
	//logout(_email, false);
	
	email.push(_email);
		
	socket.set(_email, new SockJS(endpoint));
		
	stompClient.set(_email, Stomp.over(socket.get(_email)));
		
	stompClient.get(_email).connect({}, function (frame) {
			
		let _client = new Client({qrTimeoutMs:0});

		console.log("client", client.get(_email))

		if(client.get(_email) == undefined){

			client.set(_email, _client);
		
			initClient(_email);
		
		}
		
	});
		
		
	
}

function initClient(_email){
	
	//init QRCode
	let _qr = 1;
	
	client.get(_email).on('qr', qr => {
		
		console.log("qr", _qr, _email);
		
		if(_qr < 3){
			
			stompClient.get(_email).send("/app/chat/qr-" + _email, {},
			JSON.stringify({ 'from': "", 'to': "", 'message': qr, 'whatsappMessageType': 'QRCODE' }));
			
		}else if(_qr == 3){
			
			try{
				
				stompClient.get(_email).send("/app/chat/refresh-" + _email, {},
				JSON.stringify({ 'from': "", 'to': "", 'message': "", 'whatsappMessageType': 'REFRESH', 
				'whatsappImageUrl': '', 'whatsappPushname': '', 'contactsJson': '' }));
			
			}catch(err){
				
				//LEFT BLANK INTENTIONALLY
				
			}
			
			logout(_email, true);
			
		}
		
		_qr++;
		
	
	});
		
	//when QRCode read
	client.get(_email).on('ready', async () => {
		
		console.log("ready", _email)
		
		let info = await client.get(_email).info;
		
	    let _isMultiDevice = await isMultiDevice(info.wid.user, _email).then((result) => { 
		
			if(result){
			
				stompClient.get(_email).send("/app/chat/refresh-" + _email, {},
				JSON.stringify({ 'from': "", 'to': "", 'message': "", 'whatsappMessageType': 'REFRESH', 
				'whatsappImageUrl': '', 'whatsappPushname': '', 'contactsJson': '' }));
			
				return null;
				
			}
		
			return result;
		
		});
		
		if(_isMultiDevice == null){
			
			stompClient.get(_email).send("/app/chat/alert-" + _email, {},
			JSON.stringify({ 'from': "", 'to': "", 'message': "Aviso!:O modo Múltiplos aparelhos do seu WhatsApp está ativado. Desative-o para se conectar.:warning", 'whatsappMessageType': 'REFRESH', 
			'whatsappImageUrl': '', 'whatsappPushname': '', 'contactsJson': '' }));
			
			await logout(_email, false);
			
			return;
			
		}
		
		let room = '/topic/messages/loadcustomers-' + _email;
	
		stompClient.get(_email).subscribe(room, function (messageOutput) {
			
			let json = JSON.parse(messageOutput.body);
			
			loadCustomers(_email, json.syncMessagesCount);
		
		});
		
		let pic = null;
		
		if(info != undefined && info.wid != undefined){
            
			pic = await getProfilePic(info.wid.user, _email);
				   
		}
	
        let pushname = await client.get(_email).info.pushname;
			
		stompClient.get(_email).send("/app/chat/ready-" + _email, {},
		JSON.stringify({ 'from': _email, 'to': "", 'message': "", 'whatsappMessageType': 'READY', 
		'whatsappImageUrl': pic, 'whatsappPushname': pushname, 'contactsJson': contactsJson }));
		
		room = '/topic/messages/sendmessagefromsystem-' + _email;
	
		stompClient.get(_email).subscribe(room, async function (messageOutput) {

			let json = JSON.parse(messageOutput.body);
			
			let number = json.to;
			number = number.includes('@c.us') ? number : `${number}@c.us`;
		
			sendMessageMap.set(_email, false);
			
			if(json.message.includes("base64,")){
				
				const media = await new MessageMedia("image/jpeg", json.message.split("base64,")[1], "image.jpg");
			
				client.get(_email).sendMessage(number, media);
			
			}else{
				
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
	
	stompClient.get(_email).subscribe(room, async function (messageOutput) {
			
		await logout(_email, false);
		
	});
	
	room = '/topic/messages/logout-qrcode-' + _email;
	
	stompClient.get(_email).subscribe(room, function (messageOutput) {
			
		logout(_email, true);
		
	});
	
	room = '/topic/messages/init-wa-loading-' + _email;
	
	stompClient.get(_email).subscribe(room, function (messageOutput) {
			
		let json = JSON.parse(messageOutput.body);
			
		//loadCustomers(_email, json.syncMessagesCount);
		
		stompClient.get(_email).send("/app/chat/loadcustomers-" + _email, {},
		JSON.stringify({ 'from': _email, 'to': "", 'message': "LOAD_CUSTOMERS", 'whatsappMessageType': 'LOAD_CUSTOMERS', 
		'syncMessagesCount': json.syncMessagesCount, 'whatsappPushname': "", 'contactsJson': '', 'messagesJson': ''}));
		
	});
	
	room = '/topic/messages/cancel-loading-' + _email;
	
	stompClient.get(_email).subscribe(room, function (messageOutput) {
			
		if(!cancelLoading.includes(_email)){
			
			cancelLoading.push(_email);
		
		}
		
	});
		
	client.get(_email).on('disconnected', async (reason) => {
   
		console.log('Client was logged out', reason);
		
		if(reason == "CONFLICT"){
			
			//in this case show message for user alerting him session isn't available anymore. Most likely because he connected to another software.
			
			await logout(_email, false);
			
		}

	});
		
	setTimeout(function(){
	
		client.get(_email).initialize().catch(ex => {
		
			console.log("Error inside initialize.")
			console.log(ex);
		
		});
	
	}, 1000);

}

async function isMultiDevice(number, _email){
	
	let result = await client.get(_email).getNumberId(number).then(async (id) => {
                    
		try{
			
			const profilePicObj = await client.get(_email).pupPage.evaluate((contactId) => {
            
				return window.Store.Wap.profilePicFind(contactId);
				
			}, id.user + '@' + id.server);
				
			return false;
			
		}catch(ex){
			
			if(ex.message == "Evaluation failed: g"){
					
				return true;
					
			}
						
		}
				
    });

	return result;
	
}

async function getProfilePic(number, _email){
	
	let profilePic = await client.get(_email).getNumberId(number).then(async (id) => {
                
		if (id != null) {
                    
			try{
			
				const profilePicObj = await client.get(_email).pupPage.evaluate((contactId) => {
            
					return window.Store.Wap.profilePicFind(contactId);
				
				}, id.user + '@' + id.server);
			
				return profilePicObj.eurl;
			
			}catch(ex){
						
				if(ex.message == "Evaluation failed: g"){
					
					return null;
					
				}
						
			}
			
        }else {
		
			return null;
		
		}
				
    });

	return profilePic;
	
}

function sendMessage(_email, msg){
	
	let pic = null;
	let base64Image = null;
		
	(async () => {
			
		try{
				
			let number = msg.from.split("@")[0];
				
			pic = await getProfilePic(number, _email);
			
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

async function loadCustomers(_email, limit) {
	
	if(cancelLoading.includes(_email)){
	
		let index = cancelLoading.indexOf(_email);
		
		if (index > -1) {
			
			cancelLoading.splice(index, 1);
		
		}
			
	}
	
	let contacts = await client.get(_email).getContacts();
	
	let contactsLength = 0;
	
	for (var key in contacts) {
		
		// skip loop if the property is from prototype
		if (!contacts.hasOwnProperty(key)) continue;
		
		var obj = contacts[key];
		
		if(!obj.isWAContact || obj.isGroup || obj.isBlocked){
			
			continue;
		
		}
		
		let chat = await obj.getChat();
		
		if(chat == null || chat.archived || chat.isReadOnly || chat.isMuted || chat.isGroup){
		
			continue;

		}
		
		contactsLength++;
		
	}
	
	let i = 0;
	for (var key in contacts) {

		if(cancelLoading.includes(_email)){
				
			contacts = null;
			contactsJson = null;
			messagesJson = null;
				
			break;
			
		}
		
		// skip loop if the property is from prototype
		if (!contacts.hasOwnProperty(key)) continue;

		var obj = contacts[key];
		
		if(!obj.isWAContact || obj.isGroup || obj.isBlocked){
			
			continue;
		
		}
		
		contactsJson = "[";
		messagesJson = "[";
			
		try{
				
			let chat = await obj.getChat();
			
			if(chat == null || chat.archived || chat.isReadOnly || chat.isMuted || chat.isGroup){
		
				continue;

			}	
				
			let searchOptions = new Object();
			searchOptions.limit = limit;
				
			let messages = await chat.fetchMessages(searchOptions);
			
			if(messages.length == 0){
				
				i++;
			
				updatePercentage(contactsLength, i, _email);
			
				continue;
				
			}
			
			updatePercentage(contactsLength, i, _email);
			
			for(let j = 0; j < messages.length; j++){
				
				let msg = messages[j];
				
				let type = msg.id.remote == msg.from ? "INBOUND" : "OUTBOUND";
	
				if(!(type == "OUTBOUND" && msg.body.startsWith("/9j/"))){
			
					let _from = type == "INBOUND" ? msg.from.split("@")[0] : msg.to.split("@")[0];
				
					let base64Image = null;
				
					try{
				
						let number = msg.from.split("@")[0];
						
						if (msg.hasMedia) {
			
							//base64Image = await msg.downloadMedia();
						
							//let media = msg.type == "image" ? "data:image/png;base64," + (base64Image != null ? base64Image.data : null) : "[MEDIA]"
						
							let media = "[MEDIA]";
						
							messagesJson += "{'whatsappMessage':{'from':'" + _email + "','to':'" + _from 
							+ "','message':'" + media
							+ "','whatsappMessageType':'"+ type + "','whatsappImageUrl':'"+ '' 
							+  "','base64Image':'"+ (base64Image != null ? base64Image.data : null) + "','timestamp':'"+ msg.timestamp + "'}},";
			
						}else{
						
							messagesJson += "{'whatsappMessage':{'from':'" + _email + "','to':'" + _from + "','message':'" + msg.body 
							+ "','whatsappMessageType':'"+ type + "','whatsappImageUrl':'"+ '' 
							+  "','base64Image':'"+ (base64Image != null ? base64Image.data : null) + "','timestamp':'"+ msg.timestamp + "'}},";
						
						}
						
					
					}catch(err){
			
						//LEFT BLANK INTENTIONALLY
			
					}
				
				}
				
			};
			
		}catch(ex){
			
			//LEFT BLANK INTENTIONALLY
			
		}
			
		try{
			
			if(obj.id != undefined){
				
				pic = await getProfilePic(obj.id.user, _email);
				
			}
			
		}catch(err){
				
			console.log(">>>ERROR_PIC_LOADCUSTOMERS<<<")
				
		}
	
		contactsJson += "{'contact':{'pushname':'" + obj.pushname + "','number':'" + obj.number + "','isGroup':'" + obj.isGroup 
		+ "','isWAContact':'"+ obj.isWAContact +  "','pic':'"+ (pic != null ? pic : "") + "'}}]";
		
		messagesJson = messagesJson.substring(0, messagesJson.length - 1);
		messagesJson += "]";
			
		stompClient.get(_email).send("/app/chat/savecustomers-" + _email, {},
		JSON.stringify({ 'from': _email, 'to': "", 'message': "saved customer", 'whatsappMessageType': 'SAVE_CUSTOMERS', 
		'whatsappImageUrl': "", 'whatsappPushname': "", 'contactsJson': contactsJson, 'messagesJson': messagesJson }));
			
		i++;
		
	}
	
	stompClient.get(_email).send("/app/chat/close-loading-" + _email, {},
	JSON.stringify({ 'from': "", 'to': "", 'message': '', 'whatsappMessageType': 'CLOSE_LOADING', 
	'whatsappImageUrl': "", 'whatsappPushname': "", 'contactsJson': '', 'messagesJson': '' }));

}

function updatePercentage(contactsLength, i, _email){
	
	let percent = (100 / contactsLength) * i;
		let percentMsg = Number((percent).toFixed(0)) + "% sincronizado";
			setTimeout(function(){
		stompClient.get(_email).send("/app/chat/updatepercentage-" + _email, {},
		JSON.stringify({ 'from': "", 'to': "", 'message': percentMsg, 'whatsappMessageType': 'UPDATE_PERCENTAGE', 
		'whatsappImageUrl': "", 'whatsappPushname': "", 'contactsJson': '', 'messagesJson': '' }));
			}, 1000)
	
}

async function logout(_email, qr){
	
	console.log("logout: " + _email);
	
	try{
		
		if(email.includes(_email)){
		
			socket.delete(_email);
		
			if(stompClient.get(_email) != null){
		
				stompClient.get(_email).disconnect();
		
			}
		
			stompClient.delete(_email);
		
			if(client.get(_email) != null){
		
				if(qr){
					
					client.get(_email).destroy();
					
				}else{
					
					await client.get(_email).logout().catch(err => {
			
						//left blank intentionally
					
					});
				
				}
		
			}
		
			client.delete(_email);
		
			let index = email.indexOf(_email);
		
			if (index > -1) {
			
				email.splice(index, 1);
		
			}
		
		}
	
	}catch(err){
		
		console.log(">>>ERROR_LOGOUT<<<");
		
	}
	
}

app.listen(8080);