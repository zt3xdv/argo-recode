import { ApplicationCommandOptionType, ApplicationCommandType, ApplicationIntegrationType, InteractionContextType, ComponentType, MessageFlags } from "@discordjs/core";
import { getEmoji, formatBoolean, escapeMarkdown } from "../../utils/utils.js";

export default {
  name: "role",
  description: "View the info of a role",
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
      name: "role",
      description: "The role to view",
      type: ApplicationCommandOptionType.Role,
      required: true,
    },
  ],

  async execute({ data: interaction, api }, client) {
    const { role } = getOptions(interaction);
    const colors = Object.entries(role.colors)
      .reverse()
      .filter(([, c]) => c)
      .map(([name, c]) => `#${c.toString(16)} ${name.replace("_color", "")}`)
      .join(", ");
    
    await api.interactions.editReply(interaction.application_id, interaction.token, {
      components: [
        {
          type: ComponentType.Container,
          components: [
            {
              type: ComponentType.TextDisplay,
              content:
                `-# ${getEmoji("roles", client)} **${escapeMarkdown(role.name)}** \`${role.id}\`\n` +
                `\n**Position**: ${role.position}` +
                `\n**Mentionable**: ${formatBoolean(role.mentionable)}` +
                `\n**Managed**: ${formatBoolean(role.managed)}` +
                `\n**Hoisted**: ${formatBoolean(role.hoist)}` +
                `\n\n-# **Colors**: ${colors}`
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
