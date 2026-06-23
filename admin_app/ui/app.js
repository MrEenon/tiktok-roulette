const BACKEND_URL = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : '';

// Safe Session Storage Wrapper to prevent crash in strict environments
let authToken = null;
try {
    authToken = sessionStorage.getItem("admin_token") || null;
} catch (e) {
    console.warn("sessionStorage access denied. Falling back to memory storage.", e);
}

function safeSetToken(token) {
    authToken = token;
    try {
        sessionStorage.setItem("admin_token", token);
    } catch (e) {
        console.warn("Failed to save token to sessionStorage:", e);
    }
}

function safeRemoveToken() {
    authToken = null;
    try {
        sessionStorage.removeItem("admin_token");
    } catch (e) {
        console.warn("Failed to remove token from sessionStorage:", e);
    }
}

let keysData = [];

// --- DOM Selectors ---
const dom = {
    // Views
    loginView: document.getElementById("login-view"),
    dashboardView: document.getElementById("dashboard-view"),
    
    // Login Form
    loginForm: document.getElementById("admin-login-form"),
    loginUsername: document.getElementById("username"),
    loginPassword: document.getElementById("password"),
    loginError: document.getElementById("login-error"),
    btnLogin: document.getElementById("btn-login"),
    
    // Header
    currentAdminDisplay: document.getElementById("current-admin-display"),
    btnLogout: document.getElementById("btn-logout"),
    btnViewLogs: document.getElementById("btn-view-logs"),
    
    // Stats
    statTotal: document.getElementById("stat-total"),
    statActive: document.getElementById("stat-active"),
    statPaused: document.getElementById("stat-paused"),
    
    // Dashboard Controls
    btnOpenGenerate: document.getElementById("btn-open-generate"),
    btnRefresh: document.getElementById("btn-refresh"),
    btnExportCsv: document.getElementById("btn-export-csv"),
    searchInput: document.getElementById("search-input"),
    keysTbody: document.getElementById("keys-tbody"),
    
    // Generate Modal
    generateModal: document.getElementById("generate-modal"),
    generateForm: document.getElementById("generate-form"),
    genUsername: document.getElementById("gen-username"),
    genDuration: document.getElementById("gen-duration"),
    genCount: document.getElementById("gen-count"),
    customDateGroup: document.getElementById("custom-date-group"),
    genCustomDate: document.getElementById("gen-custom-date"),
    genNotes: document.getElementById("gen-notes"),
    
    // Logs Modal
    logsModal: document.getElementById("logs-modal"),
    logsTbody: document.getElementById("logs-tbody"),
    
    // Confirmation Modal
    confirmModal: document.getElementById("confirm-modal"),
    confirmTitle: document.getElementById("confirm-title"),
    confirmMessage: document.getElementById("confirm-message"),
    btnConfirmYes: document.getElementById("btn-confirm-yes")
};

// --- View Switching ---
function showView(viewId) {
    document.querySelectorAll(".view").forEach(v => {
        v.classList.remove("active");
    });
    if (viewId === "login-view") {
        dom.loginView.classList.add("active");
    } else if (viewId === "dashboard-view") {
        dom.dashboardView.classList.add("active");
    }
}

// --- Auth Headers ---
const defGetHeaders = () => {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
    };
};

// --- Modal Helper Actions ---
document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-close");
        document.getElementById(modalId).classList.remove("active");
    });
});

function openModal(modal) {
    modal.classList.add("active");
}

function closeModal(modal) {
    modal.classList.remove("active");
}

// Custom Duration Toggle in Modal
dom.genDuration.addEventListener("change", () => {
    if (dom.genDuration.value === "custom") {
        dom.customDateGroup.classList.remove("hidden");
        dom.genCustomDate.required = true;
    } else {
        dom.customDateGroup.classList.add("hidden");
        dom.genCustomDate.required = false;
    }
});

// --- Confirmation Handler ---
let onConfirmCallback = null;
function showConfirmation(title, message, callback) {
    dom.confirmTitle.textContent = title;
    dom.confirmMessage.textContent = message;
    onConfirmCallback = callback;
    openModal(dom.confirmModal);
}

dom.btnConfirmYes.addEventListener("click", () => {
    if (onConfirmCallback) {
        onConfirmCallback();
    }
    closeModal(dom.confirmModal);
});

// --- Login Handler ---
dom.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    dom.loginError.classList.add("hidden");
    
    const username = dom.loginUsername.value.trim();
    const password = dom.loginPassword.value;
    
    console.log("Login form submitted for admin:", username);
    
    // UI Feedback: Loading state
    if (dom.btnLogin) {
        dom.btnLogin.disabled = true;
        dom.btnLogin.textContent = "LOGGING IN...";
    }
    
    try {
        console.log("Fetching login endpoint...");
        const response = await fetch(`${BACKEND_URL}/api/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        
        console.log("Response received. Status:", response.status);
        const data = await response.json();
        
        if (response.ok) {
            console.log("Login successful!");
            safeSetToken(data.access_token);
            dom.currentAdminDisplay.textContent = `🛡️ Admin: ${username}`;
            dom.loginPassword.value = ""; // clear password
            showView("dashboard-view");
            fetchKeys();
        } else {
            console.warn("Login failed with server error:", data.detail);
            dom.loginError.textContent = data.detail || "Invalid login credentials.";
            dom.loginError.classList.remove("hidden");
        }
    } catch (err) {
        console.error("Network error during login:", err);
        dom.loginError.textContent = "Error: Could not reach backend server.";
        dom.loginError.classList.remove("hidden");
    } finally {
        // Restore button state
        if (dom.btnLogin) {
            dom.btnLogin.disabled = false;
            dom.btnLogin.textContent = "LOG IN";
        }
    }
});

dom.btnLogout.addEventListener("click", () => {
    safeRemoveToken();
    keysData = [];
    showView("login-view");
});

// --- Fetch License Keys ---
async function fetchKeys() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/keys`, {
            method: "GET",
            headers: defGetHeaders()
        });
        
        if (response.ok) {
            keysData = await response.json();
            renderKeysTable(keysData);
            updateStats(keysData);
        } else if (response.status === 401) {
            // Token expired
            safeRemoveToken();
            showView("login-view");
        }
    } catch (err) {
        alert("Error loading license keys. Make sure backend is running.");
    }
}

// --- Render Table ---
function renderKeysTable(keys) {
    if (!keys || keys.length === 0) {
        dom.keysTbody.innerHTML = `<tr><td colspan="9" class="table-empty">No license keys found.</td></tr>`;
        return;
    }
    
    let html = "";
    keys.forEach(k => {
        // Expiration Date display formatting
        let expText = "Lifetime";
        let isExpired = false;
        if (k.expiration_date) {
            const expDate = new Date(k.expiration_date);
            expText = expDate.toLocaleString();
            isExpired = new Date() > expDate;
        }
        
        // Badge design
        let badgeClass = "badge-active";
        let badgeLabel = k.status;
        if (k.status === "paused") {
            badgeClass = "badge-paused";
        } else if (isExpired) {
            badgeClass = "badge-expired";
            badgeLabel = "expired";
        }
        
        const lastLoginText = k.last_login ? new Date(k.last_login).toLocaleString() : "Never";
        const hwidText = k.hwid ? k.hwid.substring(0, 16) + "..." : "<i>Unlocked</i>";
        const usernameText = k.username || "-";
        const notesText = k.notes || "Double-click to add...";
        
        // Toggle Status text
        const statusActionText = k.status === "active" ? "⏸️ Pause" : "▶️ Resume";
        
        html += `
            <tr data-key="${k.key}">
                <td><strong>${usernameText}</strong></td>
                <td><span class="key-cell">${k.key}</span></td>
                <td>${k.duration_type}</td>
                <td>${expText}</td>
                <td title="${k.hwid || 'No Device Registered'}">${hwidText}</td>
                <td>${lastLoginText}</td>
                <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
                <td class="notes-cell" title="Double click to edit notes" data-action="edit-notes">${notesText}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-secondary btn-small" data-action="toggle-status" data-status="${k.status}">${statusActionText}</button>
                        <button class="btn btn-success btn-small" data-action="reset-hwid" ${!k.hwid ? 'disabled' : ''}>Reset HWID</button>
                        <button class="btn btn-danger btn-small" data-action="delete">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    dom.keysTbody.innerHTML = html;
    attachTableEventHandlers();
}

// --- Table Action Listeners ---
function attachTableEventHandlers() {
    dom.keysTbody.querySelectorAll("tr").forEach(tr => {
        const key = tr.getAttribute("data-key");
        const kRecord = keysData.find(k => k.key === key);
        
        // Double click to edit notes
        tr.querySelector('[data-action="edit-notes"]').addEventListener("dblclick", () => {
            const currentNotes = kRecord.notes || "";
            const newNotes = prompt(`Edit notes for key ${key}:`, currentNotes);
            if (newNotes !== null) {
                updateNotes(key, newNotes.trim());
            }
        });
        
        // Toggle active/paused status
        tr.querySelector('[data-action="toggle-status"]').addEventListener("click", () => {
            const currentStatus = kRecord.status;
            const targetStatus = currentStatus === "active" ? "paused" : "active";
            updateKeyStatus(key, targetStatus);
        });
        
        // Reset HWID
        tr.querySelector('[data-action="reset-hwid"]').addEventListener("click", () => {
            showConfirmation(
                "Reset Hardware ID Lock",
                `Are you sure you want to clear the HWID lock for license key: ${key}? This will allow it to be registered to a different device on next login.`,
                () => { resetHwid(key); }
            );
        });
        
        // Delete Key
        tr.querySelector('[data-action="delete"]').addEventListener("click", () => {
            showConfirmation(
                "Delete License Key",
                `WARNING: Are you sure you want to permanently delete the license key: ${key}? This action is destructive and cannot be undone.`,
                () => { deleteKey(key); }
            );
        });
    });
}

// --- Update Stats Counters ---
function updateStats(keys) {
    dom.statTotal.textContent = keys.length;
    dom.statActive.textContent = keys.filter(k => k.status === "active").length;
    dom.statPaused.textContent = keys.filter(k => k.status === "paused").length;
}

// --- API Actions ---

async function updateKeyStatus(key, newStatus) {
    try {
        console.log(`Updating status for key ${key} to: ${newStatus}...`);
        const response = await fetch(`${BACKEND_URL}/api/admin/keys/${key}/status`, {
            method: "PUT",
            headers: defGetHeaders(),
            body: JSON.stringify({ status: newStatus })
        });
        if (response.ok) {
            console.log("Status updated successfully.");
            fetchKeys();
        } else {
            const data = await response.json().catch(() => ({}));
            console.warn("Failed to update status:", data);
            alert("Failed to update status: " + (data.detail || response.statusText));
        }
    } catch (err) {
        console.error("Network error in updateKeyStatus:", err);
        alert("Network error updating status: " + err.message);
    }
}

async function resetHwid(key) {
    try {
        console.log(`Resetting HWID for key ${key}...`);
        const response = await fetch(`${BACKEND_URL}/api/admin/keys/${key}/reset-hwid`, {
            method: "PUT",
            headers: defGetHeaders()
        });
        if (response.ok) {
            console.log("HWID reset successfully.");
            fetchKeys();
        } else {
            const data = await response.json().catch(() => ({}));
            console.warn("Failed to reset HWID:", data);
            alert("Failed to reset HWID: " + (data.detail || response.statusText));
        }
    } catch (err) {
        console.error("Network error in resetHwid:", err);
        alert("Network error resetting HWID: " + err.message);
    }
}

async function updateNotes(key, notes) {
    try {
        console.log(`Updating notes for key ${key}...`);
        const response = await fetch(`${BACKEND_URL}/api/admin/keys/${key}/notes`, {
            method: "PUT",
            headers: defGetHeaders(),
            body: JSON.stringify({ notes })
        });
        if (response.ok) {
            console.log("Notes updated successfully.");
            fetchKeys();
        } else {
            const data = await response.json().catch(() => ({}));
            console.warn("Failed to update notes:", data);
            alert("Failed to update notes: " + (data.detail || response.statusText));
        }
    } catch (err) {
        console.error("Network error in updateNotes:", err);
        alert("Network error updating notes: " + err.message);
    }
}

async function deleteKey(key) {
    try {
        console.log(`Deleting key ${key}...`);
        const response = await fetch(`${BACKEND_URL}/api/admin/keys/${key}`, {
            method: "DELETE",
            headers: defGetHeaders()
        });
        if (response.ok) {
            console.log("Key deleted successfully.");
            fetchKeys();
        } else {
            const data = await response.json().catch(() => ({}));
            console.warn("Failed to delete key:", data);
            alert("Failed to delete key: " + (data.detail || response.statusText));
        }
    } catch (err) {
        console.error("Network error in deleteKey:", err);
        alert("Network error deleting key: " + err.message);
    }
}

// --- Search / Filters (Client-side fast search) ---
dom.searchInput.addEventListener("input", () => {
    const term = dom.searchInput.value.toLowerCase().trim();
    if (!term) {
        renderKeysTable(keysData);
        return;
    }
    
    const filtered = keysData.filter(k => {
        return (
            (k.key && k.key.toLowerCase().includes(term)) ||
            (k.username && k.username.toLowerCase().includes(term)) ||
            (k.status && k.status.toLowerCase().includes(term)) ||
            (k.hwid && k.hwid.toLowerCase().includes(term))
        );
    });
    
    renderKeysTable(filtered);
});

// Refresh button
dom.btnRefresh.addEventListener("click", fetchKeys);

// --- Generate Keys ---
dom.btnOpenGenerate.addEventListener("click", () => {
    dom.generateForm.reset();
    dom.customDateGroup.classList.add("hidden");
    dom.genCustomDate.required = false;
    openModal(dom.generateModal);
});

dom.generateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const count = parseInt(dom.genCount.value) || 1;
    const duration_type = dom.genDuration.value;
    const username = dom.genUsername.value.trim() || null;
    const notes = dom.genNotes.value.trim() || null;
    
    let expiration_date = null;
    if (duration_type === "custom") {
        const dateVal = dom.genCustomDate.value;
        if (dateVal) {
            // Convert to ISO-8601 string
            expiration_date = new Date(dateVal).toISOString();
        }
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/keys/generate`, {
            method: "POST",
            headers: defGetHeaders(),
            body: JSON.stringify({
                duration_type,
                expiration_date,
                username,
                notes,
                count
            })
        });
        
        if (response.ok) {
            closeModal(dom.generateModal);
            fetchKeys();
        } else {
            const data = await response.json();
            alert("Failed to generate keys: " + (data.detail || "Error"));
        }
    } catch (err) {
        alert("Network error.");
    }
});

// --- Export CSV ---
dom.btnExportCsv.addEventListener("click", () => {
    if (keysData.length === 0) {
        alert("No key records available to export.");
        return;
    }
    
    // Construct CSV text
    const headers = ["Username", "License Key", "Duration Type", "Expiration Date", "Hardware ID", "Last Login", "Status", "Notes", "Created At"];
    let csvRows = [headers.join(",")];
    
    // Get currently filtered list if search term is active
    const term = dom.searchInput.value.toLowerCase().trim();
    const activeList = term ? keysData.filter(k => {
        return (
            (k.key && k.key.toLowerCase().includes(term)) ||
            (k.username && k.username.toLowerCase().includes(term)) ||
            (k.status && k.status.toLowerCase().includes(term)) ||
            (k.hwid && k.hwid.toLowerCase().includes(term))
        );
    }) : keysData;
    
    activeList.forEach(k => {
        const row = [
            `"${(k.username || "").replace(/"/g, '""')}"`,
            `"${k.key}"`,
            `"${k.duration_type}"`,
            `"${k.expiration_date || 'Lifetime'}"`,
            `"${k.hwid || ''}"`,
            `"${k.last_login || ''}"`,
            `"${k.status}"`,
            `"${(k.notes || "").replace(/"/g, '""')}"`,
            `"${k.created_at || ''}"`
        ];
        csvRows.push(row.join(","));
    });
    
    const csvContent = csvRows.join("\n");
    
    // Trigger download using a Blob
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `license_keys_export_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- View Activity Logs ---
dom.btnViewLogs.addEventListener("click", async () => {
    dom.logsTbody.innerHTML = `<tr><td colspan="5" class="table-empty">Fetching logs...</td></tr>`;
    openModal(dom.logsModal);
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/logs`, {
            method: "GET",
            headers: defGetHeaders()
        });
        
        if (response.ok) {
            const logs = await response.json();
            if (logs.length === 0) {
                dom.logsTbody.innerHTML = `<tr><td colspan="5" class="table-empty">No activity logs recorded.</td></tr>`;
                return;
            }
            
            let html = "";
            logs.forEach(l => {
                const timeStr = new Date(l.timestamp).toLocaleString();
                const detailsText = l.details || "-";
                html += `
                    <tr>
                        <td>${timeStr}</td>
                        <td><strong>${l.admin_username}</strong></td>
                        <td><span class="badge badge-active">${l.action}</span></td>
                        <td>${l.ip_address}</td>
                        <td>${detailsText}</td>
                    </tr>
                `;
            });
            dom.logsTbody.innerHTML = html;
        } else {
            dom.logsTbody.innerHTML = `<tr><td colspan="5" class="table-empty" style="color:var(--danger-color)">Failed to fetch logs from server.</td></tr>`;
        }
    } catch (err) {
        dom.logsTbody.innerHTML = `<tr><td colspan="5" class="table-empty" style="color:var(--danger-color)">Network error.</td></tr>`;
    }
});

// Initialize dashboard view on load if authenticated
window.addEventListener("DOMContentLoaded", () => {
    if (authToken) {
        showView("dashboard-view");
        fetchKeys();
    }
});
