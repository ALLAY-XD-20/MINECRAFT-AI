const mineflayer = require('mineflayer');
const fs = require('fs');
const axios = require('axios');

// Load configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

class MinecraftBot {
    constructor() {
        this.bot = null;
        this.isRegistered = false;
        this.currentAIModel = config.defaultAIModel || 'chatgpt';
        this.conversationHistory = [];
    }

    // Create and connect the bot
    async connectBot() {
        console.log(`Connecting to ${config.server.host}:${config.server.port} as ${config.bot.username}`);
        
        this.bot = mineflayer.createBot({
            host: config.server.host,
            port: config.server.port,
            username: config.bot.username,
            version: config.server.version || '1.20.1',
            auth: 'offline' // Use offline mode for most servers
        });

        this.setupEventHandlers();
    }

    // Setup all event handlers
    setupEventHandlers() {
        // Bot spawned successfully
        this.bot.on('spawn', () => {
            console.log('Bot spawned successfully!');
            this.handleAuthentication();
        });

        // Chat messages
        this.bot.on('chat', (username, message) => {
            if (username === this.bot.username) return; // Ignore own messages
            
            console.log(`<${username}> ${message}`);
            this.handleChatMessage(username, message);
        });

        // Whisper messages
        this.bot.on('whisper', (username, message) => {
            console.log(`[WHISPER] ${username}: ${message}`);
            this.handleWhisperMessage(username, message);
        });

        // Error handling
        this.bot.on('error', (err) => {
            console.error('Bot error:', err);
        });

        // Disconnect handling
        this.bot.on('end', () => {
            console.log('Bot disconnected');
            // Reconnect after 5 seconds
            setTimeout(() => {
                console.log('Attempting to reconnect...');
                this.connectBot();
            }, 5000);
        });

        // Login event
        this.bot.on('login', () => {
            console.log('Bot logged in successfully!');
        });
    }

    // Handle authentication (register/login)
    async handleAuthentication() {
        await this.delay(2000); // Wait 2 seconds before authenticating
        
        if (this.isRegistered) {
            // Login if already registered
            console.log('Attempting to login...');
            this.bot.chat(`/login ${config.auth.password}`);
        } else {
            // Register for first time
            console.log('Attempting to register...');
            this.bot.chat(`/register ${config.auth.password} ${config.auth.password}`);
            this.isRegistered = true;
        }
    }

    // Handle chat messages
    async handleChatMessage(username, message) {
        // Check if message is directed at bot
        if (message.toLowerCase().includes(config.bot.username.toLowerCase()) || 
            message.startsWith('!') || 
            message.startsWith('@')) {
            
            // Remove bot name and command prefixes
            let cleanMessage = message
                .replace(new RegExp(config.bot.username, 'gi'), '')
                .replace(/^[@!]/, '')
                .trim();
            
            if (cleanMessage.length > 0) {
                await this.processAIResponse(username, cleanMessage);
            }
        }
    }

    // Handle whisper messages
    async handleWhisperMessage(username, message) {
        // Respond to all whispers with AI
        await this.processAIResponse(username, message, true);
    }

    // Process AI response
    async processAIResponse(username, message, isWhisper = false) {
        try {
            // Check for bot commands
            if (message.toLowerCase().startsWith('switch to ')) {
                const model = message.toLowerCase().replace('switch to ', '').trim();
                if (['chatgpt', 'gemini', 'deepseek'].includes(model)) {
                    this.currentAIModel = model;
                    const response = `Switched to ${model.toUpperCase()} model!`;
                    this.sendResponse(username, response, isWhisper);
                    return;
                }
            }

            // Get AI response
            const aiResponse = await this.getAIResponse(message, username);
            
            // Send response
            this.sendResponse(username, aiResponse, isWhisper);
            
        } catch (error) {
            console.error('Error processing AI response:', error);
            this.sendResponse(username, "Sorry, I'm having trouble thinking right now!", isWhisper);
        }
    }

    // Get response from AI model
    async getAIResponse(message, username) {
        const systemPrompt = `You are a helpful Minecraft bot named ${config.bot.username}. 
        You are playing on a Minecraft server and chatting with players. 
        Keep responses short (under 100 characters) and friendly. 
        You can help with Minecraft questions, chat casually, and be helpful to players.
        Current player: ${username}`;

        switch (this.currentAIModel) {
            case 'chatgpt':
                return await this.getChatGPTResponse(message, systemPrompt);
            case 'gemini':
                return await this.getGeminiResponse(message, systemPrompt);
            case 'deepseek':
                return await this.getDeepseekResponse(message, systemPrompt);
            default:
                return await this.getChatGPTResponse(message, systemPrompt);
        }
    }

    // ChatGPT API
    async getChatGPTResponse(message, systemPrompt) {
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...this.conversationHistory.slice(-5), // Keep last 5 messages
                    { role: 'user', content: message }
                ],
                max_tokens: 100,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${config.aiAPIs.chatgpt}`,
                    'Content-Type': 'application/json'
                }
            });

            const aiResponse = response.data.choices[0].message.content;
            this.updateConversationHistory('user', message);
            this.updateConversationHistory('assistant', aiResponse);
            
            return aiResponse;
        } catch (error) {
            console.error('ChatGPT API error:', error.response?.data || error.message);
            return "Sorry, ChatGPT is not responding right now!";
        }
    }

    // Gemini API
    async getGeminiResponse(message, systemPrompt) {
        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${config.aiAPIs.gemini}`,
                {
                    contents: [{
                        parts: [{
                            text: `${systemPrompt}\n\nUser: ${message}`
                        }]
                    }]
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const aiResponse = response.data.candidates[0].content.parts[0].text;
            this.updateConversationHistory('user', message);
            this.updateConversationHistory('assistant', aiResponse);
            
            return aiResponse;
        } catch (error) {
            console.error('Gemini API error:', error.response?.data || error.message);
            return "Sorry, Gemini is not responding right now!";
        }
    }

    // DeepSeek API
    async getDeepseekResponse(message, systemPrompt) {
        try {
            const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...this.conversationHistory.slice(-5),
                    { role: 'user', content: message }
                ],
                max_tokens: 100,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${config.aiAPIs.deepseek}`,
                    'Content-Type': 'application/json'
                }
            });

            const aiResponse = response.data.choices[0].message.content;
            this.updateConversationHistory('user', message);
            this.updateConversationHistory('assistant', aiResponse);
            
            return aiResponse;
        } catch (error) {
            console.error('DeepSeek API error:', error.response?.data || error.message);
            return "Sorry, DeepSeek is not responding right now!";
        }
    }

    // Update conversation history
    updateConversationHistory(role, content) {
        this.conversationHistory.push({ role, content });
        
        // Keep only last 10 messages to prevent token overflow
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }
    }

    // Send response (chat or whisper)
    sendResponse(username, message, isWhisper = false) {
        // Split long messages
        const maxLength = 100;
        if (message.length > maxLength) {
            const parts = message.match(new RegExp(`.{1,${maxLength}}`, 'g'));
            parts.forEach((part, index) => {
                setTimeout(() => {
                    if (isWhisper) {
                        this.bot.whisper(username, part);
                    } else {
                        this.bot.chat(`@${username} ${part}`);
                    }
                }, index * 1000);
            });
        } else {
            if (isWhisper) {
                this.bot.whisper(username, message);
            } else {
                this.bot.chat(`@${username} ${message}`);
            }
        }
    }

    // Utility delay function
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Bot commands
    setupBotCommands() {
        // Initialize bot properties
        this.followTarget = null;
        this.homeLocation = null;
        this.baseLocation = null;
        this.teamMembers = new Set();
        this.isFollowing = false;
        this.searchingFor = null;

        // Add custom commands here
        this.bot.on('chat', (username, message) => {
            if (username === this.bot.username) return;
            
            const args = message.toLowerCase().split(' ');
            const command = args[0];
            
            // Help command
            if (command === '!help') {
                this.bot.chat('Available commands: !help, !ping, !time, !players, !follow <player>, !sethome, !base, !team <player>, !find <structure>, !stop, !home, !switch to [ai_model]');
            }
            
            // Ping command
            if (command === '!ping') {
                this.bot.chat(`Pong! Using ${this.currentAIModel.toUpperCase()} model`);
            }
            
            // Time command
            if (command === '!time') {
                const time = new Date().toLocaleString();
                this.bot.chat(`Current time: ${time}`);
            }
            
            // Players command
            if (command === '!players') {
                const players = Object.keys(this.bot.players).join(', ');
                this.bot.chat(`Online players: ${players}`);
            }
            
            // Follow command
            if (command === '!follow' && args.length > 1) {
                const targetName = args[1];
                this.followPlayer(targetName, username);
            }
            
            // Stop following
            if (command === '!stop') {
                this.stopFollowing(username);
            }
            
            // Set home command
            if (command === '!sethome') {
                this.setHome(username);
            }
            
            // Go home command
            if (command === '!home') {
                this.goHome(username);
            }
            
            // Set base command
            if (command === '!base') {
                this.setBase(username);
            }
            
            // Team command
            if (command === '!team' && args.length > 1) {
                const playerName = args[1];
                this.addToTeam(playerName, username);
            }
            
            // Find command
            if (command === '!find' && args.length > 1) {
                const structure = args.slice(1).join(' ');
                this.findStructure(structure, username);
            }
            
            // List team members
            if (command === '!teamlist') {
                this.listTeamMembers(username);
            }
            
            // Remove from team
            if (command === '!removeteam' && args.length > 1) {
                const playerName = args[1];
                this.removeFromTeam(playerName, username);
            }
        });
        
        // Set up movement and pathfinding
        this.setupMovement();
    }

    // Follow player functionality
    followPlayer(targetName, requester) {
        const target = this.bot.players[targetName];
        if (!target) {
            this.bot.chat(`Player ${targetName} not found!`);
            return;
        }
        
        this.followTarget = targetName;
        this.isFollowing = true;
        this.bot.chat(`Now following ${targetName}!`);
        
        // Start following loop
        this.startFollowLoop();
    }
    
    // Stop following
    stopFollowing(requester) {
        this.isFollowing = false;
        this.followTarget = null;
        this.bot.pathfinder.setGoal(null);
        this.bot.chat('Stopped following.');
    }
    
    // Follow loop
    startFollowLoop() {
        const followInterval = setInterval(() => {
            if (!this.isFollowing || !this.followTarget) {
                clearInterval(followInterval);
                return;
            }
            
            const target = this.bot.players[this.followTarget];
            if (!target || !target.entity) {
                this.bot.chat(`Lost sight of ${this.followTarget}!`);
                this.stopFollowing();
                clearInterval(followInterval);
                return;
            }
            
            const distance = this.bot.entity.position.distanceTo(target.entity.position);
            if (distance > 3) {
                // Use pathfinder if available, otherwise simple movement
                if (this.bot.pathfinder) {
                    const { goals } = require('mineflayer-pathfinder');
                    const goal = new goals.GoalNear(target.entity.position.x, target.entity.position.y, target.entity.position.z, 2);
                    this.bot.pathfinder.setGoal(goal);
                } else {
                    this.bot.lookAt(target.entity.position);
                    this.bot.setControlState('forward', true);
                    setTimeout(() => {
                        this.bot.setControlState('forward', false);
                    }, 1000);
                }
            }
        }, 1000);
    }
    
    // Set home location
    setHome(requester) {
        this.homeLocation = {
            x: Math.floor(this.bot.entity.position.x),
            y: Math.floor(this.bot.entity.position.y),
            z: Math.floor(this.bot.entity.position.z),
            dimension: this.bot.game.dimension
        };
        
        this.bot.chat(`Home set at coordinates: ${this.homeLocation.x}, ${this.homeLocation.y}, ${this.homeLocation.z}`);
    }
    
    // Go to home
    goHome(requester) {
        if (!this.homeLocation) {
            this.bot.chat('No home location set! Use !sethome first.');
            return;
        }
        
        this.bot.chat(`Going home to ${this.homeLocation.x}, ${this.homeLocation.y}, ${this.homeLocation.z}`);
        this.navigateToLocation(this.homeLocation);
    }
    
    // Set base location
    setBase(requester) {
        this.baseLocation = {
            x: Math.floor(this.bot.entity.position.x),
            y: Math.floor(this.bot.entity.position.y),
            z: Math.floor(this.bot.entity.position.z),
            dimension: this.bot.game.dimension
        };
        
        this.bot.chat(`Base set at coordinates: ${this.baseLocation.x}, ${this.baseLocation.y}, ${this.baseLocation.z}`);
    }
    
    // Add player to team
    addToTeam(playerName, requester) {
        if (this.bot.players[playerName]) {
            this.teamMembers.add(playerName);
            this.bot.chat(`${playerName} added to team! Team size: ${this.teamMembers.size}`);
        } else {
            this.bot.chat(`Player ${playerName} not found!`);
        }
    }
    
    // Remove player from team
    removeFromTeam(playerName, requester) {
        if (this.teamMembers.has(playerName)) {
            this.teamMembers.delete(playerName);
            this.bot.chat(`${playerName} removed from team! Team size: ${this.teamMembers.size}`);
        } else {
            this.bot.chat(`${playerName} is not in the team!`);
        }
    }
    
    // List team members
    listTeamMembers(requester) {
        if (this.teamMembers.size === 0) {
            this.bot.chat('No team members yet!');
        } else {
            const members = Array.from(this.teamMembers).join(', ');
            this.bot.chat(`Team members: ${members}`);
        }
    }
    
    // Find structure
    findStructure(structure, requester) {
        this.bot.chat(`Searching for ${structure}...`);
        this.searchingFor = structure;
        
        // Simple structure finding logic
        const structures = {
            'village': this.findNearbyVillage.bind(this),
            'cave': this.findNearbyMine.bind(this),
            'mine': this.findNearbyMine.bind(this),
            'water': this.findNearbyWater.bind(this),
            'lava': this.findNearbyLava.bind(this),
            'tree': this.findNearbyTrees.bind(this),
            'stone': this.findNearbyStone.bind(this),
            'iron': this.findNearbyOre.bind(this, 'iron_ore'),
            'coal': this.findNearbyOre.bind(this, 'coal_ore'),
            'diamond': this.findNearbyOre.bind(this, 'diamond_ore')
        };
        
        const searchFunction = structures[structure.toLowerCase()];
        if (searchFunction) {
            searchFunction();
        } else {
            this.bot.chat(`Don't know how to find ${structure}. Available: village, cave, mine, water, lava, tree, stone, iron, coal, diamond`);
        }
    }
    
    // Find nearby village
    findNearbyVillage() {
        const villager = this.bot.nearestEntity(entity => {
            return entity.name === 'villager' && entity.position.distanceTo(this.bot.entity.position) < 100;
        });
        
        if (villager) {
            this.bot.chat(`Found villager at ${Math.floor(villager.position.x)}, ${Math.floor(villager.position.y)}, ${Math.floor(villager.position.z)}!`);
            this.navigateToLocation(villager.position);
        } else {
            this.bot.chat('No village found nearby. Let me explore...');
            this.exploreRandomly();
        }
    }
    
    // Find nearby mine/cave
    findNearbyMine() {
        const caveBlocks = this.bot.findBlocks({
            matching: ['cave_air', 'air'],
            maxDistance: 50,
            count: 10
        });
        
        if (caveBlocks.length > 0) {
            const cave = caveBlocks[0];
            this.bot.chat(`Found cave entrance at ${cave.x}, ${cave.y}, ${cave.z}!`);
            this.navigateToLocation(cave);
        } else {
            this.bot.chat('No caves found nearby. Exploring...');
            this.exploreRandomly();
        }
    }
    
    // Find nearby water
    findNearbyWater() {
        const waterBlocks = this.bot.findBlocks({
            matching: ['water'],
            maxDistance: 100,
            count: 1
        });
        
        if (waterBlocks.length > 0) {
            const water = waterBlocks[0];
            this.bot.chat(`Found water at ${water.x}, ${water.y}, ${water.z}!`);
            this.navigateToLocation(water);
        } else {
            this.bot.chat('No water found nearby.');
        }
    }
    
    // Find nearby lava
    findNearbyLava() {
        const lavaBlocks = this.bot.findBlocks({
            matching: ['lava'],
            maxDistance: 100,
            count: 1
        });
        
        if (lavaBlocks.length > 0) {
            const lava = lavaBlocks[0];
            this.bot.chat(`Found lava at ${lava.x}, ${lava.y}, ${lava.z}! Be careful!`);
            this.navigateToLocation(lava);
        } else {
            this.bot.chat('No lava found nearby.');
        }
    }
    
    // Find nearby trees
    findNearbyTrees() {
        const treeBlocks = this.bot.findBlocks({
            matching: (block) => block.name.includes('log') || block.name.includes('wood'),
            maxDistance: 50,
            count: 1
        });
        
        if (treeBlocks.length > 0) {
            const tree = treeBlocks[0];
            this.bot.chat(`Found trees at ${tree.x}, ${tree.y}, ${tree.z}!`);
            this.navigateToLocation(tree);
        } else {
            this.bot.chat('No trees found nearby.');
        }
    }
    
    // Find nearby stone
    findNearbyStone() {
        const stoneBlocks = this.bot.findBlocks({
            matching: ['stone', 'cobblestone'],
            maxDistance: 30,
            count: 1
        });
        
        if (stoneBlocks.length > 0) {
            const stone = stoneBlocks[0];
            this.bot.chat(`Found stone at ${stone.x}, ${stone.y}, ${stone.z}!`);
            this.navigateToLocation(stone);
        } else {
            this.bot.chat('No stone found nearby.');
        }
    }
    
    // Find nearby ore
    findNearbyOre(oreType) {
        const oreBlocks = this.bot.findBlocks({
            matching: [oreType],
            maxDistance: 50,
            count: 1
        });
        
        if (oreBlocks.length > 0) {
            const ore = oreBlocks[0];
            this.bot.chat(`Found ${oreType} at ${ore.x}, ${ore.y}, ${ore.z}!`);
            this.navigateToLocation(ore);
        } else {
            this.bot.chat(`No ${oreType} found nearby.`);
        }
    }
    
    // Navigate to location
    navigateToLocation(location) {
        if (this.bot.pathfinder) {
            const { goals } = require('mineflayer-pathfinder');
            const goal = new goals.GoalNear(location.x, location.y, location.z, 1);
            this.bot.pathfinder.setGoal(goal);
        } else {
            // Simple navigation without pathfinder
            this.bot.lookAt(location);
            this.bot.chat(`Heading to ${Math.floor(location.x)}, ${Math.floor(location.y)}, ${Math.floor(location.z)}...`);
        }
    }
    
    // Explore randomly
    exploreRandomly() {
        const randomX = this.bot.entity.position.x + (Math.random() - 0.5) * 100;
        const randomZ = this.bot.entity.position.z + (Math.random() - 0.5) * 100;
        const randomY = this.bot.entity.position.y;
        
        this.bot.chat('Exploring randomly...');
        this.navigateToLocation({ x: randomX, y: randomY, z: randomZ });
    }
    
    // Setup movement capabilities
    setupMovement() {
        // Try to load pathfinder plugin
        try {
            const pathfinder = require('mineflayer-pathfinder').pathfinder;
            const Movements = require('mineflayer-pathfinder').Movements;
            
            this.bot.loadPlugin(pathfinder);
            const defaultMove = new Movements(this.bot);
            this.bot.pathfinder.setMovements(defaultMove);
            
            console.log('Pathfinder plugin loaded successfully!');
        } catch (error) {
            console.log('Pathfinder plugin not available, using basic movement');
        }
    }

    // Start the bot
    async start() {
        console.log('Starting Minecraft AI Bot...');
        console.log(`Bot Name: ${config.bot.username}`);
        console.log(`Server: ${config.server.host}:${config.server.port}`);
        console.log(`Default AI Model: ${this.currentAIModel}`);
        
        await this.connectBot();
        this.setupBotCommands();
    }
}

// Create and start the bot
const bot = new MinecraftBot();
bot.start().catch(console.error);

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down bot...');
    if (bot.bot) {
        bot.bot.quit();
    }
    process.exit(0);
});