import 'dotenv/config';
import { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    PermissionFlagsBits, 
    ChannelType,
    SlashCommandBuilder,
    REST,
    Routes
} from 'discord.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;
const CLIENT_ID = '1548519490357170240';

interface Partido {
    rival: string;
    fecha: string;
    condicion: string;
}

const partidosDB: Partido[] = [];

// Manejo de errores globales para evitar caídas
process.on('unhandledRejection', (error) => {
    console.error('Error no capturado:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Excepción no capturada:', error);
});

// === REGISTRO DE COMANDOS SLASH ===
const commands = [
    new SlashCommandBuilder()
        .setName('partido')
        .setDescription('Programa un nuevo partido')
        .addStringOption(option => 
            option.setName('rival')
                .setDescription('Nombre del equipo rival')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('fecha')
                .setDescription('Fecha y hora del partido')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('condicion')
                .setDescription('¿Local o Visitante?')
                .setRequired(false)
                .addChoices(
                    { name: 'Local (Dragones FC)', value: 'Local: Dragones FC' },
                    { name: 'Visitante', value: 'Visitante: Dragones FC' }
                )),

    new SlashCommandBuilder()
        .setName('partidos')
        .setDescription('Muestra el calendario de partidos'),

    new SlashCommandBuilder()
        .setName('borrar-partido')
        .setDescription('Elimina un partido del calendario por su número')
        .addIntegerOption(option =>
            option.setName('numero')
                .setDescription('Número de partido a eliminar (ej. 1 para el Partido #1)')
                .setRequired(true)
                .setMinValue(1)),

    new SlashCommandBuilder()
        .setName('resultado')
        .setDescription('Publica el resultado de un partido')
        .addIntegerOption(option =>
            option.setName('goles_dragones')
                .setDescription('Goles anotados por Dragones FC')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('rival')
                .setDescription('Nombre del equipo rival')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('goles_rival')
                .setDescription('Goles anotados por el rival')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('notas')
                .setDescription('Detalles o goleadores del partido (opcional)')
                .setRequired(false))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN || '');

client.once('ready', async () => {
    console.log(`🐉 Bot de Dragones FC listo como ${client.user?.tag}`);

    try {
        console.log('Actualizando comandos slash en Discord...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        console.log('¡ComandosSlash actualizados correctamente!');
    } catch (error) {
        console.error('Error registrando comandos:', error);
    }
});

// === BIENVENIDA AUTOMÁTICA ===
client.on('guildMemberAdd', async (member) => {
    try {
        const welcomeChannel = member.guild.channels.cache.find(c => 
            c.name.includes('bienvenida') || c.name.includes('𝔹𝕚𝕖𝕟𝕧𝕖𝕟𝕚𝕕𝕒')
        );

        if (!welcomeChannel || !welcomeChannel.isTextBased()) return;

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`${member.user.username} Bienvenido al equipo Dragones FC pasatelo bien!`)
            .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
            .setColor('#D90429');

        if (member.guild.iconURL()) {
            welcomeEmbed.setFooter({ text: `BIENVENID@ ${member.user.tag}`, iconURL: member.guild.iconURL()! });
        }

        await welcomeChannel.send({
            content: `¡Bienvenid@ ${member} a **Dragones FC**!\n\nUn nuevo reto comienza con pasión, esfuerzo y trabajo en equipo. ¡A dejarlo todo en la cancha y a representar estos colores con orgullo!`,
            embeds: [welcomeEmbed]
        });
    } catch (e) {
        console.error('Error en bienvenida:', e);
    }
});

// === PANEL DE TICKETS (!setup-dragones) ===
client.on('messageCreate', async (message) => {
    if (message.content === '!setup-dragones') {
        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

        const ticketEmbed = new EmbedBuilder()
            .setTitle('Click below to create a new support ticket 🎟️')
            .setDescription('Sistema de tickets para responderle lo más rápido posible a nuestros jugadores.')
            .setColor('#E63946');

        if (message.guild?.iconURL()) {
            ticketEmbed.setAuthor({ name: 'Dragones FC | Support & Store', iconURL: message.guild.iconURL()! });
        }

        const ticketButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_preguntas')
                .setLabel('Preguntas')
                .setEmoji('📝')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('ticket_rol')
                .setLabel('Exigir rol')
                .setEmoji('🤛')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ticket_media')
                .setLabel('Creador de contenido')
                .setEmoji('📲')
                .setStyle(ButtonStyle.Secondary)
        );

        await message.channel.send({ embeds: [ticketEmbed], components: [ticketButtons] });
    }
});

// === MANEJO DE INTERACCIONES ===
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            const guildIcon = interaction.guild?.iconURL();

            // /partido
            if (commandName === 'partido') {
                const rival = interaction.options.getString('rival', true);
                const fecha = interaction.options.getString('fecha', true);
                const condicion = interaction.options.getString('condicion') || 'Local: Dragones FC';

                partidosDB.push({ rival, fecha, condicion });

                const partidoEmbed = new EmbedBuilder()
                    .setTitle('⚽ ¡NUEVO PARTIDO PROGRAMADO! ⚽')
                    .setDescription('**Dragones FC** tiene un nuevo enfrentamiento.')
                    .addFields(
                        { name: '🔴 Local', value: condicion, inline: true },
                        { name: '🔵 Rival', value: rival, inline: true },
                        { name: '📅 Fecha / Hora', value: fecha, inline: false }
                    )
                    .setColor(0xFFB703)
                    .setTimestamp();

                if (guildIcon) partidoEmbed.setThumbnail(guildIcon);

                return await interaction.reply({ embeds: [partidoEmbed] });
            }

            // /partidos
            if (commandName === 'partidos') {
                if (partidosDB.length === 0) {
                    return await interaction.reply({ content: '📅 No hay partidos programados actualmente para Dragones FC.', ephemeral: true });
                }

                const listaEmbed = new EmbedBuilder()
                    .setTitle('📅 CALENDARIO DE PARTIDOS - DRAGONES FC')
                    .setColor(0xE63946);

                if (guildIcon) listaEmbed.setThumbnail(guildIcon);

                partidosDB.forEach((p, index) => {
                    listaEmbed.addFields({
                        name: `Partido #${index + 1}: Dragones FC vs ${p.rival}`,
                        value: `• **Fecha:** ${p.fecha}\n• **Condición:** ${p.condicion}`
                    });
                });

                return await interaction.reply({ embeds: [listaEmbed] });
            }

            // /borrar-partido (NUEVO COMANDO)
            if (commandName === 'borrar-partido') {
                const numero = interaction.options.getInteger('numero', true);
                const index = numero - 1;

                if (index < 0 || index >= partidosDB.length) {
                    return await interaction.reply({ 
                        content: `❌ No existe el Partido #${numero}. Usa \`/partidos\` para ver la lista actual (hay ${partidosDB.length} partido(s) disponible(s)).`, 
                        ephemeral: true 
                    });
                }

                const partidoEliminado = partidosDB.splice(index, 1)[0];

                return await interaction.reply({
                    content: `🗑️ **Partido #${numero} eliminado correctamente:** Dragones FC vs ${partidoEliminado.rival} (${partidoEliminado.fecha}).`
                });
            }

            // /resultado
            if (commandName === 'resultado') {
                const golesDragones = interaction.options.getInteger('goles_dragones', true);
                const rival = interaction.options.getString('rival', true);
                const golesRival = interaction.options.getInteger('goles_rival', true);
                const notas = interaction.options.getString('notas');

                let colorEmbed = 0x2EC4B6;
                let estadoTexto = '🤝 EMPATE';

                if (golesDragones > golesRival) {
                    colorEmbed = 0x38B000;
                    estadoTexto = '🔥 ¡VICTORIA DE DRAGONES FC!';
                } else if (golesDragones < golesRival) {
                    colorEmbed = 0xD90429;
                    estadoTexto = '❌ DERROTA';
                }

                const resultadoEmbed = new EmbedBuilder()
                    .setTitle('🏆 RESULTADO FINAL DEL PARTIDO')
                    .setDescription(`**${estadoTexto}**`)
                    .addFields(
                        { name: '🐉 Dragones FC', value: `${golesDragones}`, inline: true },
                        { name: 'VS', value: '⚡', inline: true },
                        { name: `🛡️ ${rival}`, value: `${golesRival}`, inline: true }
                    )
                    .setColor(colorEmbed)
                    .setTimestamp();

                if (guildIcon) resultadoEmbed.setThumbnail(guildIcon);

                if (notas) {
                    resultadoEmbed.addFields({ name: '📝 Comentarios / Anotadores', value: notas, inline: false });
                }

                return await interaction.reply({ embeds: [resultadoEmbed] });
            }
        }

        // --- BOTONES Y TICKETS ---
        if (interaction.isButton()) {
            if (['ticket_preguntas', 'ticket_rol', 'ticket_media'].includes(interaction.customId)) {
                let tipoTicket = 'Soporte';
                if (interaction.customId === 'ticket_rol') tipoTicket = 'TIENDA / ROL';
                if (interaction.customId === 'ticket_media') tipoTicket = 'CREADOR DE CONTENIDO';

                const modal = new ModalBuilder()
                    .setCustomId(`modal_${interaction.customId}`)
                    .setTitle(`Ticket: ${tipoTicket}`);

                const nickInput = new TextInputBuilder()
                    .setCustomId('nick')
                    .setLabel('Nick')
                    .setPlaceholder('Tu usuario de Roblox')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const productoInput = new TextInputBuilder()
                    .setCustomId('producto')
                    .setLabel('Producto que quieres comprar')
                    .setPlaceholder('Ej: Pase VIP, Rol Jugador, Fichaje Dragones FC')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const pagoInput = new TextInputBuilder()
                    .setCustomId('pago')
                    .setLabel('Método de pago')
                    .setPlaceholder('Ej: Robux / Gamepass / MercadoPago')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const detallesInput = new TextInputBuilder()
                    .setCustomId('detalles')
                    .setLabel('Detalles de la compra')
                    .setPlaceholder('Escribe detalles o dudas adicionales...')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(nickInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(productoInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(pagoInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(detallesInput)
                );

                await interaction.showModal(modal);
            }

            if (interaction.customId === 'claim_ticket') {
                const embedOriginal = interaction.message.embeds[0];
                const updatedEmbed = EmbedBuilder.from(embedOriginal)
                    .setFields(
                        embedOriginal.fields.filter(f => f.name !== 'Estado del Staff'),
                        { name: 'Estado del Staff', value: `🟢 Reclamado por ${interaction.user}` }
                    );

                await interaction.update({ embeds: [updatedEmbed] });
                await interaction.followUp({ content: `✅ **${interaction.user.tag}** ha reclamado este ticket.`, ephemeral: false });
            }

            if (interaction.customId === 'close_ticket') {
                const channel = interaction.channel;
                if (!channel || !('messages' in channel)) return;

                await interaction.reply('🔒 Guardando transcript y cerrando ticket...');

                const transcriptChannel = interaction.guild?.channels.cache.find(c => c.name === 'transcripts');

                if (transcriptChannel && transcriptChannel.isTextBased()) {
                    const fetchMessages = await channel.messages.fetch({ limit: 100 });
                    let transcriptText = `=== TRANSCRIPT DEL TICKET: ${(channel as any).name} ===\n`;
                    transcriptText += `Cerrado por: ${interaction.user.tag}\nFecha: ${new Date().toUTCString()}\n\n`;

                    fetchMessages.reverse().forEach(m => {
                        transcriptText += `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}\n`;
                    });

                    const buffer = Buffer.from(transcriptText, 'utf-8');

                    const transcriptEmbed = new EmbedBuilder()
                        .setTitle('🔒 Ticket Cerrado - Dragones FC')
                        .setDescription(`El ticket \`${(channel as any).name}\` ha sido cerrado.`)
                        .setColor(0xD90429)
                        .setTimestamp();

                    await transcriptChannel.send({
                        content: `📂 **Transcript del ticket:** \`${(channel as any).name}\``,
                        embeds: [transcriptEmbed],
                        files: [{ attachment: buffer, name: `transcript-${(channel as any).name}.txt` }]
                    });
                }

                setTimeout(() => (channel as any).delete(), 2000);
            }
        }

        // --- SUBMIT DEL MODAL DE TICKETS ---
        if (interaction.isModalSubmit()) {
            const nick = interaction.fields.getTextInputValue('nick');
            const producto = interaction.fields.getTextInputValue('producto');
            const pago = interaction.fields.getTextInputValue('pago');
            const detalles = interaction.fields.getTextInputValue('detalles');

            const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9]/g, '');

            if (!interaction.guild) return;

            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle('🐉 Ticket de Dragones FC')
                .setDescription(`Ticket abierto por <@${interaction.user.id}>`)
                .addFields(
                    { name: 'Estado del Staff', value: '🟡 No reclamado' },
                    { name: 'Nick', value: nick },
                    { name: 'Producto que quieres comprar', value: producto },
                    { name: 'Método de pago', value: pago },
                    { name: 'Detalles de la compra', value: detalles }
                )
                .setColor(0xFFB703)
                .setTimestamp();

            const controlButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('Reclamar Ticket')
                    .setEmoji('🙋‍♂️')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Cerrar Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({
                content: `¡Ticket creado con éxito <@${interaction.user.id}>! Un miembro del staff te atenderá pronto.`,
                embeds: [ticketEmbed],
                components: [controlButtons]
            });

            await interaction.reply({ content: `✅ Ticket creado en ${ticketChannel}`, ephemeral: true });
        }
    } catch (err) {
        console.error('Error procesando interacción:', err);
    }
});

client.login(TOKEN);
  
