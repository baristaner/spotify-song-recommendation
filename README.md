
# Spotify Song Recommendation

A song recommendation system using nodejs and spotify api based on the users spotify data


## Features

- Imports the required packages/modules: Express, Axios, SpotifyWebApi, Cors, SwaggerJsDoc, and SwaggerUi.
- Sets up Swagger documentation for the API endpoints, using the swagger-jsdoc and swagger-ui-express packages.
- Initializes the SpotifyWebApi with the necessary client ID, client secret, and redirect URI.
- Calculates average values for certain audio features of the user's top tracks, and then uses those values to generate a set of recommended tracks.
- Defines two helper functions: 'calculateAverage' and 'calculatePopularGenres'. 'calculateAverage' computes the average value of a given feature for a set of tracks, while 'calculatePopularGenres' identifies the most popular genres of a user's saved tracks.
- Starts the Express app on a specified port, with CORS enabled.



  
## Screenshots

![Swagger](https://raw.githubusercontent.com/baristaner/spotify-song-recommendation/master/assets/swagger.jpg)

  
## API Usage

#### Login With Spotify Account

```http
  GET /login
```


####  Creates a playlist with recommended songs by your accounts top 5 tracks and audio features 

```http
  GET /recommendation/bytopsongs
```

#### Creates a playlist by your top artists and genres
```http
  GET /recommendation/byartistandgenre
```

#### Creates a playlist by your last played 5 songs
```http
  GET /recommendation/byrecentlyplayed
```


  
## Environment Variables
To run this project you have to add these variables to your .env file


`CLIENT_ID`

`CLIENT_SECRET`

`REDIRECT_URI`

`PORT`



  
## Installation 


```bash 
  npm install
```
    
```bash 
  npm run devStart
```    


## Demo Playlist

https://open.spotify.com/playlist/6oeVHOTnNE5NhSHqyJcKnq?si=e1e7b33a59c84854
  
