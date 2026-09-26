import { ApplicationCommandOptionType, ApplicationCommandType, ComponentType, MessageFlags } from "@discordjs/core";
import { getEmoji, formatRate, getOptions } from "../../utils/utils.js";
import { currencies } from "../../utils/currencies.js";

export default {
  name: "convert",
  description: "Convert an amount from one currency to another",
  type: ApplicationCommandType.ChatInput,
  defer: true,
  options: [
    {
      name: "amount",
      description: "The amount to convert",
      type: ApplicationCommandOptionType.Number,
      required: true,
      min_value: 0.01,
      max_value: 1_000_000_000,
    },
    {
      name: "from",
      description: "The source currency",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true,
    },
    {
      name: "to",
      description: "The target currency",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true,
    },
  ],

  async autocomplete({ data: interaction, api }) {
    const focusedOption = interaction.data.options?.find((option) => option.focused);
    const focusedValue = String(focusedOption?.value ?? "").toLowerCase();

    const choices = currencies.filter((currency) => `${currency.name} ${currency.value}`.toLowerCase().includes(focusedValue)).slice(0, 25);

    await api.interactions.createAutocompleteResponse(interaction.id, interaction.token, { choices });
  },

  async execute({ data: interaction, api }, client) {
    const { amount: amountOption, from: fromOption, to: toOption } = getOptions(interaction);

    const amount = Number(amountOption);
    const from = String(fromOption ?? "").toUpperCase();
    const to = String(toOption?? "").toUpperCase();

    if (!Number.isFinite(amount) || amount <= 0 || !from || !to) {
      await client.api.interactions.editReply(interaction.application_id, interaction.token, {
        components: [
          {
            type: ComponentType.TextDisplay,
            content: `-# ${getEmoji("exclamation", client)} You must provide a valid amount and two currencies.`,
          },
        ],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    if (from === to) {
      await client.api.interactions.editReply(interaction.application_id, interaction.token, {
        components: [
          {
            type: ComponentType.TextDisplay,
            content: `-# ${getEmoji("exclamation", client)} You must provide two different currencies.`,
          },
        ],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    const res = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || `Exchange API returned ${res.status}`);
    }

    const rate = data.rate;
    const convertedAmount = amount * rate;

    await api.interactions.editReply(interaction.application_id, interaction.token, {
      components: [
        {
          type: ComponentType.Container,
          components: [
            {
              type: ComponentType.TextDisplay,
              content:
                `-# ${getEmoji("loop", client)} from **${amount.toFixed(2)} ${from}** to **${convertedAmount.toFixed(2)} ${to}**\n` +
                `**Covertion rate**: 1 ${from} = ${formatRate(rate)} ${to}`,
            },
          ],
        },
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
