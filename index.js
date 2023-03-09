const express = require('express');
const axios = require('axios');
const SpotifyWebApi = require('spotify-web-api-node');
const cors = require('cors');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4001

app.use(cors());

const swaggerOptions = {
  swaggerDefinition:{
    info:{
      title:'Spotify Song Recommendation',
      description:'A song recommendation system using nodejs and spotify api based on the users spotify data',
      contact:{
        name:'baristaner'
      },
      servers:['http://localhost:4000']
    }
  },
  apis:['index.js']
}

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/docs',swaggerUi.serve,swaggerUi.setup(swaggerDocs));



const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI
});




/**
 * @swagger
 * /login:
 *  get:
 *     description: Login using your spotify account
 *     responses:
 *      '200':
 *       description: Success
 */


app.get('/login', (req, res) => {
  const scopes = ['user-read-private', 'user-read-email', 'user-read-recently-played','user-top-read','playlist-modify-public','playlist-modify-private'];   
  const state = 'some-state-of-my-choice';

  const authorizeUrl = spotifyApi.createAuthorizeURL(scopes, state);
  res.redirect(authorizeUrl);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
  
    try {
      const { data } = await axios({
        url: 'https://accounts.spotify.com/api/token',
        method: 'post',
        data: {
          code,
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost:4000/callback',
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${spotifyApi.getClientId()}:${spotifyApi.getClientSecret()}`
          ).toString('base64')}`,
        },
      });
  
      spotifyApi.setAccessToken(data.access_token);
      spotifyApi.setRefreshToken(data.refresh_token);
      
  
      res.redirect('/');
    } catch (error) {
      console.error(error);
      res.send('Error');
    }
  });


  app.get('/', async (req, res) => {
    res.json("For docs go to localhost:4000/docs");
  });


function calculateAverage(features, feature) {
  const values = features.map((f) => f[feature]);
  if (values.length === 0) {
    throw new Error("Cannot calculate average of empty array");
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

function calculatePopularGenres(genres, numGenres) {

  if (!genres || genres.length === 0 || numGenres <= 0) {
    return [];
  }
  
  const genreCounts = {};
  genres.forEach((genre) => {
    if (genre in genreCounts) {
      genreCounts[genre]++;
    } else {
      genreCounts[genre] = 1;
    }
  });
  
  const sortedGenres = Object.keys(genreCounts).sort((a, b) => {
    return genreCounts[b] - genreCounts[a];
  });
  
  const popularGenres = sortedGenres.slice(0, numGenres);
  
  return popularGenres;
}

/**
 * @swagger
 * /recommendation/bytopsongs:
 *  get:
 *     description: Creates a playlist with recommended songs by your account top 5 Tracks and audio features
 *     responses:
 *      '200':
 *       description: Success
 */

app.get('/recommendation/bytopsongs', async (req, res) => {
    try {

      // Get the values of user's music taste
      const topTracks = await spotifyApi.getMyTopTracks({time_range: 'long_term', limit: 5});
      const trackIds = topTracks.body.items.map((item) => item.id);
      const { body: audioFeatures } = await spotifyApi.getAudioFeaturesForTracks(trackIds);
      const features = audioFeatures.audio_features;
      
      // Basically each audio feature is ranked by 0.0 - 1.0 calculateAverage() function compares the features.
      const targetAudioFeatures = {
        danceability: calculateAverage(features, 'danceability'),
        energy: calculateAverage(features, 'energy'),
        valence: calculateAverage(features, 'valence'),
        instrumentalness: calculateAverage(features, 'instrumentalness'),
        acousticness: calculateAverage(features, 'acousticness'),
        liveness: calculateAverage(features, 'liveness')
      };
      

      const targetGenresAndFeatures = {
        audioFeatures: targetAudioFeatures
      };
      
      // Make a recommendation

      const { body: recommendations } = await spotifyApi.getRecommendations({
        min_energy: targetAudioFeatures.energy,
        min_danceability: targetAudioFeatures.danceability,
        min_valence: targetAudioFeatures.valence,
        min_instrumentalness: targetAudioFeatures.instrumentalness,
        max_acousticness: targetAudioFeatures.acousticness,
        max_liveness: targetAudioFeatures.liveness,
        seed_tracks: trackIds,
        min_popularity: 40, // if it's more than 40,more popular songs will be on your playlist however there is a chance that spotify api will return empty array
        limit: 15 // How many songs do you want in your playlist? 
      });

      
      
  // Format Songs
  const formattedRecommendations = await Promise.all(recommendations.tracks.map(async (track) => {
    try {
      const { body: trackData } = await spotifyApi.getTrack(track.id);
      const { body: albumData } = await spotifyApi.getAlbum(trackData.album.id);
      const { body: artistData } = await spotifyApi.getArtist(trackData.artists[0].id);

      return {
        uri: trackData.uri,
        artist: artistData.name,
        album: albumData.name,
        track: trackData.name
      };
    } catch (err) {
      console.log('Error while getting track details:', err);
      return null;
    }
  }));

  // Clear Null Values
  const filteredRecommendations = formattedRecommendations.filter((item) => item !== null);

  // Add songs to playlist
  const playlistName = 'algorithm or should i say algo-rhytm?'; // Name of the playlist

  const playlistDescription = 'https://github.com/baristaner'; // Playlist description


  const { body: currentUserProfile } = await spotifyApi.getMe();
  const playlistsResponse = await spotifyApi.getUserPlaylists(currentUserProfile.id);
  const existingPlaylist = playlistsResponse.body.items.find((playlist) => playlist.name === playlistName);

  let playlistId;
  if (existingPlaylist) {
    playlistId = existingPlaylist.id;
    } else {
      const { body: createdPlaylist } = await spotifyApi.createPlaylist(currentUserProfile.id, {
       name: playlistName,
      description: playlistDescription
  });
  playlistId = createdPlaylist.id;
}

const uris = filteredRecommendations.map((track) => track.uri);
await spotifyApi.addTracksToPlaylist(playlistId, uris);

res.send(filteredRecommendations);
} catch (err) {
    console.log("Something went wrong!", err);
    res.status(500).send(err);
}
})

/**
 * @swagger
 * /recommendation/byartistandgenre:
 *  get:
 *     description: Creates a playlist by your top artists and genres
 *     responses:
 *      '200':
 *       description: Success
 */

// recommendation by top artists and genre
app.get('/recommendation/byartistandgenre', async (req, res) => {
  try {

    // Get the values of user's music taste
    const topTracks = await spotifyApi.getMyTopTracks({time_range: 'short_term', limit: 5});
    const trackIds = topTracks.body.items.map((item) => item.id);
    const { body: audioFeatures } = await spotifyApi.getAudioFeaturesForTracks(trackIds);
    const features = audioFeatures.audio_features;
    
    // Kullanıcının en sevdiği sanatçıların özelliklerini de hesaba kat
    const topArtists = await spotifyApi.getMyTopArtists({time_range: 'medium_term', limit: 2});
    const artistIds = topArtists.body.items.map((item) => item.id);
    const { body: artistGenres } = await spotifyApi.getArtists(artistIds);
    const genres = artistGenres.artists.flatMap((artist) => artist.genres);
    const targetGenres = calculatePopularGenres(genres, 3);
    
    
    const targetAudioFeatures = {
      danceability: calculateAverage(features, 'danceability'),
      energy: calculateAverage(features, 'energy'),
      valence: calculateAverage(features, 'valence'),
      instrumentalness: calculateAverage(features, 'instrumentalness'),
      acousticness: calculateAverage(features, 'acousticness'),
      liveness: calculateAverage(features, 'liveness')
    };
    

    const targetGenresAndFeatures = {
      genres: targetGenres,
      audioFeatures: targetAudioFeatures
    };
    
    // Make a recommendation

    const { body: recommendations } = await spotifyApi.getRecommendations({
      min_energy: targetAudioFeatures.energy,
      min_danceability: targetAudioFeatures.danceability,
      min_valence: targetAudioFeatures.valence,
      min_instrumentalness: targetAudioFeatures.instrumentalness,
      max_acousticness: targetAudioFeatures.acousticness,
      max_liveness: targetAudioFeatures.liveness,
      seed_artists: artistIds,
      seed_genres: targetGenres,
      //seed_tracks: trackIds,
      min_popularity: 20,
      limit: 15
    });

    
    
    // Format Songs
const formattedRecommendations = await Promise.all(recommendations.tracks.map(async (track) => {
  try {
    const { body: trackData } = await spotifyApi.getTrack(track.id);
    const { body: albumData } = await spotifyApi.getAlbum(trackData.album.id);
    const { body: artistData } = await spotifyApi.getArtist(trackData.artists[0].id);

    return {
      uri: trackData.uri,
      artist: artistData.name,
      album: albumData.name,
      track: trackData.name
    };
  } catch (err) {
    console.log('Error while getting track details:', err);
    return null;
  }
}));

// Clear Null Values
const filteredRecommendations = formattedRecommendations.filter((item) => item !== null);

// Add songs to playlist
const playlistName = 'algorithm or should i say algo-rhytm?'; // Name of the playlist

const playlistDescription = 'https://github.com/baristaner'; // Playlist description


const { body: currentUserProfile } = await spotifyApi.getMe();
  const playlistsResponse = await spotifyApi.getUserPlaylists(currentUserProfile.id);
  const existingPlaylist = playlistsResponse.body.items.find((playlist) => playlist.name === playlistName);

  let playlistId;
  if (existingPlaylist) {
    playlistId = existingPlaylist.id;
    } else {
      const { body: createdPlaylist } = await spotifyApi.createPlaylist(currentUserProfile.id, {
       name: playlistName,
      description: playlistDescription
  });
  playlistId = createdPlaylist.id;
}

const uris = filteredRecommendations.map((track) => track.uri);
await spotifyApi.addTracksToPlaylist(playlistId, uris);

res.send(filteredRecommendations);
} catch (err) {
  console.log("Something went wrong!", err);
  res.status(500).send(err);
}
})

/**
 * @swagger
 * /recommendation/byrecentlyplayed:
 *  get:
 *     description: Creates a playlist by your last played 5 songs
 *     responses:
 *      '200':
 *       description: Success
 */
app.get('/recommendation/byrecentlyplayed', async (req, res) => {
  try {
    // Take user's recently played 5 tracks spotify doesn't allow more than 5 i reckon
    const { body: recentlyPlayed } = await spotifyApi.getMyRecentlyPlayedTracks({ limit: 5  });
    const trackIds = recentlyPlayed.items.map((item) => item.track.id);
    const { body: audioFeatures } = await spotifyApi.getAudioFeaturesForTracks(trackIds);
    const features = audioFeatures.audio_features;

    const targetAudioFeatures = {
      danceability: calculateAverage(features, 'danceability'),
      energy: calculateAverage(features, 'energy'),
      valence: calculateAverage(features, 'valence'),
      instrumentalness: calculateAverage(features, 'instrumentalness'),
      acousticness: calculateAverage(features, 'acousticness'),
      liveness: calculateAverage(features, 'liveness')
    };

    const targetGenresAndFeatures = {
      audioFeatures: targetAudioFeatures
    };

    // Make a recommendation

    const { body: recommendations } = await spotifyApi.getRecommendations({
      min_energy: targetAudioFeatures.energy,
      min_danceability: targetAudioFeatures.danceability,
      min_valence: targetAudioFeatures.valence,
      min_instrumentalness: targetAudioFeatures.instrumentalness,
      max_acousticness: targetAudioFeatures.acousticness,
      max_liveness: targetAudioFeatures.liveness,
      seed_tracks: trackIds,
      min_popularity: 40,
      limit: 15
    });

    // Format Songs
    const formattedRecommendations = await Promise.all(recommendations.tracks.map(async (track) => {
      try {
        const { body: trackData } = await spotifyApi.getTrack(track.id);
        const { body: albumData } = await spotifyApi.getAlbum(trackData.album.id);
        const { body: artistData } = await spotifyApi.getArtist(trackData.artists[0].id);

        return {
          uri: trackData.uri,
          artist: artistData.name,
          album: albumData.name,
          track: trackData.name
        };
      } catch (err) {
        console.log('Error while getting track details:', err);
        return null;
      }
    }));

    // Clear Null Values
    const filteredRecommendations = formattedRecommendations.filter((item) => item !== null);

    // Add songs to playlist
    const playlistName = 'algorithm or should i say algo-rhytm?'; // Name of the playlist

    const playlistDescription = 'https://github.com/baristaner'; // Playlist description


    const { body: currentUserProfile } = await spotifyApi.getMe();
    const playlistsResponse = await spotifyApi.getUserPlaylists(currentUserProfile.id);
    const existingPlaylist = playlistsResponse.body.items.find((playlist) => playlist.name === playlistName);

    let playlistId;
    if (existingPlaylist) {
      playlistId = existingPlaylist.id;
    } else {
      const { body: createdPlaylist } = await spotifyApi.createPlaylist(currentUserProfile.id, {
        name: playlistName,
        description: playlistDescription
      });
      playlistId = createdPlaylist.id;
    }

    const uris = filteredRecommendations.map((track) => track.uri);
    await spotifyApi.addTracksToPlaylist(playlistId, uris);

    res.send(filteredRecommendations);
} catch (err) {
  console.log("Something went wrong!", err);
  res.status(500).send(err);
}
})
  
app.listen(PORT, () => {
  console.log(`Server is running on : ${PORT}`);
});
