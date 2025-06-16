# SonicCompass

SonicCompass is a React application designed to help you find upcoming concerts near your specified city and generate a personalized "hype" playlist of popular songs by the artists found. It also offers the functionality to create a real, shareable YouTube Music playlist directly on your Google account.

## Features

* **Concert Discovery:** Search for music concerts by city, genre, search radius, and date range using the Ticketmaster Discovery API.
* **Location Geocoding:** Utilizes the OpenCage API to convert city names into geographical coordinates for accurate concert searching.
* **AI-Powered Playlist Generation:** Generates a list of popular songs for the artists found in your concert search results using a Large Language Model (LLM).
* **YouTube Music Integration (Links):** Provides direct, clickable YouTube Music links for each generated song, allowing you to easily preview the tracks.
* **YouTube Music Playlist Creation (OAuth 2.0):** Authenticate with your Google account via OAuth 2.0 to create a new, shareable playlist directly on your YouTube Music account, populated with your selected songs.
* **Firebase Authentication:** Uses Firebase for anonymous user authentication to manage user sessions.
* **Responsive Design:** Optimized for various screen sizes, from mobile to desktop.

## Setup and Deployment (Vercel)

This project uses Vite for a fast development experience and is configured for easy deployment to Vercel.

### 1. Prerequisites

* **Node.js and npm/yarn:** Ensure you have Node.js (v18+) and npm (or yarn) installed.
* **Git:** For version control.
* **Firebase Project:**
    * Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
    * **Enable `Authentication` -> `Google` provider.** This is crucial for Google Sign-In.
    * **Add Authorized Domains:** Go to `Authentication` -> `Settings` -> `Authorized domains`.
        * Add `localhost` (for local development).
        * Add the domain where you're running this app in the Canvas environment (e.g., `[some-long-string].scf.usercontent.goog` - copy this directly from your browser's address bar when viewing the app).
        * After deploying to Vercel, **add your Vercel deployment domain** (e.g., `your-app-name.vercel.app`) to this list.
* **Google Cloud Project for APIs:**
    * Go to [Google Cloud Console](https://console.cloud.google.com/).
    * Ensure the **YouTube Data API v3 is enabled** for your project.

### 2. API Keys

You'll need the following API keys. These should be set as **Environment Variables** in your Vercel project (and optionally in a `.env` file for local development).

* **`VITE_TICKETMASTER_API_KEY`**: Obtain this from the [Ticketmaster Developer Portal](https://developer.ticketmaster.com/).
* **`VITE_OPENCAGE_API_KEY`**: Obtain this from the [OpenCage Geocoding API](https://opencagedata.com/).
* **`VITE_YOUTUBE_API_KEY`**: Obtain this from the [Google Cloud Console](https://console.cloud.google.com/) (ensure YouTube Data API v3 is enabled).

**How to set Environment Variables in Vercel:**

1.  Go to your Vercel Dashboard and select your project.
2.  Navigate to **`Settings`** -> **`Environment Variables`**.
3.  Add each variable with its respective `Name` (e.g., `VITE_TICKETMASTER_API_KEY`) and `Value`. Ensure you set them for the appropriate environments (e.g., `Production`, `Preview`, `Development`).

### 3. Local Development

1.  **Create a new project folder** and navigate into it:
    ```bash
    mkdir sonic-compass-app
    cd sonic-compass-app
    ```
2.  **Copy the provided files** (`package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `.gitignore`, `README.md`) into their respective locations.
    * Make sure `src` directory contains `main.jsx` and `App.jsx`.
    * You might want to create an empty `src/index.css` or add basic Tailwind directives to it.
3.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
4.  **Create a `.env` file** in the root of your project for local development (optional, but recommended for testing):
    ```
    VITE_TICKETMASTER_API_KEY=YOUR_TICKETMASTER_API_KEY_HERE
    VITE_OPENCAGE_API_KEY=YOUR_OPENCAGE_API_KEY_HERE
    VITE_YOUTUBE_API_KEY=YOUR_YOUTUBE_DATA_API_KEY_HERE
    ```
    (Replace placeholders with your actual keys.)
5.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    The app will typically run on `http://localhost:5173`.

### 4. Deployment to Vercel

1.  **Initialize a Git repository** in your project folder:
    ```bash
    git init
    git add .
    git commit -m "Initial commit for SonicCompass app"
    ```
2.  **Create a new repository on GitHub, GitLab, or Bitbucket.**
3.  **Link your local repository to the remote one** and push your code:
    ```bash
    git remote add origin <YOUR_REPOSITORY_URL>
    git branch -M main
    git push -u origin main
    ```
4.  **Deploy on Vercel:**
    * Go to [Vercel](https://vercel.com/) and sign in.
    * Click on **`Add New...`** -> **`Project`**.
    * **Import your Git Repository** (connect Vercel to your GitHub/GitLab/Bitbucket if you haven't already).
    * Vercel should automatically detect that it's a **Vite project**.
    * **Set the Environment Variables** as described in "2. API Keys" above.
    * Click **`Deploy`**.

Vercel will build and deploy your application. Once deployed, it will provide you with a unique URL (e.g., `your-project-name.vercel.app`). Remember to add this Vercel domain to your Firebase Authorized Domains list!

---

**Regarding the `auth/unauthorized-domain` error you were seeing:**

The specific error `auth/unauthorized-domain` occurs because Firebase ensures that only domains you explicitly trust can use your authentication services. When you run code in a sandbox like this conversational AI environment, it often uses a unique `blob:` URL or a dynamically generated `usercontent.goog` subdomain. Firebase doesn't know about these by default.

By adding `window.top.location.hostname` to your Firebase authorized domains (as explained in the message box, and above), you're explicitly telling Firebase to trust the domain where the Canvas app is embedded. For your Vercel deployment, you'll need to do the same for your `*.vercel.app` domain.
