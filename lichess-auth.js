
/*
 * Galaxy Stellar Chess
 * Lichess Authentication — OAuth 2.0 + PKCE
 */

const CLIENT_ID = "galaxy-stellar-chess";
const TEAM_ID = "galaxy-stellar-chess";

const REDIRECT_URI = window.location.origin +
  window.location.pathname;

const TOKEN_KEY = "gsc_lichess_token";
const VERIFIER_KEY = "gsc_pkce_verifier";
const STATE_KEY = "gsc_oauth_state";

const loginButton = document.getElementById("lichess-login-btn");
const logoutButton = document.getElementById("lichess-logout-btn");
const profileBox = document.getElementById("lichess-profile");
const usernameElement = document.getElementById("lichess-username");
const profileLink = document.getElementById("lichess-profile-link");
const teamStatus = document.getElementById("lichess-team-status");
const message = document.getElementById("lichess-message");

function showMessage(text) {
  message.textContent = text;
}

function base64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomString(length = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(length)));
}

async function createChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return base64Url(new Uint8Array(digest));
}

async function startLogin() {
  try {
    if (!window.isSecureContext || !crypto.subtle) {
      throw new Error("Please use HTTPS to sign in with Lichess.");
    }

    const verifier = randomString();
    const challenge = await createChallenge(verifier);
    const state = randomString();

    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_challenge_method: "S256",
      code_challenge: challenge,
      state
    });

    window.location.href =
      "https://lichess.org/oauth?" + params.toString();

  } catch (error) {
    console.error("Login initialization failed:", error);
    showMessage(error.message || "Unable to start login.");
  }
}

async function exchangeCode(code, returnedState) {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const expectedState = sessionStorage.getItem(STATE_KEY);

  if (
    !verifier ||
    !expectedState ||
    returnedState !== expectedState
  ) {
    window.history.replaceState({}, document.title, REDIRECT_URI);
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);

    throw new Error(
      "Security verification failed. Please sign in again."
    );
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID
  });

  window.history.replaceState({}, document.title, REDIRECT_URI);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);

  const response = await fetch("https://lichess.org/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(
      `Token exchange failed (HTTP ${response.status}).`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Lichess did not return an access token.");
  }

  sessionStorage.setItem(TOKEN_KEY, data.access_token);

  await loadProfile(data.access_token);
}

async function apiGet(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Lichess API error (HTTP ${response.status}).`);
  }

  return response.json();
}

async function loadProfile(token) {
  showMessage("Loading your Lichess profile...");

  const account = await apiGet(
    "https://lichess.org/api/account",
    token
  );

  if (!account.username) {
    throw new Error("Unable to retrieve your Lichess username.");
  }

  usernameElement.textContent = account.username;
  profileLink.href =
    "https://lichess.org/@" + encodeURIComponent(account.username);

  loginButton.hidden = true;
  profileBox.hidden = false;

  showMessage("Signed in successfully with Lichess.");

  await checkTeam(account.username);
}

async function checkTeam(username) {
  teamStatus.textContent = "Checking...";

  try {
    const url =
      "https://lichess.org/api/team/of/" +
      encodeURIComponent(username);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `Team API returned HTTP ${response.status}.`
      );
    }

    const teams = await response.json();

    if (!Array.isArray(teams)) {
      throw new Error("Unexpected team API response.");
    }

    const isMember = teams.some(
      team => team.id === TEAM_ID
    );

    if (isMember) {
      teamStatus.textContent = "Verified member ✓";
    } else {
      teamStatus.textContent = "Not currently a member";
    }

  } catch (error) {
    console.error("Team verification failed:", error);

    teamStatus.textContent = "Verification failed";

    showMessage(
      "Your account is connected, but team membership " +
      "could not be verified. Check the browser console."
    );
  }
}

function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);

  profileBox.hidden = true;
  loginButton.hidden = false;

  usernameElement.textContent = "";
  profileLink.href = "#";
  teamStatus.textContent = "Not verified";

  showMessage("You have signed out of Galaxy Stellar Chess.");
}

async function initialize() {
  loginButton.addEventListener("click", startLogin);
  logoutButton.addEventListener("click", logout);

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");

  if (oauthError) {
    window.history.replaceState({}, document.title, REDIRECT_URI);
    showMessage("Lichess sign-in was cancelled or denied.");
    return;
  }

  try {
    if (code) {
      await exchangeCode(code, state);
      return;
    }

    const token = sessionStorage.getItem(TOKEN_KEY);

    if (token) {
      await loadProfile(token);
    }
  } catch (error) {
    console.error("Authentication failed:", error);

    sessionStorage.removeItem(TOKEN_KEY);

    profileBox.hidden = true;
    loginButton.hidden = false;

    showMessage(error.message || "Authentication failed.");
  }
}

initialize();
