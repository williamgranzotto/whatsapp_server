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
const endpoint = 'https://contachefe.com/chat';
//const endpoint = 'http://localhost:5000/chat';
let client = null;
//let sendMessageMap = null;
let socket = null;
let stompClient = null;
let timerId = null;
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

	//if(sendMessageMap == null){
		
		//sendMessageMap = new Map();
		//sendMessageMap.set(_email, true)
	
	//}
	
	if(socket == null){
		
		socket = new Map()
		
	}
	
	if(stompClient == null){
		
		stompClient = new Map();
		
	}
	
	if(timerId == null){
		
		timerId = new Map();
		
	}
	
	if(email == null){
		
		email = new Array();
		
	}
	
	if(cancelLoading == null){
		
		cancelLoading = new Array();
		
	}
		
	console.log("init: " + _email);
	
	//this line is to fix error of clear cache
	if(client.get(_email) != undefined){
	
		logout(_email, true);
	
	}
	
	email.push(_email);
		
	socket.set(_email, new SockJS(endpoint));
		
	stompClient.set(_email, Stomp.over(socket.get(_email)));
		
	stompClient.get(_email).connect({}, function (frame) {
			
		let _client = new Client({qrTimeoutMs:0});

		client.set(_email, _client);
		
		initClient(_email);
		
		keepAlive(_email);
		
		socket.get(_email).onclose = function (e) {

			cancelKeepAlive();

		};
		
	});
	
}

function keepAlive(_email) {

    var timeout = 30000;

    if (socket.get(_email) !== undefined && socket.get(_email).readyState == 1) {

      socket.get(_email).send('');

    }

    timerId.set(_email, setTimeout(keepAlive, timeout, _email));

  }

function cancelKeepAlive(_email) {

    if (timerId.get(_email)) {

      clearTimeout(timerId.get(_email));

    }

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
	
	client.get(_email).on('authenticated', () => {
    
	});
		
	//when QRCode read
	client.get(_email).on('ready', async () => {
		
		console.log("ready", _email)
		
		let info = await client.get(_email).info;
		
		let room = '/topic/messages/loadcustomers-' + _email;
	
		stompClient.get(_email).subscribe(room, function (messageOutput) {
			
			let json = JSON.parse(messageOutput.body);
			
			loadCustomers(_email, json.syncMessagesCount);
		
		});
		
		let pic = null;
		
		if(info != undefined && info.wid != undefined){
            
			pic = await client.get(_email).getProfilePicUrl(info.wid._serialized);
				   
		}
	
        let pushname = info.pushname;
		
		stompClient.get(_email).send("/app/chat/ready-" + _email, {},
		JSON.stringify({ 'from': _email, 'to': "", 'message': "", 'whatsappMessageType': 'READY', 
		'whatsappImageUrl': pic, 'whatsappPushname': pushname, 'contactsJson': contactsJson }));
		
		room = '/topic/messages/sendmessagefromsystem-' + _email;
	
		stompClient.get(_email).subscribe(room, async function (messageOutput) {

			let json = JSON.parse(messageOutput.body);
			
			let number = json.to;
			number = number.includes('@c.us') ? number : `${number}@c.us`;
		
			//sendMessageMap.set(_email, false);
			
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
		
		//if(sendMessageMap.get(_email)){
			
			//When is in broadcast list then ignore. Broadcast list is used to send messages to several contacts at the same time.
			if(msg.from === "status@broadcast"){
		
				return;
		
			}
		
			sendMessage(_email, msg);
		
			console.log("message created")
		
		//}else{
			
			//sendMessageMap.set(_email, true);
			
		//}
		
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
			
			stompClient.get(_email).send("/app/chat/alert-" + _email, {},
				JSON.stringify({ 'from': "", 'to': "", 'message': "Aviso!:Clique em \"Desconectar\" e conecte-se novamente para utilizar o Whatsapp Web.:warning", 'whatsappMessageType': 'REFRESH', 
				'whatsappImageUrl': '', 'whatsappPushname': '', 'contactsJson': '' }));
			
			logout(_email, true);
			
		}

	});
		
	setTimeout(function(){
	
		client.get(_email).initialize().catch(ex => {
		
			console.log("Error inside initialize.")
			console.log(ex);
		
		});
	
	}, 1000);

}

function sendMessage(_email, msg){
	
	let pic = null;
		
	(async () => {
			
		try{
				
			let type = msg.id.remote == msg.from ? "INBOUND" : "OUTBOUND";
	
			if(type == "OUTBOUND" && msg.body.startsWith("/9j/")){
			
				return;
			
			}
			
			let number = msg.from.split("@")[0];
			
			pic = await client.get(_email).getProfilePicUrl(msg.from);
		
			let _from = type == "INBOUND" ? msg.from.split("@")[0] : msg.to.split("@")[0];
				
			if (msg.hasMedia) {
			
				await msg.downloadMedia().then((data) =>{
		
					let base64 = 'data:' + data.mimetype + ';base64,' + data.data;
			
					let _pic = type == "INBOUND" ? pic : null;
		
					stompClient.get(_email).send("/app/chat/sendmessage-" + _email, {},
					JSON.stringify({ 'from': _email, 'to': _from, 'message': msg.body, 'whatsappMessageType': type, 
					'whatsappImageUrl': _pic , 'base64Image': base64.includes("image/") ? base64 : null, 
					'base64Audio': base64.includes("audio/") ? base64 : null, 'base64Video': base64.includes("video/") ? base64 : null}));
					
				});
			
			}else{
			
				let _pic = type == "INBOUND" ? pic : null;
		
				stompClient.get(_email).send("/app/chat/sendmessage-" + _email, {},
				JSON.stringify({ 'from': _email, 'to': _from, 'message': msg.body, 'whatsappMessageType': type, 
				'whatsappImageUrl': _pic , 'base64Image':  null, 'base64Audio': null, 'base64Video': null}));
				
			}
				
		}catch(err){
			
			console.log(">>>ERROR_PIC<<< " + _email + " - " + msg.from);
			
		}
		
    })();
	
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
	
	for (let w = 0; w < contacts.length; w++) {
		
		var obj = contacts[w];
		
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
	
	let updatePercentageInterval = setInterval(function(){
		
		updatePercentage(contactsLength, i, _email);
		
	}, 3000);
	
	for (let w = 0; w < contacts.length; w++) {

		if(cancelLoading.includes(_email)){
				
			contacts = null;
			contactsJson = null;
			messagesJson = null;
				
			break;
			
		}
		
		var obj = contacts[w];
		
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
	
			let messages = await new Promise(async (resolve, reject) => {
			
			const timeoutId = setTimeout(() => {
				
				resolve(null)
			
			}, 10000) // wait 10 sec
			
    			resolve(await chat.fetchMessages(searchOptions))
				clearTimeout(timeoutId)

			})
	
			if(messages.length == 0){
				
				i++;
			
				continue;
				
			}
			
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
						
							//let media = msg.type == "image" ? "data:image/png;base64," + (base64Image != null ? base64Image.data : null) : "[MÍDIA]"
						
							let media = "[MÍDIA]";
						
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
				
				pic = await client.get(_email).getProfilePicUrl(obj.id._serialized);
				
			}
			
		}catch(err){
				
			console.log(">>>ERROR_PIC_LOADCUSTOMERS<<<")
				
		}
	
		contactsJson += "{'contact':{'pushname':'" + obj.name + "','number':'" + obj.number + "','isGroup':'" + obj.isGroup 
		+ "','isWAContact':'"+ obj.isWAContact +  "','pic':'"+ (pic != null ? pic : "") + "'}}]";
		
		messagesJson = messagesJson.substring(0, messagesJson.length - 1);
		messagesJson += "]";
			
		stompClient.get(_email).send("/app/chat/savecustomers-" + _email, {},
		JSON.stringify({ 'from': _email, 'to': "", 'message': "saved customer", 'whatsappMessageType': 'SAVE_CUSTOMERS', 
		'whatsappImageUrl': "", 'whatsappPushname': "", 'contactsJson': contactsJson, 'messagesJson': messagesJson }));
			
		i++;
		
	}
	
	clearInterval(updatePercentageInterval);
	
	stompClient.get(_email).send("/app/chat/close-loading-" + _email, {},
	JSON.stringify({ 'from': "", 'to': "", 'message': '', 'whatsappMessageType': 'CLOSE_LOADING', 
	'whatsappImageUrl': "", 'whatsappPushname': "", 'contactsJson': '', 'messagesJson': '' }));
	
	if(!cancelLoading.includes(_email)){
		
		stompClient.get(_email).send("/app/chat/alert-" + _email, {},
		JSON.stringify({ 'from': "", 'to': "", 'message': "Pronto!:Os seus contatos estão sincronizados.:info", 'whatsappMessageType': 'REFRESH', 
		'whatsappImageUrl': '', 'whatsappPushname': '', 'contactsJson': '' }));
			
	}

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
		
			socket.get(_email).close();
		
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