// TMDB Service Module
// Handles live data fetching from TMDB endpoints, API keys, and fallbacks.

import { ALL_MOVIES } from "./data.js?v=2";

export function isValidMovie(movie) {
  return movie && 
         typeof movie.title === "string" && movie.title.trim() !== "" &&
         typeof movie.overview === "string" && movie.overview.trim() !== "" &&
         typeof movie.poster_path === "string" && movie.poster_path.trim() !== "" &&
         typeof movie.backdrop_path === "string" && movie.backdrop_path.trim() !== "" &&
         typeof movie.youtube_id === "string" && movie.youtube_id.trim() !== "" &&
         movie.youtube_id !== "Way9Dexny3w" &&
         movie.vote_average !== undefined && movie.vote_average !== null &&
         movie.rating !== undefined && movie.rating !== null;
}

export function supplementMovies(movies, count = 12) {
  let validMovies = movies.filter(isValidMovie);
  if (validMovies.length >= count) {
    return validMovies.slice(0, count);
  }
  const cachedValid = ALL_MOVIES.filter(isValidMovie);
  for (const m of cachedValid) {
    if (validMovies.length >= count) break;
    if (!validMovies.some(v => v.id === m.id)) {
      validMovies.push(m);
    }
  }
  return validMovies;
}

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

// Retrieve TMDB Key from localStorage
export function getApiKey() {
  return localStorage.getItem("epicscreen_tmdb_key") || "04c35731a5ee918f014970082a0088b1";
}

// Save TMDB Key to localStorage
export function saveApiKey(key) {
  if (key) {
    localStorage.setItem("epicscreen_tmdb_key", key.trim());
  } else {
    localStorage.removeItem("epicscreen_tmdb_key");
  }
}

// General fetch function using the TMDB API key
async function fetchFromTMDB(endpoint, params = {}) {
  const key = getApiKey();
  if (!key) {
    throw new Error("No TMDB API Key available. Falling back to cached library.");
  }

  const queryParams = new URLSearchParams({
    api_key: key,
    ...params
  });

  const url = `${TMDB_API_BASE}${endpoint}?${queryParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB API request failed with status ${response.status}`);
  }
  return await response.json();
}

// Convert a TMDB API movie object to our rich EpicScreen schema
function mapToEpicScreenMovie(movie, videoId = "Way9Dexny3w") {
  return {
    id: movie.id,
    title: movie.title || movie.original_title,
    overview: movie.overview || "No synopsis available for this epic title.",
    poster_path: movie.poster_path ? `${IMAGE_BASE_URL}/w500${movie.poster_path}` : null,
    backdrop_path: movie.backdrop_path ? `${IMAGE_BASE_URL}/original${movie.backdrop_path}` : null,
    vote_average: movie.vote_average ? movie.vote_average.toFixed(1) : "7.0",
    release_date: movie.release_date || "2024-01-01",
    runtime: movie.runtime || 120,
    genres: movie.genre_ids ? getGenreNames(movie.genre_ids) : ["Cinema"],
    languages: movie.original_language ? [movie.original_language.toUpperCase()] : ["EN"],
    subtitles: ["English", "Hindi", "Spanish"],
    youtube_id: videoId,
    director: "Acclaimed Director",
    cast: ["Premium Star Cast"],
    awards: movie.vote_average >= 8 ? "Critics Choice Gold Badge" : "Trending Blockbuster",
    quality: "4K UHD • Dolby Vision • Atmos",
    categories: [],
    rating: movie.adult ? "R" : "PG-13"
  };
}

// Helper to convert genre IDs to strings
function getGenreNames(ids) {
  const genresMap = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
    27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
    10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
  };
  return ids.map(id => genresMap[id] || "Cinema");
}

// Fetch video/trailer ID from TMDB
async function fetchMovieTrailer(movieId) {
  try {
    const data = await fetchFromTMDB(`/movie/${movieId}/videos`);
    if (data.results && data.results.length > 0) {
      // Prioritize official YouTube trailer
      const trailer = data.results.find(v => v.type === "Trailer" && v.site === "YouTube") || data.results[0];
      return trailer ? trailer.key : null;
    }
  } catch (e) {
    console.warn(`Could not fetch trailer for movie ID ${movieId}:`, e);
  }
  return null;
}

// Fetch list of movies by endpoint and category filter
export async function getMovies(category, page = 1) {
  const hasKey = getApiKey();
  if (!hasKey) {
    // Return filtered cached data
    return getCachedMoviesByCategory(category);
  }

  try {
    let endpoint = "/movie/popular";
    let params = { page };

    // Map EpicScreen premium categories to TMDB API searches/endpoints
    if (category === "spotlight") {
      endpoint = "/movie/now_playing";
    } else if (category === "todayObsession") {
      endpoint = "/trending/movie/day";
    } else if (category === "criticsChoice") {
      endpoint = "/movie/top_rated";
    } else if (category === "awardWinners") {
      endpoint = "/movie/top_rated";
      params.page = 2; // Grab a different page for variety
    } else if (category === "indianBlockbusters") {
      // Query specifically for Indian language movies
      endpoint = "/discover/movie";
      params.with_original_language = "hi|te|ta";
      params.sort_by = "popularity.desc";
    } else if (category === "animeUniverse") {
      // Query anime / animation genre (16) and Japanese language (ja)
      endpoint = "/discover/movie";
      params.with_genres = "16";
      params.with_original_language = "ja";
      params.sort_by = "popularity.desc";
    } else if (category === "epicOriginals") {
      // Sci-fi genre (878)
      endpoint = "/discover/movie";
      params.with_genres = "878";
      params.sort_by = "popularity.desc";
    } else if (category === "horrorNights") {
      // Horror (27)
      endpoint = "/discover/movie";
      params.with_genres = "27";
    } else if (category === "romantic") {
      // Romance (10749)
      endpoint = "/discover/movie";
      params.with_genres = "10749";
    } else if (category === "musicalHits") {
      // Music (10402)
      endpoint = "/discover/movie";
      params.with_genres = "10402";
    } else if (category === "familyTime") {
      // Family (10751)
      endpoint = "/discover/movie";
      params.with_genres = "10751";
    }

    const data = await fetchFromTMDB(endpoint, params);
    const results = data.results || [];
    
    // Map with dynamic trailer fetch, filtering out movies without trailers
    const mapped = results.slice(0, 15).map(m => mapToEpicScreenMovie(m));
    const withTrailers = await Promise.all(
      mapped.map(async (m) => {
        const trailerKey = await fetchMovieTrailer(m.id);
        if (trailerKey) {
          m.youtube_id = trailerKey;
          return m;
        }
        return null;
      })
    );
    return supplementMovies(withTrailers.filter(m => m !== null), 12);
  } catch (err) {
    console.error("TMDB fetch error, reverting to offline cache:", err);
    return getCachedMoviesByCategory(category);
  }
}

// Fetch detailed movie info including cast, trailer and runtimes
export async function getMovieDetails(movieId) {
  const hasKey = getApiKey();
  const cachedMovie = ALL_MOVIES.find(m => m.id === parseInt(movieId));

  if (!hasKey) {
    if (cachedMovie) {
      if (!cachedMovie.production_companies) {
        cachedMovie.production_companies = ["Warner Bros. Pictures", "Legendary Pictures"];
      }
      if (!cachedMovie.original_language) {
        cachedMovie.original_language = "en";
      }
    }
    return cachedMovie || null;
  }

  try {
    // Fetch base movie, credits, and videos concurrently
    const [detailData, videoData, creditData] = await Promise.all([
      fetchFromTMDB(`/movie/${movieId}`),
      fetchFromTMDB(`/movie/${movieId}/videos`),
      fetchFromTMDB(`/movie/${movieId}/credits`)
    ]);

    const trailerKey = videoData.results && videoData.results.length > 0 
      ? (videoData.results.find(v => v.type === "Trailer" && v.site === "YouTube") || videoData.results[0]).key 
      : (cachedMovie ? cachedMovie.youtube_id : null);

    const directorObj = creditData.crew ? creditData.crew.find(c => c.job === "Director") : null;
    const castNames = creditData.cast ? creditData.cast.slice(0, 5).map(c => c.name) : ["Premium Star Cast"];

    return {
      id: detailData.id,
      title: detailData.title,
      overview: detailData.overview,
      poster_path: detailData.poster_path ? `${IMAGE_BASE_URL}/w500${detailData.poster_path}` : (cachedMovie ? cachedMovie.poster_path : null),
      backdrop_path: detailData.backdrop_path ? `${IMAGE_BASE_URL}/original${detailData.backdrop_path}` : (cachedMovie ? cachedMovie.backdrop_path : null),
      vote_average: detailData.vote_average ? detailData.vote_average.toFixed(1) : "7.5",
      release_date: detailData.release_date || "2024",
      runtime: detailData.runtime || 120,
      genres: detailData.genres ? detailData.genres.map(g => g.name) : ["Cinema"],
      languages: detailData.spoken_languages ? detailData.spoken_languages.map(l => l.english_name) : ["English"],
      subtitles: ["English", "Hindi", "Spanish", "French", "Japanese"],
      youtube_id: trailerKey,
      director: directorObj ? directorObj.name : "Acclaimed Director",
      cast: castNames,
      awards: detailData.vote_average >= 8 ? "Critics Choice Gold Badge" : "Global Box Office Hit",
      quality: "4K UHD • Dolby Vision • Atmos",
      categories: cachedMovie ? cachedMovie.categories : [],
      rating: detailData.adult ? "R" : "PG-13",
      production_companies: detailData.production_companies ? detailData.production_companies.map(c => c.name) : ["Warner Bros. Pictures", "Legendary Pictures"],
      original_language: detailData.original_language || "en"
    };
  } catch (err) {
    console.error("TMDB details fetch error, reverting to offline cache:", err);
    if (cachedMovie) {
      if (!cachedMovie.production_companies) {
        cachedMovie.production_companies = ["Warner Bros. Pictures", "Legendary Pictures"];
      }
      if (!cachedMovie.original_language) {
        cachedMovie.original_language = "en";
      }
    }
    return cachedMovie || null;
  }
}

// Search movies
export async function searchMovies(query) {
  const hasKey = getApiKey();
  const validCached = ALL_MOVIES.filter(isValidMovie);
  if (!hasKey) {
    // Filter local cache by title or overview
    const lowerQuery = query.toLowerCase();
    const filtered = validCached.filter(m => 
      m.title.toLowerCase().includes(lowerQuery) || 
      m.overview.toLowerCase().includes(lowerQuery) ||
      m.director.toLowerCase().includes(lowerQuery)
    );
    return supplementMovies(filtered, 12);
  }

  try {
    const data = await fetchFromTMDB("/search/movie", { query });
    const results = data.results || [];
    const mapped = results.slice(0, 15).map(m => mapToEpicScreenMovie(m));
    const withTrailers = await Promise.all(
      mapped.map(async (m) => {
        const trailerKey = await fetchMovieTrailer(m.id);
        if (trailerKey) {
          m.youtube_id = trailerKey;
          return m;
        }
        return null;
      })
    );
    return supplementMovies(withTrailers.filter(m => m !== null), 12);
  } catch (err) {
    console.error("TMDB search error, filtering offline cache:", err);
    const lowerQuery = query.toLowerCase();
    const filtered = validCached.filter(m => 
      m.title.toLowerCase().includes(lowerQuery) || 
      m.overview.toLowerCase().includes(lowerQuery)
    );
    return supplementMovies(filtered, 12);
  }
}

// Fetch similar movies
export async function getSimilarMovies(movieId) {
  const hasKey = getApiKey();
  const validCached = ALL_MOVIES.filter(isValidMovie);
  const cachedMovie = ALL_MOVIES.find(m => m.id === parseInt(movieId));

  if (!hasKey) {
    if (!cachedMovie) return validCached.slice(0, 12);
    const filtered = validCached.filter(m => m.id !== cachedMovie.id && m.genres.some(g => cachedMovie.genres.includes(g)));
    return supplementMovies(filtered, 12);
  }

  try {
    const data = await fetchFromTMDB(`/movie/${movieId}/similar`);
    const results = data.results || [];
    const mapped = results.slice(0, 15).map(m => mapToEpicScreenMovie(m));
    
    const withTrailers = await Promise.all(
      mapped.map(async (m) => {
        const trailerKey = await fetchMovieTrailer(m.id);
        if (trailerKey) {
          m.youtube_id = trailerKey;
          return m;
        }
        return null;
      })
    );
    return supplementMovies(withTrailers.filter(m => m !== null), 12);
  } catch (err) {
    console.error("TMDB similar fetch error, reverting to offline cache:", err);
    if (!cachedMovie) return validCached.slice(0, 12);
    const filtered = validCached.filter(m => m.id !== cachedMovie.id && m.genres.some(g => cachedMovie.genres.includes(g)));
    return supplementMovies(filtered, 12);
  }
}

// Fetch recommended movies
export async function getRecommendedMovies(movieId) {
  const hasKey = getApiKey();
  const validCached = ALL_MOVIES.filter(isValidMovie);
  const cachedMovie = ALL_MOVIES.find(m => m.id === parseInt(movieId));

  if (!hasKey) {
    if (!cachedMovie) return validCached.slice(0, 12);
    const filtered = validCached.filter(m => m.id !== cachedMovie.id && parseFloat(m.vote_average) >= 7.2);
    return supplementMovies(filtered, 12);
  }

  try {
    const data = await fetchFromTMDB(`/movie/${movieId}/recommendations`);
    const results = data.results || [];
    const mapped = results.slice(0, 15).map(m => mapToEpicScreenMovie(m));
    
    const withTrailers = await Promise.all(
      mapped.map(async (m) => {
        const trailerKey = await fetchMovieTrailer(m.id);
        if (trailerKey) {
          m.youtube_id = trailerKey;
          return m;
        }
        return null;
      })
    );
    return supplementMovies(withTrailers.filter(m => m !== null), 12);
  } catch (err) {
    console.error("TMDB recommendations fetch error, reverting to offline cache:", err);
    if (!cachedMovie) return validCached.slice(0, 12);
    const filtered = validCached.filter(m => m.id !== cachedMovie.id && parseFloat(m.vote_average) >= 7.2);
    return supplementMovies(filtered, 12);
  }
}

// Fetch same language movies
export async function getSameLanguageMovies(language, currentMovieId) {
  const hasKey = getApiKey();
  const validCached = ALL_MOVIES.filter(isValidMovie);
  const cachedMovie = ALL_MOVIES.find(m => m.id === parseInt(currentMovieId));

  if (!hasKey) {
    if (!cachedMovie) return validCached.slice(0, 12);
    const lang = cachedMovie.languages[0];
    let sameLang = validCached.filter(m => m.id !== cachedMovie.id && m.languages.includes(lang));
    if (sameLang.length === 0) {
      sameLang = validCached.filter(m => m.id !== cachedMovie.id && m.categories.includes("indianBlockbusters"));
    }
    return supplementMovies(sameLang, 12);
  }

  try {
    const langMap = { "English": "en", "Telugu": "te", "Hindi": "hi", "Tamil": "ta", "Japanese": "ja", "Spanish": "es", "French": "fr" };
    const langCode = langMap[language] || "en";
    
    const data = await fetchFromTMDB("/discover/movie", { 
      with_original_language: langCode,
      sort_by: "popularity.desc"
    });
    const results = data.results || [];
    const mapped = results.filter(m => m.id !== parseInt(currentMovieId)).map(m => mapToEpicScreenMovie(m));
    
    const withTrailers = await Promise.all(
      mapped.slice(0, 15).map(async (m) => {
        const trailerKey = await fetchMovieTrailer(m.id);
        if (trailerKey) {
          m.youtube_id = trailerKey;
          return m;
        }
        return null;
      })
    );
    return supplementMovies(withTrailers.filter(m => m !== null), 12);
  } catch (err) {
    console.error("TMDB same language fetch error, reverting to offline cache:", err);
    if (!cachedMovie) return validCached.slice(0, 12);
    const lang = cachedMovie.languages[0];
    let sameLang = validCached.filter(m => m.id !== cachedMovie.id && m.languages.includes(lang));
    if (sameLang.length === 0) {
      sameLang = validCached.filter(m => m.id !== cachedMovie.id && m.categories.includes("indianBlockbusters"));
    }
    return supplementMovies(sameLang, 12);
  }
}

// Fetch trending movies
export async function getTrendingMovies() {
  const hasKey = getApiKey();
  const validCached = ALL_MOVIES.filter(isValidMovie);

  if (!hasKey) {
    const filtered = validCached.filter(m => m.categories.includes("trending") || m.categories.includes("todayObsession"));
    return supplementMovies(filtered, 12);
  }

  try {
    const data = await fetchFromTMDB("/trending/movie/day");
    const results = data.results || [];
    const mapped = results.slice(0, 15).map(m => mapToEpicScreenMovie(m));
    
    const withTrailers = await Promise.all(
      mapped.map(async (m) => {
        const trailerKey = await fetchMovieTrailer(m.id);
        if (trailerKey) {
          m.youtube_id = trailerKey;
          return m;
        }
        return null;
      })
    );
    return supplementMovies(withTrailers.filter(m => m !== null), 12);
  } catch (err) {
    console.error("TMDB trending fetch error, reverting to offline cache:", err);
    const filtered = validCached.filter(m => m.categories.includes("trending") || m.categories.includes("todayObsession"));
    return supplementMovies(filtered, 12);
  }
}

// Helper to filter cached data
function getCachedMoviesByCategory(category) {
  const validCached = ALL_MOVIES.filter(isValidMovie);
  
  // If request is for a specific category, return those. Else return a random list.
  const map = {
    spotlight: "spotlight",
    todayObsession: "todayObsession",
    criticsChoice: "criticsChoice",
    awardWinners: "awardWinners",
    hiddenGems: "hiddenGems",
    epicOriginals: "epicOriginals",
    aroundWorld: "aroundWorld",
    indianBlockbusters: "indianBlockbusters",
    animeUniverse: "animeUniverse",
    musicalHits: "musicalHits",
    horrorNights: "horrorNights",
    romantic: "romantic",
    familyTime: "familyTime",
    weekendBinge: "weekendBinge",
    nightWatch: "nightWatch",
    cozy: "cozy",
    adrenaline: "adrenaline",
    melancholy: "melancholy",
    directorNolan: "directorNolan",
    directorTarantino: "directorTarantino",
    directorScorsese: "directorScorsese",
    directorMiyazaki: "directorMiyazaki"
  };

  const dbTag = map[category];
  if (!dbTag) return supplementMovies([], 12);
  
  // Return matching list, shuffling slightly or returning unique items
  const filtered = validCached.filter(m => m.categories.includes(dbTag));
  return supplementMovies(filtered, 12);
}
