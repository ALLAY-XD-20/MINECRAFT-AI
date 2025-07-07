# Minecraft AI Bot

A Minecraft bot that can connect to servers, handle authentication, and chat with players using AI models (ChatGPT, Gemini, DeepSeek).

## Features

- **Auto Authentication**: Automatically registers on first join (`/register PAWAN500 PAWAN500`) and logs in on subsequent joins (`/login PAWAN500`)
- **Multi-AI Support**: Uses ChatGPT, Gemini, and DeepSeek APIs for intelligent responses
- **Smart Chat**: Responds to messages mentioning the bot name or starting with `!` or `@`
- **Whisper Support**: Responds to private messages
- **Bot Commands**: Built-in commands like `!help`, `!ping`, `!time`, `!players`
- **Auto Reconnect**: Automatically reconnects if disconnected
- **Configurable**: Easy configuration through `config.json`

## Setup Instructions

### 1. Install Node.js
Make sure you have Node.js installed (version 16 or higher).

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure the Bot
Edit `config.json` to set:
- **Bot username**: Change `"username": "PAWAN500"` to your desired bot name
- **Server details**: Update `host` and `port` for your Minecraft server
- **Password**: Set the password for registration/login
- **AI API Keys**: Your API keys are already configured

### 4. Server IP Examples
You can use any Minecraft server IP in the config:
```json
{
  "server": {
    "host": "aternos.me",     // or "12.4.1.38" or any other IP
    "port": 25565,
    "version": "1.20.1"
  }
}
```

### 5. Run the Bot
```bash
npm start
```

## How It Works

### Authentication Flow
1. **First Join**: Bot sends `/register PAWAN500 PAWAN500`
2. **Subsequent Joins**: Bot sends `/login PAWAN500`
3. **Auto-detection**: Bot remembers registration status

### AI Chat Integration
- **Trigger Methods**:
  - Mention bot name: `PAWAN500 hello there`
  - Use `!` prefix: `!what's the weather like?`
  - Use `@` prefix: `@tell me a joke`
  - Whisper directly to the bot

- **AI Model Switching**:
  - `!switch to chatgpt` - Switch to ChatGPT
  - `!switch to gemini` - Switch to Gemini
  - `!switch to deepseek` - Switch to DeepSeek

### Built-in Commands
- `!help` - Show available commands
- `!ping` - Check if bot is responsive
- `!time` - Show current time
- `!players` - List online players

## Configuration Options

### config.json Structure
```json
{
  "bot": {
    "username": "PAWAN500"              // Bot's Minecraft username
  },
  "server": {
    "host": "aternos.me",               // Server IP/hostname
    "port": 25565,                      // Server port
    "version": "1.20.1"                 // Minecraft version
  },
  "auth": {
    "password": "PAWAN500"              // Password for /register and /login
  },
  "aiAPIs": {
    "chatgpt": "sk-proj-...",           // OpenAI API key
    "gemini": "AIzaSy...",              // Google Gemini API key
    "deepseek": "sk-028..."             // DeepSeek API key
  },
  "defaultAIModel": "chatgpt",          // Default AI model to use
  "settings": {
    "autoReconnect": true,              // Auto-reconnect on disconnect
    "reconnectDelay": 5000,             // Delay before reconnecting (ms)
    "maxMessageLength": 100,            // Max chat message length
    "conversationHistoryLimit": 10,     // Chat history to keep
    "responseDelay": 1000               // Delay between responses (ms)
  }
}
```

## Troubleshooting

### Common Issues

1. **Bot won't connect**:
   - Check server IP and port
   - Verify server is online
   - Check if server allows offline-mode connections

2. **Authentication fails**:
   - Some servers may have different auth commands
   - Check server documentation for correct registration format

3. **AI not responding**:
   - Verify API keys are correct
   - Check internet connection
   - Monitor console for API errors

4. **Bot gets kicked**:
   - Some servers have anti-bot measures
   - Try using a different username
   - Check server rules about bots

### Server Compatibility

The bot works with most Minecraft servers that support:
- Offline mode authentication
- Text-based registration systems
- Standard chat formatting

### API Rate Limits

Be aware of API rate limits:
- **ChatGPT**: 3 requests per minute (free tier)
- **Gemini**: 60 requests per minute
- **DeepSeek**: Varies by plan

## Advanced Usage

### Custom Commands
Add custom commands by modifying the `setupBotCommands()` method in `index.js`.

### Multiple Bots
Create multiple config files and run multiple instances:
```bash
node index.js config1.json
node index.js config2.json
```

### Logging
The bot logs all activities to console. For persistent logging, consider adding a logging library like Winston.

## Security Notes

- Keep your API keys secure
- Don't share your config.json file
- Use environment variables for sensitive data in production
- Be mindful of server rules regarding bots

## License

MIT License - feel free to modify and distribute!
