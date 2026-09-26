import { ComponentType, MessageFlags, ApplicationCommandOptionType, Routes } from '@discordjs/core';
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const assetsDir = path.resolve(import.meta.dirname, "../assets");

export const mimeTypes = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
};

export function getEmoji(name, client) {
  const emoji = client.emojis.items.find(e => e.name == name);
  return emoji ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>` : ":e:";
}

export function formatDiscordDate(date) {
  if (!date) return null;
  const timestamp = Math.floor(Date.parse(date) / 1000);
  if (Number.isNaN(timestamp)) return null;
  return `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
}

export function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function getGuildAssetUrl(type, guildId, hash, size = 1024) {
  if (!hash) return null;

  const extension = hash.startsWith("a_") ? "gif" : "png";

  return `https://cdn.discordapp.com/${type}/${guildId}/${hash}.${extension}?size=${size}`;
}

export async function fetchImage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  return {
    mimeType: response.headers.get("content-type") ?? "image/png",
    base64: Buffer.from(await response.arrayBuffer()).toString("base64"),
  };
}

export function getSnowflakeDate(id) {
  const timestamp = Number(BigInt(id) >> 22n) + 1420070400000;

  return new Date(timestamp).toISOString();
}

export function formatBoolean(bool) {
  return bool ? "yes" : "no";
}

export function escapeMarkdown(text) {
  return text.replace(/[\\`*_{}\[\]()#+\-.!|>~=]/g, "\\$&");
}

export async function getAsset(relativePath, asBase64 = false) {
  const assetPath = path.resolve(assetsDir, relativePath);

  if (!assetPath.startsWith(`${assetsDir}${path.sep}`)) {
    throw new Error("Invalid asset path");
  }

  const file = await fs.readFile(assetPath);

  if (!asBase64) {
    return file;
  }

  const extension = path.extname(assetPath).toLowerCase();
  const mimeType = mimeTypes[extension];

  if (!mimeType) {
    throw new Error(`Unsupported asset type: ${extension}`);
  }

  return `data:${mimeType};base64,${file.toString("base64")}`;
}

export function hasFlag(flags, flag) {
  if (!flags) {
    return false;
  }

  return (
    (BigInt(flags) & BigInt(flag)) === BigInt(flag)
  );
}

export function truncate(value, length) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

// some workaround to rewrite api
export function addMessage(api, message) {
  const originalReply = api.interactions.reply;
  const originalEditReply = api.interactions.editReply;

  const add = data => {
    if (hasFlag(data.flags, MessageFlags.IsComponentsV2)) {
      const components = data.components ?? [];

      if (!components.some(component => component.type === ComponentType.TextDisplay && component.content === message)) {
        components.unshift({
          type: ComponentType.TextDisplay,
          content: message
        });
      }

      return { ...data, components };
    }

    return {
      ...data,
      content: `${data.content ?? ''}\n\n${message}`.trim()
    };
  };
  
  api.interactions.reply = (id, token, data) => originalReply.call(api.interactions, id, token, add(data));
  api.interactions.editReply = (id, token, data) => originalEditReply.call(api.interactions, id, token, add(data));

  return () => {
    api.interactions.reply = originalReply;
    api.interactions.editReply = originalEditReply;
  };
}

export async function getRestLatency(rest) {
  const start = performance.now()
  await rest.get(Routes.gateway())
  return Math.round(performance.now() - start)
}

export function verifyWebhook(rawBody, signatureHeader, secret) {
  if (!signatureHeader || typeof signatureHeader !== "string") {
    return false;
  }

  const timestampMatch = signatureHeader.match(/(?:^|,)t=([^,]+)/);
  const signatureMatch = signatureHeader.match(/(?:^|,)v1=([^,]+)/);

  if (!timestampMatch || !signatureMatch) {
    return false;
  }

  const timestamp = timestampMatch[1];
  const receivedSignature = signatureMatch[1];

  if (
    !/^\d+$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/i.test(receivedSignature)
  ) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const receivedBuffer = Buffer.from(receivedSignature, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatRate(rate) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(rate);
}

export function getOptions(interaction) {
  const { data } = interaction;
  const resolved = data.resolved ?? {};

  const resolve = (option) => {
    const id = option.value;
    switch (option.type) {
      case ApplicationCommandOptionType.User:
        return { user: resolved.users?.[id], member: resolved.members?.[id] };

      case ApplicationCommandOptionType.Channel:
        return resolved.channels?.[id] ?? id;

      case ApplicationCommandOptionType.Role:
        return resolved.roles?.[id] ?? id;

      case ApplicationCommandOptionType.Mentionable:
        return resolved.users?.[id] ? { user: resolved.users[id], member: resolved.members?.[id] } : resolved.roles?.[id] ?? id;

      case ApplicationCommandOptionType.Attachment:
        return resolved.attachments?.[id] ?? id;

      default:
        return option.value;
    }
  };

  const options = (data.options ?? []).flatMap((option) => option.options ?? [option]).filter((option) => !option.options);
  const result = Object.fromEntries(options.map((option) => [option.name, resolve(option)]));

  if (data.target_id) {
    const id = data.target_id;

    result.target = resolved.users?.[id] ? { user: resolved.users[id], member: resolved.members?.[id] } : resolved.roles?.[id] ?? resolved.messages?.[id] ?? id;
  }

  return result;
}
