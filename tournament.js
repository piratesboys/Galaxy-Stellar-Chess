/*
 * ==========================================
 * CONFIGURATION
 * ==========================================
 */

const TEAM_ID = "galaxy-stellar-chess";
const API_URL = `https://lichess.org/api/team/${TEAM_ID}`;

const REFRESH_INTERVAL = 60000;


/*
 * ==========================================
 * GET NDJSON FROM LICHESS
 * ==========================================
 */

async function loadNDJSON(url) {
    const response = await fetch(url, {
        method: "GET",
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`Lichess API error: ${response.status}`);
    }

    const text = await response.text();

    if (!text.trim()) {
        return [];
    }

    return text
        .trim()
        .split(/\r?\n/)
        .filter(line => line.trim() !== "")
        .map(line => JSON.parse(line));
}


/*
 * ==========================================
 * FORMAT DATE
 * ==========================================
 */

function formatDate(timestamp) {
    if (!timestamp) {
        return "Date unknown";
    }

    return new Date(timestamp).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}


/*
 * ==========================================
 * FORMAT DURATION
 * ==========================================
 */

function formatDuration(seconds) {
    if (!seconds) {
        return "";
    }

    const minutes = Math.round(seconds / 60);

    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;

    return remaining === 0
        ? `${hours}h`
        : `${hours}h ${remaining}min`;
}


/*
 * ==========================================
 * CREATE TOURNAMENT CARD
 * ==========================================
 */

function createTournamentCard(tournament, type, status) {
    const card = document.createElement("article");
    card.className = "card tournament-card";

    const name =
        tournament.fullName ||
        tournament.name ||
        `${type === "arena" ? "Arena" : "Swiss"} Tournament`;

    const statusLabels = {
        started: "In progress",
        created: "Upcoming",
        finished: "Finished"
    };

    const title = document.createElement("h3");
    title.textContent = name;
    card.appendChild(title);

    const statusElement = document.createElement("p");
    statusElement.className = "tournament-status";
    statusElement.textContent = statusLabels[status] || status;
    card.appendChild(statusElement);

    if (tournament.startsAt) {
        const date = document.createElement("p");
        date.textContent = formatDate(tournament.startsAt);
        card.appendChild(date);
    }

    if (tournament.seconds) {
        const duration = document.createElement("p");
        duration.textContent = formatDuration(tournament.seconds);
        card.appendChild(duration);
    }

    if (tournament.nbPlayers !== undefined) {
        const players = document.createElement("p");
        players.textContent = `${tournament.nbPlayers} players`;
        card.appendChild(players);
    }

    const link = document.createElement("a");

    link.className = "button";
    link.href = type === "arena"
        ? `https://lichess.org/tournament/${encodeURIComponent(tournament.id)}`
        : `https://lichess.org/swiss/${encodeURIComponent(tournament.id)}`;

    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open on Lichess";

    card.appendChild(link);

    return card;
}


/*
 * ==========================================
 * DISPLAY TOURNAMENTS
 * ==========================================
 */

function displayTournaments(tournaments, containerId, type, status) {
    const container = document.getElementById(containerId);

    if (!container) {
        console.warn(`Missing HTML container: ${containerId}`);
        return;
    }

    container.replaceChildren();

    if (!tournaments || tournaments.length === 0) {
        const emptyCard = document.createElement("div");
        emptyCard.className = "card empty-card";

        const message = document.createElement("p");
        message.textContent = "No tournaments here right now.";

        emptyCard.appendChild(message);
        container.appendChild(emptyCard);
        return;
    }

    const validTournaments = tournaments.filter(
        tournament => tournament && tournament.id
    );

    if (validTournaments.length === 0) {
        const message = document.createElement("p");
        message.className = "card empty-card";
        message.textContent = "No tournaments here right now.";
        container.appendChild(message);
        return;
    }

    validTournaments.forEach(tournament => {
        container.appendChild(
            createTournamentCard(tournament, type, status)
        );
    });
}


/*
 * ==========================================
 * ERROR MESSAGE
 * ==========================================
 */

function showError(containerId, error) {
    const container = document.getElementById(containerId);

    if (!container) {
        return;
    }

    container.replaceChildren();

    const card = document.createElement("div");
    card.className = "card error-card";

    const message = document.createElement("p");

    message.textContent =
        error && error.message.includes("401")
            ? "Lichess refused access to the tournament list."
            : "Unable to load tournaments. Please try again later.";

    card.appendChild(message);
    container.appendChild(card);
}


/*
 * ==========================================
 * LOAD ONE TOURNAMENT CATEGORY
 * ==========================================
 */

async function loadCategory(type, status, containerId) {
    try {
        const url = `${API_URL}/${type}?max=30&status=${status}`;

        console.log("Loading team tournaments:", url);

        const tournaments = await loadNDJSON(url);

        console.log(
            `${type} / ${status} / ${TEAM_ID}:`,
            tournaments
        );

        displayTournaments(
            tournaments,
            containerId,
            type,
            status
        );
    } catch (error) {
        console.error(
            `Error loading ${type} (${status}):`,
            error
        );

        showError(containerId, error);
    }
}


/*
 * ==========================================
 * LOAD ARENA TOURNAMENTS
 * ==========================================
 */

async function loadArena() {
    await Promise.all([
        loadCategory("arena", "started", "arenaCurrent"),
        loadCategory("arena", "created", "arenaUpcoming"),
        loadCategory("arena", "finished", "arenaFinished")
    ]);
}


/*
 * ==========================================
 * LOAD SWISS TOURNAMENTS
 * ==========================================
 */

async function loadSwiss() {
    await Promise.all([
        loadCategory("swiss", "started", "swissCurrent"),
        loadCategory("swiss", "created", "swissUpcoming"),
        loadCategory("swiss", "finished", "swissFinished")
    ]);
}


/*
 * ==========================================
 * LOAD ALL TOURNAMENTS
 * ==========================================
 */

async function loadAllTournaments() {
    await Promise.all([
        loadArena(),
        loadSwiss()
    ]);
}


/*
 * ==========================================
 * INITIAL LOAD AND AUTOMATIC REFRESH
 * ==========================================
 */

document.addEventListener("DOMContentLoaded", () => {
    loadAllTournaments();

    setInterval(loadAllTournaments, REFRESH_INTERVAL);
});
