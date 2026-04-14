require("dotenv").config();
const {
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  Client,
  Events,
  GatewayIntentBits
} = require("discord.js");

const axios = require("axios");

const ANILIST_USERNAME = process.env.ANILIST_USERNAME;
const YOUR_ID = process.env.YOUR_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let gintamaEpisode = 0;
let gintamaTotal = "?";

// 🔌 Fetch AniList data
async function fetchGintama() {
  const query = `
    query ($name: String) {
      MediaListCollection(userName: $name, type: ANIME) {
        lists {
          entries {
            media {
              title { romaji }
              episodes
            }
            progress
          }
        }
      }
    }
  `;

  const res = await axios.post("https://graphql.anilist.co", {
    query,
    variables: { name: ANILIST_USERNAME }
  });

  const lists = res.data.data.MediaListCollection.lists;

  for (const list of lists) {
    for (const entry of list.entries) {
      const title = entry.media.title.romaji.toLowerCase();

      if (title.includes("gintama")) {
        gintamaEpisode = entry.progress;
        gintamaTotal = entry.media.episodes || "?";
      }
    }
  }
}

// 🧱 Build UI with ContainerBuilder
function buildContainer() {
  return new ContainerBuilder()
    .setAccentColor(0xffcc00)

    .addTextDisplayComponents(
      (t) => t.setContent("🎌 **Gintama Tracker**"),
      (t) => t.setContent(`📺 Episode: **${gintamaEpisode}/${gintamaTotal}**`)
    )

    .addActionRowComponents((row) =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("refresh")
          .setLabel("🔄 Refresh")
          .setStyle(ButtonStyle.Primary)
      )
    );
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// 🎮 Interaction handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.user.id !== YOUR_ID) return;

  // Slash command: /panel
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "panel") {
      await fetchGintama();

      await interaction.reply({
        components: [buildContainer()],
        flags: MessageFlags.IsComponentsV2
        });
    }
  }

  // Button refresh
  if (interaction.isButton()) {
    if (interaction.customId === "refresh") {
      await fetchGintama();

      await interaction.update({
        components: [buildContainer()],
        flags: MessageFlags.IsComponentsV2
        });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);