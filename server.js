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
  privateKey: '-----BEGIN PRIVATE KEY-----MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCIQzkZZPy4/OgIQrjdPLjTeHsVIxzcA7legJBRoJEmwSNFK+aN9a3jM9BP0oMBz/2TiI0oR3UCHvlQfqSIq1QVoQG+4VNJx6icUeBvok36x/Gj3V79s19R7QgS7sFwYy5tHBLB2JHjvsFAkbVhw/Tx5FF4z0s6TeWXwJnwyY3vOu37CCoYMQsBbu5O1J1vpohSUlotH4fV9UK6zxBFlT0qtCpr87t0Crrq4W/PXehEzydbmcnftj/l9DcY2Xig41sK5l9U5hZoAjW95MCa/MRpgcq5Mf5uqZ0AS9NEI+lsCJJHHGOPGTkvJlLXVdlJwMohGh3shoe1Wpre24mL6B9tAgMBAAECggEALVriyJcan6Bew1EiI1Gw24LAxTpYwsriipgUcXcWmWW0DbQdG6do57U5YzhYruPCLbdH9N5EDh6tMaPVtEACzug2oohxpp80ekOuhrnpZs3imn52vc9UrPpOs66Q6I26yEqN28PwW3QE8y8Mxqvo/hLXI3UsPw3qm+ZZ1xHfkn74mxD/QVa4BCPeCldt3XV2DTJbRCxAtkWIayLX8UNUFINTpsOSdNrmomOTXpHaYP4tFcdzhRPRgqxPB225Qinl6mn3VzFVT3aF+t+aQJuJhM9jYtZJ6dnBrsW965Z7C3fjrqZeEKRwd+PgQWXyawpGa9DnGQPA/lYpnqicFNH6aQKBgQC9O8XYnP1iaOUB1Ma4drXWvts8Fwzig3gRMiYImPwevExug1TzVjziqVcBq7M8SCIH23yfL35DQfBH5/TKu1J/raJPeKgPqdHegp48GqXQdA8uxyRRswaloEN1DC551rmCElhMxSaOOa7PvZoVeCzBYXmBeixPJac8a7kM6mcBfwKBgQC4Vu8z/15ELRbRq5WsNW7tZXT/62hsKe2QuZs3XcpefGanBK1p0+ai5BN7MAWKgdhbJCXJ9R1FESKLUwLy80JqUtKU7aBjWc36ySPcZfvoJhG9yc3fDbIWU8+bTGW869wKhQ9sTlHCiyNvytIumdN7qYyIVTb3l5LKnmOuWXh9EwKBgBCM/czoTjEhQ4ZZedgAaf8SSlKDIZleLk4yuKjf2I1Hote3nOJ7lG+up/F5dv+6v184jznNCZoQVlezrfFdWOXZ5exVfT2BeN2hRv2yxvXocLuCp2aN5fLuhXfjTN1TLn515EsyoyClYujAiI2AKUnwoJP2f5GclXfvZAwBJGk5AoGAV6gfPx6j+M9oFnP9TFJsWT7xj/ClSyn06ekYwg87eAq31ZwHylcVSUgja2S+fcqY014xCgQg0wL+5jmnIVhDsMOJl4AX0KaXqDWVc+ybCR1xOkqINxUQJkXcZwDBMEEH9YioeNwVTOlVBIfxwm8rfZZ2WS4MYVgWWXtP80xgWzkCgYB2uS34HgaGrbNA+puTa3c4SEQqP5DxJ5D39O+pZAreLCiNc5MoPi+weRO74cKYpVU+vgPNR41zhQ3fLWU596BpIA8oJj5h/YyfL5gBAt8tNsmBltwu4CZF9gqm9UxyBVsUwaAyiol0bkKi5R7JmtdesXexaKo6WMDxpotHx0yiFA==-----END PRIVATE KEY-----' 
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
