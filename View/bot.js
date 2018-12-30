const Discord = require('discord.js');
const Model = require('../Model/max.js');
var fs = require('fs');
const secret = JSON.parse(fs.readFileSync("./View/secret.json", { encoding: 'utf8' }));

const client = new Discord.Client();

client.on('ready', () => {
  console.log(`${client.user.tag} is up and running!`);
});

client.on('message', msg => {
  if (msg.content[0] === '!') {
    var args = msg.content.split(" ");
    var command = args[0];

    if(command == '!max') {
			// check to make sure a username was provided
			if(args.length >= 2) {
				// concatenate the username args
				var name = "";
				for(var i = 1; i < args.length; i++) {
					name += args[i];
					if(i != args.length-1) name += " ";
				}
					// get the character data from runemetric api endpoint and calc exp to max.
					Model.calcExpToMax(name).then(function(exp) {
						msg.channel.send(name + ' has ' + exp.toLocaleString() + ' exp left to max.');
					}).catch( rej => {
						msg.channel.send('Invalid username.');
					});
			} else {
				msg.reply('Please provide the username you wish to check.');
			}
    }
  }
});

client.login(secret.token);