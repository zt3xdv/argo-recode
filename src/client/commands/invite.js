import { ApplicationCommandOptionType, ApplicationCommandType, ApplicationIntegrationType, InteractionContextType, ComponentType, MessageFlags } from "@discordjs/core";
import { getEmoji, formatDiscordDate, escapeMarkdown, getOptions } from "../../utils/utils.js";
import Server from "./server.js";

export default {
  name: "invite",
  description: "View the info of a invite link",
  integrationTypes: [
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  ],
  contexts: [
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  ],
  type: ApplicationCommandType.ChatInput,
  defer: true,
  options: [
    {
      name: "link",
      description: "Link of the invite to view",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async execute({ data: interaction, api }, client) {
    const { link } = getOptions(interaction);
    const code = link.match(/(?:discord(?:app)?\.com\/invite|discord\.gg)\/([^/?#]+)/i)?.[1] ?? null;
    
    if (!code) {
      return api.interactions.editReply(interaction.application_id, interaction.token, {
        components: [
          {
            type: ComponentType.TextDisplay,
            content: `-# ${getEmoji("exclamation", client)} I couldn't get any invite code from this link.`,
          },
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }
    
    let data;
    
    try {
      data = await client.api.invites.get(code, { with_counts: true });
    } catch(e) { /* invalid or unknown invite */ }
    
    if (!data || !data.guild) {
      return api.interactions.editReply(interaction.application_id, interaction.token, {
        components: [
          {
            type: ComponentType.TextDisplay,
            content: `-# ${getEmoji("exclamation", client)} This invite seems invalid.`,
          },
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }
    
    const server = await Server.execute({ data: interaction, api }, client, {
      customGuildData: {
        ...data.profile,
        ...data.guild
      },
      shouldReturn: true
    });
    
    await api.interactions.editReply(interaction.application_id, interaction.token, {
      files: server.files,
      components: [
        ...([server.components[0]]),
        {
          type: ComponentType.Container,
          components: [
            ...server.components[1].components,
            {
              type: ComponentType.TextDisplay,
              content:
                `-# ${getEmoji("invite", client)} **Invite Code**: ${code}\n` +
                (data.inviter ? `-# ${getEmoji("person", client)} **Inviter**: **${escapeMarkdown(data.inviter.global_name)}** @${escapeMarkdown(data.inviter.username)}${data.inviter.discriminator != 0 ? "#" + data.inviter.discriminator : ""} \`${data.inviter.id}\`\n` : "") +
                (data.expires_at ? `-# ${getEmoji("calendar", client)} **Expires at**: ${formatDiscordDate(data.expires_at)}` : "")
            },
          ],
        },
      ],
      allowed_mentions: {
        parse: []
      },
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
