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
function buildContainer(data) {
  return new ContainerBuilder()
    .setAccentColor(0xffcc00)

    .addTextDisplayComponents(
      (t) => t.setContent("🎌 **Gintama Tracker**")
    )

    .addTextDisplayComponents(
      (t) =>
        t.setContent(
          `📺 Episode: **${gintamaEpisode}/${gintamaTotal}**`
        )
    )

    .addTextDisplayComponents(
      (t) =>
        t.setContent(
          `📊 Watched Today: **${data.watchedToday} episode(s)**`
        )
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

      const data = updateWatchCounter(gintamaEpisode);

      await interaction.reply({
        components: [buildContainer(data)],
        flags: MessageFlags.IsComponentsV2
      });
    }
  }

  // Button refresh
  if (interaction.isButton()) {
    if (interaction.customId === "refresh") {
      await fetchGintama();

      const data = updateWatchCounter(gintamaEpisode);

      await interaction.update({
        components: [buildContainer(data)],
        flags: MessageFlags.IsComponentsV2
        });
    }
  }
});

// Date Function
const fs = require("fs");

const DATA_FILE = "./data.json";

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      date: "",
      lastEpisode: 0,
      watchedToday: 0
    }, null, 2));
  }

  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function updateWatchCounter(newEpisode) {
  const data = loadData();

  const today = new Date().toISOString().split("T")[0];

  // reset if new day
  if (data.date !== today) {
    data.date = today;
    data.lastEpisode = newEpisode;
    data.watchedToday = 0;
  }

  // calculate progress difference
  if (newEpisode > data.lastEpisode) {
    data.watchedToday += (newEpisode - data.lastEpisode);
  }

  data.lastEpisode = newEpisode;

  saveData(data);
  return data;
}

client.login(process.env.DISCORD_TOKEN);