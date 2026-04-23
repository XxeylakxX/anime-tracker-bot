require("dotenv").config();
const {
  ContainerBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  Client,
  Events,
  GatewayIntentBits
} = require("discord.js");

const axios = require("axios");
const fs = require("fs");

const ANILIST_USERNAME = process.env.ANILIST_USERNAME;
const YOUR_ID = process.env.YOUR_ID;
const DATA_FILE = "./data.json";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Keep-alive server
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive ✅");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Keep-alive server running");
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

// 💾 Data helpers
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      date: "",
      lastEpisode: 0,
      watchedToday: 0,
      lastWatched: null
    }, null, 2));
  }

  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 🔄 Update watch counter
function updateWatchCounter(newEpisode) {
  const data = loadData();
  const today = new Date().toISOString().split("T")[0];

  if (data.date !== today) {
    data.date = today;
    data.lastEpisode = newEpisode;
    data.watchedToday = 0;
  }

  if (newEpisode > data.lastEpisode) {
    data.watchedToday += (newEpisode - data.lastEpisode);
    data.lastWatched = new Date().toISOString();
  }

  data.lastEpisode = newEpisode;
  saveData(data);
  return data;
}

// 🧹 Reset today's counter
function resetTodayCounter() {
  const data = loadData();
  const today = new Date().toISOString().split("T")[0];

  data.date = today;
  data.watchedToday = 0;
  // DO NOT reset lastEpisode or lastWatched

  saveData(data);
  return data;
}

// 🧱 Build UI
function buildContainer(data) {
  const lastWatched = data.lastWatched
    ? new Date(data.lastWatched).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "Never";

  return new ContainerBuilder()
    .setAccentColor(0xffcc00)

    .addTextDisplayComponents(
      (t) => t.setContent("🎌 **Gintama Tracker**")
    )
    .addTextDisplayComponents(
      (t) => t.setContent(`📺 Episode: **${gintamaEpisode}/${gintamaTotal}**`)
    )
    .addTextDisplayComponents(
      (t) => t.setContent(`📊 Watched Today: **${data.watchedToday} episode(s)**`)
    )
    .addTextDisplayComponents(
      (t) => t.setContent(`🕒 Last Watched: **${lastWatched}**`)
    )

    .addActionRowComponents((row) =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("refresh")
          .setLabel("🔄 Refresh")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("reset_today")
          .setLabel("🧹 Reset Today")
          .setStyle(ButtonStyle.Danger)
      )
    );
}

// ✅ Bot ready
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// 🎮 Interaction handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.user.id !== YOUR_ID) return;

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

  if (interaction.isButton()) {
    if (interaction.customId === "refresh") {
      await fetchGintama();
      const data = updateWatchCounter(gintamaEpisode);
      await interaction.update({
        components: [buildContainer(data)],
        flags: MessageFlags.IsComponentsV2
      });
    }

    if (interaction.customId === "reset_today") {
      const data = resetTodayCounter();
      await interaction.update({
        components: [buildContainer(data)],
        flags: MessageFlags.IsComponentsV2
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);