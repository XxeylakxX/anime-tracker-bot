const axios = require("axios");

const API_URL = "https://graphql.anilist.co";

async function getUserAnime(username) {
  const query = `
    query ($name: String) {
      MediaListCollection(userName: $name, type: ANIME) {
        lists {
          entries {
            media {
              title {
                romaji
              }
            }
            progress
            status
          }
        }
      }
    }
  `;

  const response = await axios.post(API_URL, {
    query,
    variables: { name: username }
  });

  return response.data.data.MediaListCollection.lists;
}

module.exports = { getUserAnime };