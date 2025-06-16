import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Message Box Component
const MessageBox = ({ message, isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full border border-blue-400">
        <h3 className="text-xl font-bold text-white mb-4">Notification</h3>
        <div className="text-gray-200 mb-6 break-words whitespace-pre-wrap">{message}</div>
        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition duration-200"
        >
          Close
        </button>
      </div>
    </div>
  );
};


// Main App component
const App = () => {
  // State variables
  const [concerts, setConcerts] = useState([]);
  const [selectedConcert, setSelectedConcert] = useState(null);
  // Playlist now stores { artistName: string, songTitle: string, selected: boolean, youtubeLink: string | null }
  const [playlist, setPlaylist] = useState([]);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [loadingConcerts, setLoadingConcerts] = useState(false);
  const [error, setError] = useState('');
  const [firebaseApp, setFirebaseApp] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [googleUser, setGoogleUser] = useState(null); // Stores Google user info from sign-in
  const [youtubeAccessToken, setYoutubeAccessToken] = useState(null); // Stores YouTube OAuth Access Token

  // Message Box State
  const [messageBoxContent, setMessageBoxContent] = useState('');
  const [isMessageBoxVisible, setIsMessageBoxVisible] = useState(false);

  // New state variables for API search
  const [city, setCity] = useState('Spartanburg'); // Default city to Spartanburg
  const [genre, setGenre] = useState(''); // Selected genre from dropdown
  const [searchRadius, setSearchRadius] = useState('50'); // Default search radius in miles
  const [dateFilter, setDateFilter] = useState(''); // New: for date range filtering (e.g., '30', '60', '90')

  // Retry configuration for API calls
  const MAX_RETRIES = 2; // Max attempts for any API call (initial + 2 retries)

  // IMPORTANT: API Keys are now accessed from the global __APP_ENV__ object
  // injected by Vite, which means 'import.meta.env' is no longer used directly in App.jsx.
  const TICKETMASTER_API_KEY = typeof __APP_ENV__ !== 'undefined' ? __APP_ENV__.VITE_TICKETMASTER_API_KEY : '';
  const OPENCAGE_API_KEY = typeof __APP_ENV__ !== 'undefined' ? __APP_ENV__.VITE_OPENCAGE_API_KEY : '';
  const YOUTUBE_API_KEY = typeof __APP_ENV__ !== 'undefined' ? __APP_ENV__.VITE_YOUTUBE_API_KEY : ''; // This is for public video search

  // Firebase Configuration is now directly injected as a global object by Vite
  // from the __FIREBASE_CONFIG__ define in vite.config.js.
  // This should resolve the issue of the Firebase API key being misinterpreted.
  const firebaseConfig = typeof __FIREBASE_CONFIG__ !== 'undefined'
    ? JSON.parse(__FIREBASE_CONFIG__) // Parse the injected JSON string into an object
    : {
        // Fallback for local development if Vite's define somehow isn't active
        // (though in a proper setup, __FIREBASE_CONFIG__ will always be present after build)
        // Note: These fallback keys would still need to be correctly resolved if used
        apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', measurementId: ''
      };

  // Predefined list of genres for the dropdown
  const genres = [
    { value: '', label: 'All Genres' },
    { value: 'Rock', label: 'Rock' },
    { value: 'Pop', label: 'Pop' },
    { value: 'Hip-Hop', label: 'Hip-Hop' },
    { value: 'Electronic', label: 'Electronic' },
    { value: 'Jazz', label: 'Jazz' },
    { value: 'Classical', label: 'Classical' },
    { value: 'Country', label: 'Country' },
    { value: 'R&B', label: 'R&B' },
    { value: 'Blues', label: 'Blues' },
    { value: 'Metal', label: 'Metal' },
    { value: 'Folk', label: 'Folk' },
    { value: 'Indie', label: 'Indie' },
  ];

  // Function to format date to ISO 8601 for Ticketmaster API (e.g., Moreau-MM-DDTHH:mm:ssZ)
  const toIsoString = (date) => {
    const pad = (num) => num < 10 ? '0' + num : num;
    return date.getFullYear() +
           '-' + pad(date.getMonth() + 1) +
           '-' + pad(date.getDate()) +
           'T' + pad(date.getHours()) +
           ':' + pad(date.getMinutes()) +
           ':' + pad(date.getSeconds()) +
           'Z'; // Ticketmaster usually expects Z for UTC
  };

  // Function to fetch concerts from Ticketmaster API using OpenCage for coordinates
  const fetchConcerts = useCallback(async () => {
    if (!TICKETMASTER_API_KEY) { // Check for environment variable
      const msg = 'Missing Ticketmaster API Key. Please set VITE_TICKETMASTER_API_KEY environment variable in Vercel.';
      setError(msg);
      showMessageBox(msg);
      return;
    }
    if (!OPENCAGE_API_KEY) { // Check for environment variable
      const msg = 'Missing OpenCage API Key. Please set VITE_OPENCAGE_API_KEY environment variable in Vercel.';
      setError(msg);
      showMessageBox(msg);
      return;
    }
    if (!city) {
      setError('Please enter a city to search for concerts.');
      return;
    }

    setLoadingConcerts(true);
    setConcerts([]); // Clear previous concerts
    setSelectedConcert(null); // Clear selected concert when new search
    setPlaylist([]); // Clear previous playlist
    setError('');

    let latitude = null;
    let longitude = null;

    // Retry logic for OpenCage API call
    for (let i = 0; i <= MAX_RETRIES; i++) {
      try {
        // 1. Get Lat/Long from OpenCage
        const opencageApiUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(city)}&key=${OPENCAGE_API_KEY}&limit=1`;
        console.log(`OpenCage API URL being called (attempt ${i + 1}/${MAX_RETRIES + 1}):`, opencageApiUrl);

        const opencageResponse = await fetch(opencageApiUrl);
        if (!opencageResponse.ok) {
          const errorText = await opencageResponse.text();
          throw new Error(`OpenCage Geocoding API HTTP error! status: ${opencageResponse.status}, response: ${errorText}`);
        }
        const opencageData = await opencageResponse.json();

        if (opencageData.results && opencageData.results.length > 0) {
          latitude = opencageData.results[0].geometry.lat;
          longitude = opencageData.results[0].geometry.lng;
          console.log(`Coordinates for ${city}: Lat ${latitude}, Lng ${longitude}`);
          break; // Exit retry loop on success
        } else {
          throw new Error(`Could not find coordinates for "${city}".`);
        }
      } catch (geocodingError) {
        console.error(`Attempt ${i + 1}/${MAX_RETRIES + 1} failed for OpenCage API:`, geocodingError);
        if (i === MAX_RETRIES) {
          setError(`Failed to get location coordinates after ${MAX_RETRIES + 1} attempts: ${geocodingError.message}. Please check your OpenCage API key and network connection.`);
          showMessageBox(`Failed to get location coordinates. Please check your OpenCage API key and network connection. Error: ${geocodingError.message}`);
          setLoadingConcerts(false);
          return; // Stop function execution if max retries are reached
        }
        // Simple backoff for retries
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Wait 1s, then 2s
      }
    }

    if (!latitude || !longitude) {
      // This block will be reached if the above loop exited without finding coordinates
      // (e.g., if a non-API error occurred or if the city was truly not found)
      setError(`Failed to get location coordinates for "${city}". Please try a more specific city name.`);
      showMessageBox(`Failed to get location coordinates for "${city}". Please try a more specific city name.`);
      setLoadingConcerts(false);
      return;
    }

    // 2. Use Lat/Long and Date Filters in Ticketmaster API
    let ticketmasterApiUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&size=50`;

    // Filter to only include Music events by segmentName
    ticketmasterApiUrl += `&segmentName=Music`;

    // Use latlong filter with radius
    if (latitude && longitude) {
      ticketmasterApiUrl += `&latlong=${latitude},${longitude}`;
    }
    if (searchRadius) {
      ticketmasterApiUrl += `&radius=${encodeURIComponent(searchRadius)}&unit=miles`;
    }

    // Add genre filter - now handles 'Indie' by sending 'Indie' as the keyword
    if (genre && genre !== '') {
      let keywordForTicketmaster = genre;
      ticketmasterApiUrl += `&keyword=${encodeURIComponent(keywordForTicketmaster)}`;
    }

    // Add date filter
    if (dateFilter) {
      const startDate = new Date(); // Current date and time
      let endDate = new Date();

      switch (dateFilter) {
        case '30':
          endDate.setDate(startDate.getDate() + 30);
          break;
        case '60':
          endDate.setDate(startDate.getDate() + 60);
          break;
        case '90':
          endDate.setDate(startDate.getDate() + 90);
          break;
        default:
          // No date filter or invalid option, do nothing
          break;
      }

      ticketmasterApiUrl += `&startDateTime=${toIsoString(startDate)}&endDateTime=${toIsoString(endDate)}`;
    }


    console.log("Ticketmaster API URL being called:", ticketmasterApiUrl);

    // Retry logic for Ticketmaster API call
    for (let i = 0; i <= MAX_RETRIES; i++) {
      try {
        const response = await fetch(ticketmasterApiUrl);
        if (!response.ok) {
          throw new Error(`Ticketmaster API HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data._embedded && data._embedded.events) {
          const fetchedConcerts = data._embedded.events.map(event => {
            const venue = event._embedded?.venues?.[0];
            const venueName = venue?.name || 'Unknown Venue';
            const venueCity = venue?.city?.name || 'Unknown City';
            const venueStateCode = venue?.state?.stateCode || '';
            const location = venueCity + (venueStateCode ? `, ${venueStateCode}` : '');
            const primaryClassification = event.classifications?.[0];
            const genreName = primaryClassification?.genre?.name || 'Various';

            return {
              id: event.id,
              artist: event.name,
              venue: venueName,
              date: event.dates?.start?.localDate || 'Date TBD',
              genre: genreName,
              location: location,
              description: event.info || 'No additional info available.',
              url: event.url
            };
          });
          setConcerts(fetchedConcerts);
          setPlaylist([]); // Clear any previous playlist
          break; // Exit retry loop on success
        } else {
          // If no events found but response was OK, treat as no data, not an error
          setConcerts([]);
          setError('No concerts found for your search criteria. Try a different city, widen the radius, or adjust the date range!');
          break; // No need to retry if API says no events
        }
      } catch (apiError) {
        console.error(`Attempt ${i + 1}/${MAX_RETRIES + 1} failed for Ticketmaster API:`, apiError);
        if (i === MAX_RETRIES) {
          setError(`Failed to fetch concerts after ${MAX_RETRIES + 1} attempts: ${apiError.message}. Please check your Ticketmaster API key and network connection.`);
          showMessageBox(`Failed to fetch concerts. Please check your Ticketmaster API key and network connection. Error: ${apiError.message}`);
        }
        // Simple backoff for retries
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Wait 1s, then 2s
      }
    }
    setLoadingConcerts(false); // Ensure loading is turned off regardless of success or failure
  }, [city, genre, searchRadius, dateFilter, TICKETMASTER_API_KEY, OPENCAGE_API_KEY, MAX_RETRIES]);


  // Firebase Initialization and Authentication
  useEffect(() => {
    try {
      // Corrected: Ensure firebaseConfig is valid before initializing
      if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
        throw new Error("Firebase configuration is incomplete. Missing API Key or Project ID.");
      }

      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setFirebaseApp(app);
      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          console.log("User authenticated:", user.uid);
          // Check if this is a Google sign-in and get the access token for YouTube
          if (user.providerData && user.providerData.some(p => p.providerId === 'google.com')) {
            const idTokenResult = await user.getIdTokenResult();
            if (idTokenResult.accessToken) { // This is Firebase's access token, not directly YouTube's
              // For Google specific scopes, need to use getRedirectResult or signInWithPopup result
              // We'll handle YouTube token separately with signInWithPopup below.
            }
          }
        } else {
          try {
            const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
              console.log("Signed in with custom token.");
            } else {
              await signInAnonymously(firebaseAuth);
              console.log("Signed in anonymously.");
            }
          } catch (authError) {
            console.error("Firebase Auth Error:", authError);
            setError("Failed to authenticate with Firebase.");
          }
          setGoogleUser(null); // Clear Google user data on sign out/anonymous
          setYoutubeAccessToken(null); // Clear YouTube access token
        }
        setIsAuthReady(true);
      });

      // Initial concert fetch can happen here, but playlist generation is deferred
      fetchConcerts();

      return () => unsubscribe();
    } catch (err) {
      console.error("Firebase setup error:", err);
      const configErrorMsg = `Firebase configuration is missing or incorrect: ${err.message}. Please ensure VITE_FIREBASE_ environment variables are set correctly in Vercel.`;
      setError(configErrorMsg);
      showMessageBox(configErrorMsg);
    }
  }, [fetchConcerts, firebaseConfig]); // Added firebaseConfig to dependencies for clarity

  // Function to handle Google Sign-In with YouTube scope
  const handleGoogleSignIn = async () => {
    if (!auth) {
      setError("Firebase Auth not initialized.");
      return;
    }
    setLoadingPlaylist(true);
    try {
      const provider = new GoogleAuthProvider();
      // Request the YouTube scope for playlist management
      provider.addScope('https://www.googleapis.com/auth/youtube');
      provider.addScope('https://www.googleapis.com/auth/youtube.force-ssl'); // Recommended for secure API calls

      const result = await signInWithPopup(auth, provider);
      // The signed-in user info.
      setGoogleUser(result.user);
      // This gives you a Google Access Token. You can use it to access the Google API.
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential.accessToken;
      setYoutubeAccessToken(accessToken); // Store the YouTube-specific access token
      showMessageBox("Successfully signed in with Google! You can now create YouTube Music playlists.");
      console.log("Google Sign-In successful. Access Token for YouTube:", accessToken);
    } catch (googleAuthError) {
        console.error("Error during Google Sign-In:", googleAuthError);
        const errorMessage = googleAuthError.message;
        if (errorMessage.includes("auth/unauthorized-domain")) {
            // Attempt to get the top-level domain if running in an iframe
            const suggestedDomain = window.top.location.hostname || 'your-canvas-app-domain.example.com';

            const instructions = `Google Sign-In failed: ${errorMessage}.\n\nThis means the domain your app is running on is not authorized in your Firebase project.\n\nTo fix this:\n1. Go to your Firebase project console.\n2. Navigate to 'Authentication' -> 'Settings'.\n3. Under 'Authorized domains', click 'Add domain'.\n4. Add the domain where this application is currently hosted. You should add:\n\n'${suggestedDomain}'\n\n(Alternatively, you might need to add a wildcard like '*.${suggestedDomain.split('.').slice(-2).join('.')}' if your domain changes, but start with the full suggested domain).\n\nIf '${suggestedDomain}' doesn't work, please copy the *entire host* (e.g., 'example.com' or 'sub.example.com') from your browser's address bar and add that to Firebase.`;

            setError(instructions);
            showMessageBox(instructions);
        } else {
            setError(`Google Sign-In failed: ${errorMessage}. Make sure Google Auth is enabled in Firebase and YouTube Data API is enabled in Google Cloud.`);
            showMessageBox(`Google Sign-In failed: ${errorMessage}. Please check your Firebase Authentication settings (Google provider enabled) and YouTube Data API status in Google Cloud.`);
        }
    } finally {
        setLoadingPlaylist(false);
    }
  };

  // Function to handle Google Sign-Out
  const handleGoogleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setGoogleUser(null);
      setYoutubeAccessToken(null);
      showMessageBox("Successfully signed out of Google.");
    } catch (error) {
      console.error("Error signing out:", error);
      setError(`Sign out failed: ${error.message}`);
    }
  };


  // Function to simulate playlist generation using LLM and fetch YouTube links
  // This is now triggered by a button click
  const generatePlaylistFromConcerts = async () => {
    // Ensure we have artists to generate a playlist for
    if (concerts.length === 0) {
        showMessageBox("No concerts found to generate a playlist from. Please search for concerts first.");
        return;
    }

    setLoadingPlaylist(true);
    setPlaylist([]); // Clear previous playlist
    setError('');

    const uniqueArtists = [...new Set(concerts.map(c => c.artist))];
    if (uniqueArtists.length === 0) {
        setLoadingPlaylist(false);
        showMessageBox("No unique artists found in the current concert list to generate a playlist.");
        return;
    }

    const artistsPromptList = uniqueArtists.map(artist => `"${artist}"`).join(', ');
    const prompt = `Generate a JSON array of objects. Each object should represent an artist and their single most popular song. The array should contain objects for the following artists: [${artistsPromptList}]. Each object must have two properties: "artistName" (string) and "songTitle" (string). For example: [{"artistName": "Artist1", "songTitle": "Song A"}, {"artistName": "Artist2", "songTitle": "Song B"}]. Please ensure to generate a song for each artist provided.`;

    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = {
      contents: chatHistory,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              artistName: { type: "STRING" },
              songTitle: { type: "STRING" }
            },
            required: ["artistName", "songTitle"]
          }
        }
      }
    };

    try {
      const geminiApiKey = ""; // This is for the LLM call itself
      const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
      const response = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const jsonString = result.candidates[0].content.parts[0].text;
        const parsedSongs = JSON.parse(jsonString);

        // Fetch YouTube links for each song (using the YOUTUBE_API_KEY for public search)
        const songsWithLinks = await Promise.all(parsedSongs.map(async (item) => {
          let youtubeLink = null;
          if (YOUTUBE_API_KEY && YOUTUBE_API_KEY !== 'YOUR_YOUTUBE_DATA_API_KEY_HERE') {
            try {
              const searchTerm = `${item.artistName} - ${item.songTitle} official audio`;
              const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id&q=${encodeURIComponent(searchTerm)}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;
              const searchResponse = await fetch(searchUrl);
              const searchData = await searchResponse.json();
              const videoId = searchData.items?.[0]?.id?.videoId;
              if (videoId) {
                youtubeLink = `https://music.youtube.com/watch?v=${videoId}`;
              } else {
                console.warn(`No YouTube video ID found for "${searchTerm}".`);
              }
            } catch (youtubeError) {
              console.error(`Error fetching YouTube link for "${item.songTitle}":`, youtubeError);
            }
          }
          return {
            artistName: item.artistName,
            songTitle: item.songTitle,
            selected: true, // Selected by default
            youtubeLink: youtubeLink // Add the YouTube link
          };
        }));
        setPlaylist(songsWithLinks);

      } else {
        setError("LLM response was not as expected. Could not generate playlist.");
        console.error("LLM Error:", result);
      }
    } catch (apiError) {
      setError("Failed to generate playlist. Please try again.");
      console.error("API Call Error:", apiError);
    } finally {
      setLoadingPlaylist(false);
    }
  };

  // Function to create an actual YouTube Music playlist
  const createYouTubeMusicPlaylist = async () => {
    const selectedSongs = playlist.filter(song => song.selected);

    if (selectedSongs.length === 0) {
      showMessageBox("Please select at least one song to create a YouTube Music playlist.");
      return;
    }
    if (!googleUser || !youtubeAccessToken) {
      showMessageBox("Please sign in with Google and authorize YouTube access to create a playlist.");
      return;
    }
    if (YOUTUBE_API_KEY === 'YOUR_YOUTUBE_DATA_API_KEY_HERE') {
        showMessageBox("Please ensure your YOUTUBE_API_KEY is set in the code to fetch video IDs for playlist creation.");
        return;
    }

    setLoadingPlaylist(true);
    let playlistId = null;

    try {
      // 1. Create a new YouTube playlist
      const playlistTitle = `SonicCompass Hype - ${new Date().toLocaleString()}`;
      const createPlaylistUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,status&key=${YOUTUBE_API_KEY}`; // API key might be optional for authenticated requests, but good to include
      const createPlaylistResponse = await fetch(createPlaylistUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${youtubeAccessToken}`, // Use the OAuth access token
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            title: playlistTitle,
            description: "Playlist created by SonicCompass from your selected concert artists."
          },
          status: {
            privacyStatus: 'private' // Can be 'public', 'private', or 'unlisted'
          }
        }),
      });

      if (!createPlaylistResponse.ok) {
        const errorData = await createPlaylistResponse.json();
        throw new Error(`Failed to create playlist: ${errorData.error.message || createPlaylistResponse.statusText}`);
      }

      const playlistData = await createPlaylistResponse.json();
      playlistId = playlistData.id;
      console.log(`Playlist created: ${playlistData.snippet.title}, ID: ${playlistId}`);

      showMessageBox(`Playlist "${playlistData.snippet.title}" created! Now adding songs...`);

      // 2. Search for each selected song (if no existing link) and add to the playlist
      for (const song of selectedSongs) {
        let videoId = null;
        if (song.youtubeLink) {
            // Extract videoId from existing YouTube Music link
            const urlParams = new URLSearchParams(new URL(song.youtubeLink).search);
            videoId = urlParams.get('v');
        } else {
            // Search for video ID if no link was generated initially (fallback)
            try {
                const searchTerm = `${song.artistName} - ${song.songTitle} official audio`;
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id&q=${encodeURIComponent(searchTerm)}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;
                const searchResponse = await fetch(searchUrl);
                const searchData = await searchResponse.json();
                videoId = searchData.items?.[0]?.id?.videoId;
                if (!videoId) {
                    console.warn(`No video found for "${searchTerm}" for playlist item.`);
                    showMessageBox(`Could not find video for "${song.artistName} - ${song.songTitle}". Skipping.`);
                }
            } catch (searchError) {
                console.error(`Error searching for video for "${song.songTitle}":`, searchError);
                showMessageBox(`Error searching for "${song.artistName} - ${song.songTitle}". Skipping.`);
            }
        }

        if (videoId) {
            const addPlaylistItemUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&key=${YOUTUBE_API_KEY}`; // API key again might be optional
            const addPlaylistItemResponse = await fetch(addPlaylistItemUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${youtubeAccessToken}`, // Use the OAuth access token
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                snippet: {
                  playlistId: playlistId,
                  resourceId: {
                    kind: 'youtube#video',
                    videoId: videoId
                  }
                }
              }),
            });

            if (!addPlaylistItemResponse.ok) {
              const errorData = await addPlaylistItemResponse.json();
              console.warn(`Failed to add "${song.songTitle}" to playlist: ${errorData.error.message || addPlaylistItemResponse.statusText}`);
              showMessageBox(`Failed to add "${song.songTitle}" to playlist. Skipping.`);
            } else {
              console.log(`Added "${song.songTitle}" to playlist.`);
            }
        }
      }

      if (playlistId) {
        showMessageBox(`YouTube Music playlist created successfully! You can view it here: https://music.youtube.com/playlist?list=${playlistId}`);
      }

    } catch (mainError) {
      console.error("Error creating YouTube Music playlist:", mainError);
      showMessageBox(`Error creating YouTube Music playlist: ${mainError.message}. Please ensure you are signed in and have granted YouTube access.`);
    } finally {
      setLoadingPlaylist(false);
    }
  };


  // Toggle song selection
  const toggleSongSelection = (index) => {
    setPlaylist(currentPlaylist =>
      currentPlaylist.map((song, i) =>
        i === index ? { ...song, selected: !song.selected } : song
      )
    );
  };

  // Handle message box display
  const showMessageBox = (message) => {
    setMessageBoxContent(message);
    setIsMessageBoxVisible(true);
  };

  const hideMessageBox = () => {
    setIsMessageBoxVisible(false);
    setMessageBoxContent('');
  };

  // Save selected songs (now uses message box)
  const saveSelectedSongs = () => {
    const selectedSongs = playlist.filter(song => song.selected).map(song => ({
      artist: song.artistName,
      song: song.songTitle
    }));
    if (selectedSongs.length > 0) {
      showMessageBox(`You've selected ${selectedSongs.length} songs for your playlist:\n${selectedSongs.map(s => `${s.song} by ${s.artist}`).join('\n')}`);
    } else {
      showMessageBox("No songs selected!");
    }
  };

  // Handle concert selection (for subsequent clicks, primarily for displaying concert details)
  const handleSelectConcert = (concert) => {
    setSelectedConcert(concert);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 text-gray-100 font-inter p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />

      <style>{`
        body { font-family: 'Inter', sans-serif; }
        .scrollable-list {
          max-height: 400px; /* Max height for scrollable areas */
          overflow-y: auto;  /* Enable vertical scrolling */
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;   /* Firefox */
        }
        .scrollable-list::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera*/
        }
      `}</style>

      {/* Message Box */}
      <MessageBox message={messageBoxContent} isVisible={isMessageBoxVisible} onClose={hideMessageBox} />

      {/* Header Section */}
      <h1 className="text-4xl sm:text-5xl font-bold text-center mb-6 text-white drop-shadow-lg">
        SonicCompass
      </h1>
      <p className="text-lg text-center mb-8 max-w-2xl">
        Find concerts near you and get a personalized playlist to get hyped!
      </p>

      {/* User ID Display */}
      {isAuthReady && userId && (
        <div className="bg-gray-800 bg-opacity-70 rounded-lg p-3 mb-6 shadow-md text-sm text-gray-300 flex items-center justify-between w-full max-w-xl">
          <p>Your User ID: <span className="font-mono break-all">{userId}</span></p>
        </div>
      )}

      {error && (
        <div className="bg-red-500 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </div>
      )}

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Concert Discovery Section */}
        <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-white">Upcoming Concerts</h2>

          {/* Search/Filter Inputs */}
          <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3">
            <input
              type="text"
              placeholder="City (e.g., Spartanburg)"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="flex-grow p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-400 focus:outline-none placeholder-gray-400 min-w-[120px]"
            />
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="flex-grow p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-400 focus:outline-none appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23d1d5db' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3Csvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.5rem auto' }}
            >
              {genres.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            <select
              value={searchRadius}
              onChange={(e) => setSearchRadius(e.target.value)}
              className="flex-grow p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-400 focus:outline-none appearance-none min-w-[120px]"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23d1d5db' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3Csvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.5rem auto' }}
            >
              <option value="25">25 Miles</option>
              <option value="50">50 Miles</option>
              <option value="100">100 Miles</option>
              <option value="200">200 Miles</option>
            </select>
            {/* Date Filter Dropdown */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="flex-grow p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-400 focus:outline-none appearance-none min-w-[120px]"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23d1d5db' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3Csvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.5rem auto' }}
            >
              <option value="">Any Date</option>
              <option value="30">Next 30 Days</option>
              <option value="60">Next 60 Days</option>
              <option value="90">Next 90 Days</option>
            </select>
            <button
              onClick={fetchConcerts}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold text-white transition duration-200 shadow-md w-full sm:w-auto"
              disabled={loadingConcerts}
            >
              {loadingConcerts ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span className="ml-2">Searching...</span>
                </div>
              ) : (
                'Search'
              )}
            </button>
          </div>

          <div className="scrollable-list flex-grow space-y-4">
            {loadingConcerts ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400"></div>
                <p className="ml-3 text-blue-300">Fetching concerts...</p>
              </div>
            ) : concerts.length > 0 ? (
              concerts.map((concert) => (
                <div
                  key={concert.id}
                  className={`bg-gray-700 bg-opacity-80 p-4 rounded-lg shadow-lg cursor-pointer transform transition duration-200 hover:scale-[1.02]
                              ${selectedConcert?.id === concert.id ? 'border-2 border-blue-400' : 'border border-transparent'}`}
                  onClick={() => handleSelectConcert(concert)}
                >
                  <h3 className="text-xl font-bold text-blue-300">{concert.artist}</h3>
                  <p className="text-gray-300">{concert.venue} - {concert.location}</p>
                  <p className="text-sm text-gray-400">{concert.date} | {concert.genre}</p>
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">{concert.description}</p>
                  {concert.url && (
                    <a
                      href={concert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm mt-2 block"
                      onClick={(e) => e.stopPropagation()} // Prevent selecting concert when clicking link
                    >
                      View Tickets
                    </a>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center">No concerts found. Try a different city or widen the search radius!</p>
            )}
          </div>
        </div>

        {/* Playlist Generation Section */}
        <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-2xl flex flex-col">
          <h2 className="text-2xl font-semibold mb-4 text-white">Your Hype Playlist</h2>
          {/* Initial state: Prompt user to search for concerts */}
          {!selectedConcert && !loadingConcerts && !loadingPlaylist && concerts.length === 0 && (
             <p className="text-gray-400 text-center flex-grow flex items-center justify-center">
              Search for concerts to generate a playlist for found artists.
            </p>
          )}

          {/* Show Generate Playlist button if concerts are available and no playlist generated yet */}
          {concerts.length > 0 && !loadingConcerts && playlist.length === 0 && !loadingPlaylist && (
            <div className="text-center my-4">
              <button
                onClick={generatePlaylistFromConcerts}
                className="px-5 py-3 bg-red-600 hover:bg-red-700 rounded-md font-semibold text-white transition duration-200 shadow-md w-full"
                disabled={loadingPlaylist}
              >
                Generate Playlist from Concerts
              </button>
            </div>
          )}

          {/* Loading state for playlist generation */}
          {(loadingPlaylist) ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400"></div>
              <p className="ml-3 text-blue-300">Generating playlist for all artists...</p>
            </div>
          ) : playlist.length > 0 ? (
            <>
              <p className="text-lg text-blue-200 mb-3">
                Top songs from artists found in your search results:
              </p>
              <div className="scrollable-list flex-grow space-y-2">
                {playlist.map((song, index) => (
                  <div key={index} className="bg-gray-700 bg-opacity-80 p-3 rounded-md flex items-center">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 text-blue-600 rounded mr-3 bg-gray-600 border-gray-500 focus:ring-blue-500"
                      checked={song.selected}
                      onChange={() => toggleSongSelection(index)}
                    />
                    <p className="text-gray-200">
                      <span className="font-bold">{song.artistName}:</span> {song.songTitle}
                      {song.youtubeLink && (
                        <a
                          href={song.youtubeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-red-400 hover:text-red-300 text-sm ml-2"
                        >
                          (YouTube Music)
                        </a>
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <button
                onClick={saveSelectedSongs}
                className="mt-4 px-5 py-3 bg-green-600 hover:bg-green-700 rounded-md font-semibold text-white transition duration-200 shadow-md w-full"
              >
                Save Selected Songs
              </button>

              {/* Google Sign-in/out moved here */}
              {isAuthReady && (
                <div className="bg-gray-700 bg-opacity-80 rounded-lg p-3 mt-4 shadow-md text-sm text-gray-300 flex flex-col sm:flex-row items-center justify-between w-full">
                  {googleUser ? (
                    <div className="flex items-center w-full sm:w-auto justify-center sm:justify-start">
                      <span className="mr-2 text-green-400 text-center sm:text-left">Signed in as {googleUser.displayName || googleUser.email}</span>
                      <button
                        onClick={handleGoogleSignOut}
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-md text-xs text-white transition duration-200"
                      >
                        Sign Out Google
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleGoogleSignIn}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-md text-xs text-white transition duration-200 w-full sm:w-auto"
                      disabled={loadingPlaylist}
                    >
                      {loadingPlaylist ? (
                          <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              <span className="ml-1">Signing In...</span>
                          </div>
                      ) : (
                          'Sign In with Google for YouTube'
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Real YouTube Music Playlist Creation */}
              <div className="mt-6 p-4 bg-gray-700 rounded-lg shadow-inner">
                <h3 className="text-xl font-semibold text-white mb-3">Create Shareable YouTube Music Playlist</h3>
                {googleUser && youtubeAccessToken ? (
                    <button
                        onClick={createYouTubeMusicPlaylist}
                        className="px-5 py-3 bg-red-600 hover:bg-red-700 rounded-md font-semibold text-white transition duration-200 shadow-md w-full"
                        disabled={loadingPlaylist}
                    >
                        {loadingPlaylist ? (
                            <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                <span className="ml-2">Creating Playlist...</span>
                            </div>
                        ) : (
                            'Create Playlist on My YouTube Music'
                        )}
                    </button>
                ) : (
                    <p className="text-yellow-300 text-sm text-center">
                        Please "Sign In with Google for YouTube" above to enable playlist creation.
                    </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  (Requires Google Account sign-in with YouTube access permission)
                </p>
              </div>

            </>
          ) : (
            // Message if no playlist generated yet despite concerts found
            concerts.length > 0 && !loadingConcerts && (
                <p className="text-gray-400 text-center mt-4">
                    Click "Generate Playlist from Concerts" to get started.
                </p>
            )
          )}
        </div>
      </div>

      {/* Footer / Disclaimer */}
      <footer className="mt-10 text-center text-gray-400 text-sm">
        <p>&copy; 2025 SonicCompass. All rights reserved.</p>
        <p className="mt-2">
          Note: This app integrates with the Ticketmaster Discovery API for concert data, OpenCage for geocoding, and uses an LLM for simulated playlist generation.
          YouTube Music playlist creation requires user authentication via Google to manage your playlists.
        </p>
      </footer>
    </div>
  );
};

export default App;
