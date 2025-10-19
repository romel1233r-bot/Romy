const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelType, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// Premium configuration
const config = {
    token: process.env.DISCORD_TOKEN || process.env.BOT_TOKEN,
    guildId: '1406416544451399832',
    adminRole: '1406420130044313772',
    ticketCategory: '1406418069181436017',
    transcriptChannel: '1406761652510134294',
    vouchChannel: '1429250208016896040'
};

// Premium color scheme
const COLORS = {
    PRIMARY: 0x5865F2,
    SUCCESS: 0x57F287,
    WARNING: 0xFEE75C,
    ERROR: 0xED4245,
    PREMIUM: 0xFF73FA,
    DARK: 0x2B2D31
};

const EMOJIS = {
    LIMITEDS: '<:lim:1429231822646018149>',
    DAHOOD: '<:dh:1429232221683712070>',
    SERVICES: '<:discord:1429232874338652260>',
    CHECKMARK: '<:checkmark:1406769918866620416>',
    PREMIUM: '💎',
    SHIELD: '🛡️',
    MONEY: '💰',
    STAR: '⭐'
};

class PremiumDB {
    constructor() {
        this.filePath = path.join(__dirname, 'data', 'tickets.json');
        this.ensureFileExists();
    }

    ensureFileExists() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify({ tickets: {}, counter: 0, settings: {} }));
        }
    }

    read() {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    }

    write(data) {
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    }

    async get(key) {
        const data = this.read();
        return key.split('.').reduce((obj, k) => obj?.[k], data);
    }

    async set(key, value) {
        const data = this.read();
        const keys = key.split('.');
        let obj = data;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        
        obj[keys[keys.length - 1]] = value;
        this.write(data);
    }
}

const db = new PremiumDB();
const client = new Client({
    intents: Object.values(GatewayIntentBits)
});

// Store active components
const vouchSessions = new Map();
const securityMessages = new Map();

// Premium security warning system
async function sendSecurityWarning() {
    try {
        const channel = await client.channels.fetch(config.ticketCategory);
        if (!channel) return;

        // Delete previous security messages
        const previousMessageId = securityMessages.get(channel.id);
        if (previousMessageId) {
            try {
                const previousMessage = await channel.messages.fetch(previousMessageId);
                await previousMessage.delete();
            } catch (error) {
                // Message might already be deleted
            }
        }

        const securityEmbed = new EmbedBuilder()
            .setTitle(`${EMOJIS.SHIELD} **SECURITY ALERT** ${EMOJIS.SHIELD}`)
            .setDescription('**⚠️ IMPORTANT SECURITY NOTICE ⚠️**')
            .addFields(
                {
                    name: '🚫 **STAFF WILL NEVER MESSAGE YOU FIRST**',
                    value: 'After you create a ticket, our staff will __**NEVER**__ message you directly. Do not trust anyone claiming they can help you outside of this ticket system.',
                    inline: false
                },
                {
                    name: '🔍 **WATCH OUT FOR SCAMMERS**',
                    value: 'Do not trust anybody claiming they:\n• "SAW YOUR TICKET"\n• Can "SEE" your ticket\n• Offer "QUICK HELP" in DMs\n\n**These are __SCAMMERS__ trying to steal from you!**',
                    inline: false
                },
                {
                    name: '✅ **LEGITIMATE STAFF**',
                    value: '• Will only respond in your ticket channel\n• Have official staff roles\n• Will never ask for your password\n• Use our official bot system',
                    inline: false
                }
            )
            .setColor(COLORS.WARNING)
            .setThumbnail('https://media.discordapp.net/attachments/1429234159674593352/1429235801782489160/romels_stock_banner1.png')
            .setFooter({ text: 'Romel\'s Stock • Premium Security • Stay Safe', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        const message = await channel.send({ embeds: [securityEmbed] });
        securityMessages.set(channel.id, message.id);
        
    } catch (error) {
        console.error('Error sending security warning:', error);
    }
}

// Premium transcript system with image generation
async function createTranscript(ticketData, messages) {
    try {
        // Create a beautiful transcript embed
        const transcriptEmbed = new EmbedBuilder()
            .setTitle(`📄 Ticket Transcript #${ticketData.number}`)
            .setDescription(`**Service:** ${ticketData.description}\n**Client:** ${ticketData.userTag}\n**Duration:** ${Math.round((new Date(ticketData.closedAt) - new Date(ticketData.createdAt)) / 60000)} minutes`)
            .addFields(
                { name: '🕒 Opened', value: `<t:${Math.floor(new Date(ticketData.createdAt).getTime()/1000)}:F>`, inline: true },
                { name: '🕒 Closed', value: `<t:${Math.floor(new Date(ticketData.closedAt).getTime()/1000)}:F>`, inline: true },
                { name: '🔧 Closed By', value: ticketData.closedBy, inline: true }
            )
            .setColor(COLORS.PREMIUM)
            .setFooter({ text: 'Romel\'s Stock • Premium Transcript', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        // Create formatted text transcript
        let transcriptText = `🎫 ROMEL'S STOCK - TICKET TRANSCRIPT #${ticketData.number}\n`;
        transcriptText += `═`.repeat(50) + '\n\n';
        transcriptText += `Service: ${ticketData.description}\n`;
        transcriptText += `Client: ${ticketData.userTag} (${ticketData.userId})\n`;
        transcriptText += `Opened: ${new Date(ticketData.createdAt).toLocaleString()}\n`;
        transcriptText += `Closed: ${new Date(ticketData.closedAt).toLocaleString()}\n`;
        transcriptText += `Closed By: ${ticketData.closedBy}\n\n`;
        transcriptText += `═`.repeat(50) + '\n\n`;

        // Add messages to transcript
        messages.forEach(msg => {
            const timestamp = new Date(msg.createdTimestamp).toLocaleTimeString();
            transcriptText += `[${timestamp}] ${msg.author.tag}: ${msg.content}\n`;
            if (msg.attachments.size > 0) {
                transcriptText += `📎 Attachments: ${msg.attachments.map(a => a.url).join(', ')}\n`;
            }
        });

        // Send to transcript channel
        const transcriptChannel = await client.channels.fetch(config.transcriptChannel);
        if (transcriptChannel) {
            await transcriptChannel.send({
                embeds: [transcriptEmbed],
                files: [{
                    attachment: Buffer.from(transcriptText, 'utf8'),
                    name: `transcript-${ticketData.number}.txt`
                }]
            });
        }

        return true;
    } catch (error) {
        console.error('Error creating transcript:', error);
        return false;
    }
}

// Premium ticket creation
async function createPremiumTicket(interaction, type, description) {
    try {
        const guild = interaction.guild;
        const member = interaction.member;
        
        // Check for existing tickets
        const userTickets = await db.get(`tickets.${member.id}`) || [];
        const openTicket = userTickets.find(ticket => ticket.open);
        
        if (openTicket) {
            try {
                const channel = await guild.channels.fetch(openTicket.channelId);
                if (channel) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle(`${EMOJIS.ERROR} Already Have Open Ticket`)
                        .setDescription(`You already have an active ticket: ${channel}\n\nPlease close it before creating a new one.`)
                        .setColor(COLORS.ERROR)
                        .setTimestamp();

                    return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            } catch (error) {
                await db.set(`tickets.${member.id}`, []);
            }
        }

        // Premium loading message
        const loadingEmbed = new EmbedBuilder()
            .setTitle(`${EMOJIS.PREMIUM} Creating Premium Ticket...`)
            .setDescription('Setting up your exclusive support channel')
            .setColor(COLORS.PREMIUM)
            .setThumbnail('https://media.discordapp.net/attachments/1429234159674593352/1429235801782489160/romels_stock_banner1.png')
            .setTimestamp();

        await interaction.reply({ embeds: [loadingEmbed], ephemeral: true });

        // Create premium ticket channel
        const ticketNumber = (await db.get('counter') || 0) + 1;
        const ticketChannel = await guild.channels.create({
            name: `🎫・ticket-${ticketNumber}`,
            type: ChannelType.GuildText,
            parent: config.ticketCategory,
            permissionOverwrites: [
                { id: guild.id, deny: [BigInt(0x0000000000000400)] },
                { id: member.id, allow: [BigInt(0x0000000000000400), BigInt(0x0000000000000800)] },
                { id: config.adminRole, allow: [BigInt(0x0000000000000400), BigInt(0x0000000000000800), BigInt(0x0000000000010000)] }
            ]
        });

        // Save premium ticket data
        const ticketData = {
            channelId: ticketChannel.id,
            userId: member.id,
            userTag: member.user.tag,
            type: type,
            description: description,
            open: true,
            createdAt: new Date().toISOString(),
            number: ticketNumber,
            openedBy: member.user.tag
        };
        
        const currentTickets = await db.get(`tickets.${member.id}`) || [];
        currentTickets.push(ticketData);
        await db.set(`tickets.${member.id}`, currentTickets);
        await db.set('counter', ticketNumber);

        // Premium ticket embed
        const ticketEmbed = new EmbedBuilder()
            .setTitle(`${EMOJIS.PREMIUM} Premium Ticket #${ticketNumber}`)
            .setDescription(`**Welcome to your exclusive support channel!**`)
            .addFields(
                { name: `${EMOJIS.MONEY} Service`, value: description, inline: true },
                { name: `${EMOJIS.STAR} Client`, value: `${member}`, inline: true },
                { name: '🕒 Created', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true },
                { name: `${EMOJIS.SHIELD} Security Notice`, value: 'Staff will **NEVER** message you first. Beware of scammers in DMs!', inline: false }
            )
            .setColor(COLORS.PREMIUM)
            .setImage('https://media.discordapp.net/attachments/1429234159674593352/1429235801782489160/romels_stock_banner1.png')
            .setFooter({ text: 'Romel\'s Stock • Premium Service • Stay Safe', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        const ticketButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('add_member')
                    .setLabel('Add Member')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👥')
            );

        await ticketChannel.send({ 
            content: `${member} <@&${config.adminRole}>`,
            embeds: [ticketEmbed], 
            components: [ticketButtons] 
        });

        // Premium success message
        const successEmbed = new EmbedBuilder()
            .setTitle(`${EMOJIS.CHECKMARK} Premium Ticket Created!`)
            .setDescription(`**Channel:** ${ticketChannel}\n**Service:** ${description}\n\nOur premium team will assist you shortly.`)
            .setColor(COLORS.SUCCESS)
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

        return ticketChannel;
    } catch (error) {
        console.error('Error creating premium ticket:', error);
        await interaction.editReply({ 
            content: `${EMOJIS.ERROR} Failed to create premium ticket. Please try again.`, 
            embeds: [] 
        });
    }
}

// Premium vouch system
async function sendPremiumVouchRequest(user, ticketDescription, staffMember) {
    try {
        const vouchEmbed = new EmbedBuilder()
            .setTitle(`${EMOJIS.STAR} How was your premium experience?`)
            .setDescription(`Thank you for choosing **Romel's Stock** for **${ticketDescription}**.\n\nYour feedback helps us maintain our premium service quality.`)
            .addFields(
                { name: `${EMOJIS.MONEY} Service Details`, value: `**Service:** ${ticketDescription}\n**Completed by:** ${staffMember || 'Our Premium Team'}` },
                { name: `${EMOJIS.PREMIUM} Why Rate Us?`, value: 'Your reviews help us improve and maintain our 5-star service quality!' }
            )
            .setColor(COLORS.PREMIUM)
            .setThumbnail('https://media.discordapp.net/attachments/1429234159674593352/1429235801782489160/romels_stock_banner1.png')
            .setFooter({ text: 'Romel\'s Stock • Premium Feedback' })
            .setTimestamp();

        const vouchDropdown = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('vouch_rating')
                    .setPlaceholder('Select your premium rating...')
                    .addOptions([
                        { label: '5 Stars - Exceptional', description: 'Perfect premium experience', value: 'vouch_5', emoji: '💎' },
                        { label: '4 Stars - Excellent', description: 'Great premium service', value: 'vouch_4', emoji: '⭐' },
                        { label: '3 Stars - Very Good', description: 'Good premium service', value: 'vouch_3', emoji: '⭐' },
                        { label: '2 Stars - Good', description: 'Solid service', value: 'vouch_2', emoji: '⭐' },
                        { label: '1 Star - Fair', description: 'Needs improvement', value: 'vouch_1', emoji: '⭐' }
                    ])
            );

        const dm = await user.send({ embeds: [vouchEmbed], components: [vouchDropdown] });
        
        vouchSessions.set(user.id, { ticketDescription, staffMember, messageId: dm.id });
        return true;
    } catch (error) {
        console.log('Could not send premium vouch request:', error);
        return false;
    }
}

// Premium vouch to channel
async function sendPremiumVouchToChannel(user, rating, ticketDescription, comment = '') {
    try {
        const vouchChannel = await client.channels.fetch(config.vouchChannel);
        if (!vouchChannel) return false;
        
        const stars = '💎'.repeat(rating) + '☆'.repeat(5 - rating);
        const ratingColor = rating === 5 ? COLORS.PREMIUM : 
                          rating === 4 ? COLORS.SUCCESS : 
                          rating === 3 ? COLORS.WARNING : 
                          rating === 2 ? 0xE67E22 : COLORS.ERROR;

        const vouchEmbed = new EmbedBuilder()
            .setTitle(`${EMOJIS.STAR} Premium Customer Review`)
            .setDescription(`**Rating:** ${rating}/5 ${stars}\n**Service:** ${ticketDescription}`)
            .addFields(
                { name: '👤 Reviewed By', value: `${user.tag}`, inline: true },
                { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                { name: '🕒 Time', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true }
            )
            .setColor(ratingColor)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setImage('https://media.discordapp.net/attachments/1429234159674593352/1429235801782489160/romels_stock_banner1.png')
            .setFooter({ text: 'Romel\'s Stock • Premium Feedback • Thank You!', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        if (comment.trim() !== '') {
            vouchEmbed.addFields({ name: '💬 Customer Comment', value: comment });
        }

        await vouchChannel.send({ embeds: [vouchEmbed] });
        return true;
    } catch (error) {
        console.log('Could not send premium vouch:', error);
        return false;
    }
}

client.once('ready', () => {
    console.log(`💎 ${client.user.tag} is online! Premium service activated!`);
    client.user.setPresence({
        activities: [{ name: 'discord.gg/romel | Premium Service', type: 3 }],
        status: 'online'
    });

    // Send initial security warning and set up interval
    sendSecurityWarning();
    setInterval(sendSecurityWarning, 50 * 60 * 1000); // Every 50 minutes
});

// Premium interaction handler
client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;

        // Premium ticket type selection
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type') {
            const selected = interaction.values[0];
            
            if (selected === 'limiteds' || selected === 'dahood') {
                const serviceName = selected === 'limiteds' ? 'Limiteds' : 'Dahood Skins';
                const serviceEmoji = selected === 'limiteds' ? EMOJIS.LIMITEDS : EMOJIS.DAHOOD;
                
                const buySellEmbed = new EmbedBuilder()
                    .setTitle(`${serviceEmoji} Premium ${serviceName}`)
                    .setDescription(`Choose your premium transaction type:`)
                    .setColor(COLORS.PREMIUM)
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`buy_sell_${selected}`)
                            .setPlaceholder('Select premium option...')
                            .addOptions([
                                { label: `Buy ${serviceName}`, description: `Purchase premium ${serviceName.toLowerCase()}`, value: `buy_${selected}`, emoji: '💰' },
                                { label: `Sell ${serviceName}`, description: `Sell your premium ${serviceName.toLowerCase()}`, value: `sell_${selected}`, emoji: '💎' }
                            ])
                    );

                await interaction.reply({ embeds: [buySellEmbed], components: [row], ephemeral: true });
            } else if (selected === 'services') {
                await createPremiumTicket(interaction, 'services', `${EMOJIS.SERVICES} Premium Buying Services`);
            }
        }

        // Premium buy/sell selection
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('buy_sell_')) {
            const [action, type] = interaction.values[0].split('_');
            const serviceName = type === 'limiteds' ? 'Limiteds' : 'Dahood Skins';
            const description = `${action === 'buy' ? 'Buying' : 'Selling'} Premium ${serviceName}`;
            
            await createPremiumTicket(interaction, `${action}-${type}`, description);
        }

        // Premium vouch system
        if (interaction.isStringSelectMenu() && interaction.customId === 'vouch_rating') {
            const rating = parseInt(interaction.values[0].split('_')[1]);
            const vouchData = vouchSessions.get(interaction.user.id);
            
            if (vouchData) {
                vouchSessions.set(interaction.user.id, { ...vouchData, rating });
                
                const modal = new ModalBuilder()
                    .setCustomId('vouch_comment_modal')
                    .setTitle('💎 Premium Feedback (Optional)');

                const commentInput = new TextInputBuilder()
                    .setCustomId('vouch_comment')
                    .setLabel('Your premium experience (optional)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(1000)
                    .setPlaceholder('Share your premium experience or suggestions...');

                modal.addComponents(new ActionRowBuilder().addComponents(commentInput));
                await interaction.showModal(modal);
            }
        }

        if (interaction.isModalSubmit() && interaction.customId === 'vouch_comment_modal') {
            const comment = interaction.fields.getTextInputValue('vouch_comment');
            const vouchData = vouchSessions.get(interaction.user.id);
            
            if (vouchData && vouchData.rating) {
                await sendPremiumVouchToChannel(interaction.user, vouchData.rating, vouchData.ticketDescription, comment);
                vouchSessions.delete(interaction.user.id);

                const thankYouEmbed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.CHECKMARK} Thank You for Your Premium Feedback!`)
                    .setDescription('Your review helps us maintain our 5-star service quality!')
                    .setColor(COLORS.SUCCESS)
                    .setTimestamp();

                await interaction.reply({ embeds: [thankYouEmbed], ephemeral: true });
            }
        }

        // Premium close ticket
        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            const closeEmbed = new EmbedBuilder()
                .setTitle(`${EMOJIS.ERROR} Close Premium Ticket`)
                .setDescription('Are you sure you want to close this premium ticket? A feedback request will be sent to the user.')
                .setColor(COLORS.ERROR)
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirm Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                    new ButtonBuilder().setCustomId('cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('❌')
                );

            await interaction.reply({ embeds: [closeEmbed], components: [row], ephemeral: true });
        }

        if (interaction.isButton() && interaction.customId === 'confirm_close') {
            await interaction.deferUpdate();
            
            const data = db.read();
            let currentTicket = null;
            let userId = null;

            for (const uid in data.tickets) {
                const userTickets = data.tickets[uid];
                const ticket = userTickets.find(t => t.channelId === interaction.channel.id && t.open);
                if (ticket) { currentTicket = ticket; userId = uid; break; }
            }
            
            if (currentTicket && userId) {
                // Create transcript before closing
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                await createTranscript(currentTicket, Array.from(messages.values()));
                
                // Send vouch request
                const user = await client.users.fetch(userId);
                await sendPremiumVouchRequest(user, currentTicket.description, interaction.user.tag);

                // Update ticket status
                currentTicket.open = false;
                currentTicket.closedAt = new Date().toISOString();
                currentTicket.closedBy = interaction.user.tag;
                await db.set(`tickets.${userId}`, data.tickets[userId]);

                const closingEmbed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.CHECKMARK} Premium Ticket Closed`)
                    .setDescription(`Closed by ${interaction.user}\n\n• Transcript saved\n• Feedback request sent\n• Channel deleting soon...`)
                    .setColor(COLORS.SUCCESS)
                    .setTimestamp();

                await interaction.channel.send({ embeds: [closingEmbed] });
                
                setTimeout(async () => {
                    try { await interaction.channel.delete(); } 
                    catch (error) { console.log('Error deleting channel:', error); }
                }, 5000);
            } else {
                await interaction.channel.delete();
            }
        }

        if (interaction.isButton() && interaction.customId === 'cancel_close') {
            await interaction.update({ content: `${EMOJIS.CHECKMARK} Ticket closure cancelled.`, components: [] });
        }

    } catch (error) {
        console.error('Premium interaction error:', error);
        try {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${EMOJIS.ERROR} Premium System Error`)
                .setDescription('An error occurred in our premium system. Please try again.')
                .setColor(COLORS.ERROR)
                .setTimestamp();

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [errorEmbed], components: [] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
});

// Premium command handling
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    try {
        // Premium ticket panel
        if (message.content === '!setup-tickets' && message.member.permissions.has('Administrator')) {
            const embed = new EmbedBuilder()
                .setTitle(`${EMOJIS.PREMIUM} Romel's Premium Tickets`)
                .setDescription(`**💎 Exclusive Premium Services 💎**\n\nOpen a premium ticket to access our exclusive stock and services.`)
                .addFields(
                    { name: `${EMOJIS.LIMITEDS} Limiteds`, value: 'Premium limited items marketplace', inline: true },
                    { name: `${EMOJIS.DAHOOD} Dahood Skins`, value: 'Exclusive skin marketplace', inline: true },
                    { name: `${EMOJIS.SERVICES} Services`, value: 'Premium buying services', inline: true },
                    { name: `${EMOJIS.SHIELD} Security`, value: 'Staff will **NEVER** message you first!', inline: false }
                )
                .setColor(COLORS.PREMIUM)
                .setImage('https://media.discordapp.net/attachments/1429234159674593352/1429235801782489160/romels_stock_banner1.png')
                .setFooter({ text: 'Romel\'s Stock • Premium Service • Stay Safe', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ticket_type')
                        .setPlaceholder('💎 Choose premium service...')
                        .addOptions([
                            { label: 'Limiteds', description: 'Premium limited items marketplace', value: 'limiteds', emoji: EMOJIS.LIMITEDS.replace(/[<>]/g, '').split(':')[2] },
                            { label: 'Dahood Skins', description: 'Exclusive skin marketplace', value: 'dahood', emoji: EMOJIS.DAHOOD.replace(/[<>]/g, '').split(':')[2] },
                            { label: 'Buying Services', description: 'Premium buying services', value: 'services', emoji: EMOJIS.SERVICES.replace(/[<>]/g, '').split(':')[2] }
                        ])
                );

            await message.channel.send({ embeds: [embed], components: [row] });
            await message.delete();
        }

        // Premium reset command
        if (message.content === '!reset-tickets' && message.member.roles.cache.has(config.adminRole)) {
            const data = db.read();
            data.tickets = {};
            db.write(data);

            const resetEmbed = new EmbedBuilder()
                .setTitle(`${EMOJIS.CHECKMARK} Premium System Reset`)
                .setDescription('All premium ticket data has been reset successfully.')
                .setColor(COLORS.SUCCESS)
                .setTimestamp();

            await message.reply({ embeds: [resetEmbed] });
        }

    } catch (error) {
        console.error('Premium command error:', error);
    }
});

client.login(config.token);