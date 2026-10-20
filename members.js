/*
 * ==========================================
 * CONFIGURATION
 * ==========================================
 */

const API_URL =
    "https://lichess.org/api/team/galaxy-stellar-chess/users";

const UPDATE_INTERVAL = 30000;

const container = document.getElementById("members");
const count = document.getElementById("member-count");
const lastUpdate = document.getElementById("last-update");
const status = document.getElementById("member-status");
const searchInput = document.getElementById("member-search");
const refreshButton = document.getElementById("refresh-members");

let allMembers = [];
let isLoading = false;


/*
 * ==========================================
 * DISPLAY MESSAGES
 * ==========================================
 */

function showMessage(message) {
    const paragraph = document.createElement("p");

    paragraph.className = "members-message";
    paragraph.textContent = message;

    container.replaceChildren(paragraph);
}


/*
 * ==========================================
 * DISPLAY MEMBERS
 * ==========================================
 */

function displayMembers() {
    const searchTerm = searchInput.value.trim().toLowerCase();

    const filteredMembers = allMembers.filter(member =>
        member.username.toLowerCase().includes(searchTerm)
    );

    container.replaceChildren();

    if (filteredMembers.length === 0) {
        showMessage(
            allMembers.length === 0
                ? "No members were found for this team."
                : "No members match your search."
        );
        return;
    }

    const fragment = document.createDocumentFragment();

    filteredMembers.forEach(member => {
        const card = document.createElement("a");

        card.className = "member-card";
        card.href =
            "https://lichess.org/@" +
            encodeURIComponent(member.username);

        card.target = "_blank";
        card.rel = "noopener noreferrer";
        card.setAttribute(
            "aria-label",
            "Open Lichess profile for " + member.username
        );

        const avatar = document.createElement("img");

        avatar.className = "member-avatar";
        avatar.alt = "";
        avatar.loading = "lazy";
        avatar.src =
            "https://lichess1.org/user/" +
            encodeURIComponent(member.username) +
            "/avatar";

        avatar.onerror = function () {
            this.onerror = null;
            this.src =
                "https://lichess1.org/assets/logo/lichess-favicon-512.png";
        };

        const name = document.createElement("span");

        name.className = "member-name";
        name.textContent = member.username;

        card.append(avatar, name);
        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}


/*
 * ==========================================
 * PARSE LICHESS RESPONSE
 * ==========================================
 */

function parseMembers(text) {
    const content = text.trim();

    if (!content) {
        return [];
    }

    // Try parsing a regular JSON response.
    try {
        const data = JSON.parse(content);

        if (Array.isArray(data)) {
            return data;
        }

        if (data && typeof data === "object") {
            if (Array.isArray(data.users)) {
                return data.users;
            }

            return [data];
        }
    } catch {
        // Lichess can return JSON Lines instead.
    }

    // Parse one JSON object per line.
    return content
        .split(/\r?\n/)
        .filter(line => line.trim() !== "")
        .map(line => JSON.parse(line));
}


/*
 * ==========================================
 * LOAD MEMBERS FROM LICHESS
 * ==========================================
 */

async function loadMembers() {
    if (isLoading) {
        return;
    }

    isLoading = true;

    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";
    container.setAttribute("aria-busy", "true");

    if (allMembers.length === 0) {
        status.textContent = "Loading";
        showMessage("Loading team members from Lichess...");
    }

    try {
        // Same simple fetch method as Chess960 Trainer.
        const response = await fetch(API_URL, {
            method: "GET",
            cache: "no-store"
            credentials: "omit",
            redirect: "follow"
        });

        if (!response.ok) {
            throw new Error(
                "Lichess returned HTTP " + response.status
            );
        }

        const text = await response.text();
        const members = parseMembers(text);

        const uniqueMembers = new Map();

        members.forEach(member => {
            if (!member || typeof member !== "object") {
                return;
            }

            const username =
                member.username ||
                member.id ||
                member.name;

            if (
                typeof username !== "string" ||
                username.trim() === ""
            ) {
                return;
            }

            const cleanUsername = username.trim();

            uniqueMembers.set(
                cleanUsername.toLowerCase(),
                { username: cleanUsername }
            );
        });

        allMembers = Array.from(uniqueMembers.values()).sort(
            (a, b) =>
                a.username.localeCompare(
                    b.username,
                    undefined,
                    { sensitivity: "base" }
                )
        );

        count.textContent = allMembers.length;
        status.textContent = "Connected";

        displayMembers();

        lastUpdate.textContent =
            "Last updated: " +
            new Date().toLocaleTimeString();

        console.log(
            "Lichess members updated:",
            allMembers.length
        );

    } catch (error) {
        console.error(
            "Unable to load Lichess members:",
            error
        );

        status.textContent = "Unavailable";

        if (allMembers.length > 0) {
            displayMembers();

            lastUpdate.textContent =
                "Refresh failed. Showing the last loaded member list.";
        } else {
            count.textContent = "—";

            showMessage(
                "Unable to load team members. Please try again later."
            );

            lastUpdate.textContent =
                "Error: " + error.message;
        }
    } finally {
        isLoading = false;

        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh Members";

        container.setAttribute("aria-busy", "false");
    }
}


/*
 * ==========================================
 * SEARCH
 * ==========================================
 */

searchInput.addEventListener("input", displayMembers);


/*
 * ==========================================
 * MANUAL REFRESH
 * ==========================================
 */

refreshButton.addEventListener("click", loadMembers);


/*
 * ==========================================
 * INITIAL LOAD AND AUTOMATIC UPDATES
 * ==========================================
 */

loadMembers();

setInterval(loadMembers, UPDATE_INTERVAL);
