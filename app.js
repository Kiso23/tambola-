// ⚠️ IMPORTANT: DO NOT hardcode credentials in source!
// Use environment variables (loaded from .env file)
// For now, using simple defaults - CHANGE IN PRODUCTION

// API Configuration - Points to backend server
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:3000'
    : 'https://tambola-j8p7.onrender.com';

const ADMIN_CREDENTIALS = { 
    username: localStorage.getItem('adminUsername') || 'admin', 
    password: localStorage.getItem('adminPassword') || 'admin123' 
};

const gameState = {
    role: null,
    playerName: null,
    playerId: null,
    gameId: null,
    ticket: null,
    markedNumbers: new Set(),
    calledNumbers: [],
    players: new Map(),
    lastNumber: null,
    winners: [],
    drawMode: 'auto',
    selectedTicketId: null,
    autoDrawInterval: null,
    autoDrawEnabled: false,
    playerNameForPayment: null,
    ticketForPayment: null
};

let ws = null;
let purchasedTickets = [];
let selectedSeatType = null;
let ticketsToBook = 1;
let selectedTickets = [];

// ===== PAGE LOADER =====
function showLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
        loader.classList.remove('hidden');
        loader.style.opacity = '1';
    }
}

function hideLoader() {
    setTimeout(() => {
        const loader = document.getElementById('pageLoader');
        if (loader) {
            loader.classList.add('hidden');
        }
    }, 300);
}

// ===== SCREEN NAVIGATION =====
function selectSeatType(seatType, quantity) {
    selectedSeatType = seatType;
    ticketsToBook = quantity;
    selectedTickets = [];
    
    const playerName = document.getElementById('purchasePlayerName').value.trim();
    const playerEmail = document.getElementById('purchasePlayerEmail').value.trim();
    
    if (!playerName) {
        showMessage('purchaseMessage', '❌ Please enter your name', 'error');
        return;
    }
    
    if (!playerEmail || !playerEmail.includes('@')) {
        showMessage('purchaseMessage', '❌ Please enter a valid email', 'error');
        return;
    }
    
    gameState.playerNameForPayment = playerName;
    gameState.playerEmailForPayment = playerEmail;
    gameState.seatType = seatType;
    gameState.ticketsToBook = quantity;
    
    // Update UI to show selected seat
    document.querySelectorAll('.seat-package-card').forEach(card => card.classList.remove('selected'));
    document.getElementById(seatType + 'SeatCard').classList.add('selected');
    
    // Load available tickets for this seat type
    loadAvailableTickets();
}

// ===== SCREEN NAVIGATION =====
function goToTicketPurchase() {
    showLoader();
    setTimeout(() => {
        document.getElementById('mainButtons').classList.add('hidden');
        // Show option to buy new or select existing
        document.getElementById('purchaseOptionsScreen').classList.remove('hidden');
        hideLoader();
    }, 400);
}

function goToPlayerLogin() {
    showLoader();
    setTimeout(() => {
        document.getElementById('mainButtons').classList.add('hidden');
        document.getElementById('playerLoginScreen').classList.remove('hidden');
        hideLoader();
    }, 400);
}

function goToAdminLogin() {
    showLoader();
    setTimeout(() => {
        document.getElementById('mainButtons').classList.add('hidden');
        document.getElementById('adminLoginScreen').classList.remove('hidden');
        hideLoader();
    }, 400);
}

function backToMain() {
    showLoader();
    setTimeout(() => {
        document.getElementById('ticketPurchaseScreen').classList.add('hidden');
        document.getElementById('ticketSuccessScreen').classList.add('hidden');
        document.getElementById('playerLoginScreen').classList.add('hidden');
        document.getElementById('selectTicketScreen').classList.add('hidden');
        document.getElementById('adminLoginScreen').classList.add('hidden');
        document.getElementById('adminScreen').classList.add('hidden');
        document.getElementById('playerScreen').classList.add('hidden');
        document.getElementById('purchaseOptionsScreen').classList.add('hidden');
        document.getElementById('selectPreGeneratedTicketScreen').classList.add('hidden');
        document.getElementById('paymentScreenshotScreen').classList.add('hidden');
        document.getElementById('mainButtons').classList.remove('hidden');
        clearMessages();
        hideLoader();
    }, 400);
}

function backToPlayerLogin() {
    showLoader();
    setTimeout(() => {
        document.getElementById('selectTicketScreen').classList.add('hidden');
        document.getElementById('playerLoginScreen').classList.remove('hidden');
        clearMessages();
        hideLoader();
    }, 400);
}

function clearMessages() {
    document.getElementById('purchaseMessage').innerHTML = '';
    document.getElementById('playerLoginMessage').innerHTML = '';
    document.getElementById('ticketSelectMessage').innerHTML = '';
    document.getElementById('adminLoginMessage').innerHTML = '';
}

// ===== TICKET PURCHASE FLOW =====
function generateTicket() {
    const columns = [
        { min: 1, max: 10 },
        { min: 11, max: 20 },
        { min: 21, max: 30 },
        { min: 31, max: 40 },
        { min: 41, max: 50 },
        { min: 51, max: 60 },
        { min: 61, max: 70 },
        { min: 71, max: 80 },
        { min: 81, max: 90 }
    ];

    const ticket = [];
    const used = new Set();

    for (let row = 0; row < 3; row++) {
        const rowNumbers = [];
        const colsUsed = new Set();

        while (colsUsed.size < 5) {
            colsUsed.add(Math.floor(Math.random() * 9));
        }

        const sortedCols = Array.from(colsUsed).sort((a, b) => a - b);

        for (let col = 0; col < 9; col++) {
            if (sortedCols.includes(col)) {
                const range = columns[col];
                let num;
                do {
                    num = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
                } while (used.has(num));
                used.add(num);
                rowNumbers.push(num);
            } else {
                rowNumbers.push(0);
            }
        }

        ticket[row] = rowNumbers;
    }

    return ticket;
}

function generateSuggestedNumbers() {
    const suggestedTicket = generateTicket();
    const suggested = [];
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
            if (suggestedTicket[row][col] !== 0) {
                suggested.push(suggestedTicket[row][col]);
            }
        }
    }
    gameState.ticket = suggestedTicket;

    const grid = document.getElementById('suggestedNumbers');
    grid.innerHTML = suggested.map(num => `<div class="number-chip">${num}</div>`).join('');
}

function generateNumberSelector() {
    const grid = document.getElementById('numberGrid');
    grid.innerHTML = '';
    for (let i = 1; i <= 90; i++) {
        const btn = document.createElement('div');
        btn.className = 'selector-number';
        btn.textContent = i;
        btn.onclick = () => selectNumber(i, btn);
        grid.appendChild(btn);
    }
}

let selectedCustomNumbers = new Set();

function selectNumber(num, element) {
    if (selectedCustomNumbers.has(num)) {
        selectedCustomNumbers.delete(num);
        element.classList.remove('selected');
    } else {
        if (selectedCustomNumbers.size < 15) {
            selectedCustomNumbers.add(num);
            element.classList.add('selected');
        }
    }

    document.getElementById('selectedCount').textContent = selectedCustomNumbers.size;

    if (selectedCustomNumbers.size === 15) {
        document.getElementById('confirmCustomBtn').disabled = false;
        document.getElementById('confirmCustomBtn').style.opacity = '1';
    } else {
        document.getElementById('confirmCustomBtn').disabled = true;
        document.getElementById('confirmCustomBtn').style.opacity = '0.5';
    }
}

function toggleCustomSelector() {
    const selector = document.getElementById('numberSelectorContainer');
    selector.classList.toggle('active');
    selectedCustomNumbers.clear();
    document.getElementById('selectedCount').textContent = '0';
    document.querySelectorAll('.selector-number').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('confirmCustomBtn').disabled = true;
    document.getElementById('confirmCustomBtn').style.opacity = '0.5';
}

function useSuggestedNumbers() {
    const playerName = document.getElementById('purchasePlayerName').value.trim();
    const playerEmail = document.getElementById('purchasePlayerEmail').value.trim();
    
    if (!playerName) {
        showMessage('purchaseMessage', '❌ Please enter your name', 'error');
        return;
    }
    
    if (!playerEmail || !playerEmail.includes('@')) {
        showMessage('purchaseMessage', '❌ Please enter a valid email address', 'error');
        return;
    }

    // Go to payment screen instead of direct purchase
    goToPaymentScreen(playerName, playerEmail, gameState.ticket);
}

function confirmCustomNumbers() {
    const playerName = document.getElementById('purchasePlayerName').value.trim();
    const playerEmail = document.getElementById('purchasePlayerEmail').value.trim();
    
    if (!playerName) {
        showMessage('purchaseMessage', '❌ Please enter your name', 'error');
        return;
    }
    
    if (!playerEmail || !playerEmail.includes('@')) {
        showMessage('purchaseMessage', '❌ Please enter a valid email address', 'error');
        return;
    }

    const customTicket = [[], [], []];
    const sortedNumbers = Array.from(selectedCustomNumbers).sort((a, b) => a - b);

    let numIndex = 0;
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
            if (numIndex < sortedNumbers.length && numIndex < row * 5 + 5) {
                customTicket[row][col] = sortedNumbers[numIndex];
                numIndex++;
            } else {
                customTicket[row][col] = 0;
            }
        }
    }

    // Go to payment screen
    goToPaymentScreen(playerName, playerEmail, customTicket);
}

function goToPaymentScreen(playerName, playerEmail, ticket) {
    showLoader();
    setTimeout(() => {
        gameState.playerNameForPayment = playerName;
        gameState.playerEmailForPayment = playerEmail;
        gameState.ticketForPayment = ticket;
        
        document.getElementById('ticketPurchaseScreen').classList.add('hidden');
        document.getElementById('paymentScreenshotScreen').classList.remove('hidden');
        hideLoader();
    }, 400);
}

function backToTicketPurchase() {
    showLoader();
    setTimeout(() => {
        document.getElementById('paymentScreenshotScreen').classList.add('hidden');
        document.getElementById('selectPreGeneratedTicketScreen').classList.add('hidden');
        document.getElementById('ticketPurchaseScreen').classList.add('hidden');
        document.getElementById('purchaseOptionsScreen').classList.remove('hidden');
        hideLoader();
    }, 400);
}

function copyUPI() {
    navigator.clipboard.writeText('asha22@slc');
    showMessage('paymentMessage', '✅ UPI ID copied!', 'success');
}

function openPaymentApp(app) {
    const upiId = 'asha22@slc';
    const amount = 100;
    const desc = 'Winter Bumper Ticket';
    
    if (app === 'upi') {
        // UPI deep link format
        const upiLink = `upi://pay?pa=${upiId}&pn=WinterBumper&am=${amount}&tn=${desc}`;
        window.location.href = upiLink;
    } else if (app === 'phonepe') {
        // PhonePe deep link
        const phonepeLink = `phonepe://pay?to=${upiId}&amount=${amount}&note=${desc}`;
        window.location.href = phonepeLink;
    }
}

function previewScreenshot(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('previewImg').src = e.target.result;
            document.getElementById('screenshotPreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function submitPaymentAndGetTicket() {
    const fileInput = document.getElementById('paymentScreenshot');
    if (!fileInput.files.length) {
        showMessage('paymentMessage', '❌ Please upload payment screenshot', 'error');
        return;
    }

    showLoader();
    const playerName = gameState.playerNameForPayment;
    const playerEmail = gameState.playerEmailForPayment;
    const file = fileInput.files[0];

    // Validate required fields
    if (!playerName || !playerEmail) {
        hideLoader();
        console.error('Missing fields in payment:', {
            playerName,
            playerEmail,
            gameState: gameState
        });
        showMessage('paymentMessage', '❌ Missing player name or email. Please go back and reselect tickets.', 'error');
        return;
    }

    if (!gameState.bookedTickets || gameState.bookedTickets.length === 0) {
        hideLoader();
        console.error('No booked tickets found:', gameState.bookedTickets);
        showMessage('paymentMessage', '❌ No booked tickets found. Please select and book tickets first.', 'error');
        return;
    }

    // Convert screenshot to base64
    const reader = new FileReader();
    reader.onload = (e) => {
        const screenshotBase64 = e.target.result;

        // Submit payment for verification (using first booked ticket ID)
        const ticketId = gameState.bookedTickets[0].id;
        
        fetch(`${API_BASE_URL}/api/submit-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerName: playerName,
                playerEmail: playerEmail,
                ticketId: ticketId,
                screenshotBase64: screenshotBase64
            })
        })
        .then(res => res.json())
        .then(data => {
            hideLoader();
            if (data.success) {
                showMessage('paymentMessage', '✅ ' + data.message, 'success');
                setTimeout(() => {
                    showTicketSuccess(playerName, null);
                }, 1500);
            } else {
                showMessage('paymentMessage', '❌ ' + (data.error || 'Payment submission failed'), 'error');
            }
        })
        .catch(err => {
            hideLoader();
            showMessage('paymentMessage', '❌ Error: ' + err.message, 'error');
        });
    };

    reader.readAsDataURL(file);
}

function showTicketSuccess(playerName, ticket) {
    document.getElementById('paymentScreenshotScreen').classList.add('hidden');
    document.getElementById('ticketSuccessScreen').classList.remove('hidden');

    // If no ticket passed, try to get from gameState
    if (!ticket && gameState.bookedTickets && gameState.bookedTickets.length > 0) {
        ticket = gameState.bookedTickets[0].ticket;
    }

    let numbersText = 'Payment submitted successfully!';
    if (ticket && Array.isArray(ticket)) {
        const numbers = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 9; col++) {
                if (ticket[row][col] !== 0) {
                    numbers.push(ticket[row][col]);
                }
            }
        }
        numbersText = 'Numbers: ' + numbers.join(', ');
    }

    // Show how many tickets were booked
    let countText = '';
    if (gameState.bookedTickets && gameState.bookedTickets.length > 0) {
        const ticketCount = gameState.bookedTickets.length;
        countText = `\n✓ ${ticketCount} ticket(s) booked and payment submitted for verification.\nAdmin will confirm and send email confirmation.`;
    }

    document.getElementById('successPlayerName').textContent = playerName;
    document.getElementById('successTicketInfo').textContent = numbersText + countText;
}

function buyAnotherTicket() {
    showLoader();
    setTimeout(() => {
        document.getElementById('ticketSuccessScreen').classList.add('hidden');
        document.getElementById('ticketPurchaseScreen').classList.remove('hidden');
        document.getElementById('purchasePlayerName').value = '';
        document.getElementById('numberSelectorContainer').classList.remove('active');
        generateSuggestedNumbers();
        hideLoader();
    }, 400);
}

// ===== PLAYER LOGIN FLOW =====
function searchPlayerTickets() {
    const playerName = document.getElementById('playerLoginName').value.trim();
    if (!playerName) {
        showMessage('playerLoginMessage', '❌ Please enter your name', 'error');
        return;
    }

    showLoader();
    fetch(`/api/player-tickets/${playerName}`)
        .then(res => res.json())
        .then(data => {
            hideLoader();
            if (data.tickets && data.tickets.length > 0) {
                showTicketSelection(playerName, data.tickets);
            } else {
                showMessage('playerLoginMessage', '❌ No tickets found for this name. Buy a ticket first!', 'error');
            }
        })
        .catch(err => {
            hideLoader();
            console.error(err);
            showMessage('playerLoginMessage', '❌ Error retrieving tickets', 'error');
        });
}

// Load available pre-generated tickets for selection
function loadAvailableTickets() {
    showLoader();
    fetch(`${API_BASE_URL}/api/available-tickets`)
        .then(res => res.json())
        .then(data => {
            hideLoader();
            displayAvailableTickets(data.tickets || []);
        })
        .catch(err => {
            hideLoader();
            console.error('Error loading tickets:', err);
            showMessage('purchaseMessage', '❌ Error loading tickets', 'error');
        });
}

function displayAvailableTickets(tickets) {
    document.getElementById('purchaseOptionsScreen').classList.add('hidden');
    document.getElementById('selectPreGeneratedTicketScreen').classList.remove('hidden');
    
    // Update title to show how many tickets to select
    const titleDiv = document.querySelector('#selectPreGeneratedTicketScreen .purchase-title');
    if (titleDiv) {
        titleDiv.innerHTML = `<i class="fas fa-ticket-alt"></i> SELECT ${ticketsToBook} TICKET(S) FOR ${gameState.seatType.toUpperCase()} SEAT`;
    }
    
    const grid = document.getElementById('preGeneratedTicketsGrid');
    grid.innerHTML = '';
    
    tickets.forEach((ticket, idx) => {
        const div = document.createElement('div');
        div.className = 'tambola-ticket-card';
        if (ticket.isBooked) div.classList.add('booked');
        
        // Get serial number in format A01, A02, etc
        const serialNum = String(ticket.serialnumber || ticket.serialNumber).padStart(2, '0');
        const serialCode = 'A' + serialNum;
        
        // Create professional ticket display
        let ticketHTML = `
            <div class="ticket-status-top">
                ${ticket.isBooked ? `<div class="ticket-booked-top">✓ BOOKED</div>` : `<div class="ticket-select-top">☐ Select</div>`}
            </div>
            
            <div class="ticket-main-content">
                <div class="ticket-header-top">#WinterBumper</div>
                
                <div class="ticket-player-info">
                    <div class="ticket-player-name">${ticket.isBooked ? '#' + ticket.playerName : '#PlayerName'}</div>
                    <div class="ticket-serial">${serialCode}</div>
                </div>
                
                <div class="ticket-grid-display">
        `;
        
        // Add 3x9 grid - ALL 9 cells per row
        for (let row = 0; row < 3; row++) {
            ticketHTML += '<div class="ticket-row">';
            for (let col = 0; col < 9; col++) {
                const num = ticket.ticket[row][col];
                const isEmpty = num === 0;
                ticketHTML += `<div class="ticket-cell ${isEmpty ? 'empty' : 'filled'}">${isEmpty ? '' : num}</div>`;
            }
            ticketHTML += '</div>';
        }
        
        ticketHTML += `
                </div>
                
                <div class="ticket-footer-text">#WinterBumper</div>
            </div>
            
            <div class="ticket-status-bottom">
                ${ticket.isBooked ? `<div class="ticket-booked-bottom">✓ BOOKED</div>` : `<div class="ticket-select-bottom" id="checkbox-${ticket.id}">☐ Select</div>`}
            </div>
        `;
        
        div.innerHTML = ticketHTML;
        
        if (!ticket.isBooked) {
            div.onclick = () => toggleTicketSelection(ticket, div);
            div.style.cursor = 'pointer';
        }
        
        grid.appendChild(div);
    });
    
    updateBookButtonState();
}

function toggleTicketSelection(ticket, element) {
    const isSelected = selectedTickets.some(t => t.id === ticket.id);
    
    if (isSelected) {
        selectedTickets = selectedTickets.filter(t => t.id !== ticket.id);
        element.classList.remove('selected');
        const checkbox = element.querySelector('.ticket-select-checkbox');
        if (checkbox) checkbox.textContent = '☐ Select';
    } else {
        if (selectedTickets.length < ticketsToBook) {
            selectedTickets.push(ticket);
            element.classList.add('selected');
            const checkbox = element.querySelector('.ticket-select-checkbox');
            if (checkbox) checkbox.textContent = '☑ Selected';
        } else {
            showMessage('purchaseMessage', `❌ You can only select ${ticketsToBook} ticket(s) for this seat`, 'error');
        }
    }
    
    updateBookButtonState();
}

function updateBookButtonState() {
    const bookBtn = document.getElementById('bookTicketBtn');
    if (selectedTickets.length === ticketsToBook) {
        bookBtn.disabled = false;
        bookBtn.style.opacity = '1';
        bookBtn.innerHTML = `<i class="fas fa-check"></i> Book ${ticketsToBook} Ticket(s)`;
    } else {
        bookBtn.disabled = true;
        bookBtn.style.opacity = '0.5';
        bookBtn.innerHTML = `<i class="fas fa-check"></i> Select ${ticketsToBook - selectedTickets.length} more`;
    }
}

function bookPreGeneratedTicket() {
    if (selectedTickets.length !== ticketsToBook) {
        showMessage('purchaseMessage', `❌ Please select exactly ${ticketsToBook} ticket(s)`, 'error');
        return;
    }
    
    const playerName = gameState.playerNameForPayment;
    const playerEmail = gameState.playerEmailForPayment;
    
    // Validate player data exists
    if (!playerName || !playerEmail) {
        console.error('Missing player data:', { playerName, playerEmail });
        showMessage('purchaseMessage', '❌ Player name or email missing. Please go back and reselect your seat.', 'error');
        return;
    }
    
    showLoader();
    
    // Book all selected tickets
    Promise.all(selectedTickets.map(ticket =>
        fetch(`${API_BASE_URL}/api/book-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticketId: ticket.id,
                playerName,
                playerEmail
            })
        }).then(res => res.json())
    ))
    .then(results => {
        hideLoader();
        
        // Check if all bookings succeeded
        const allSuccess = results.every(r => r.success);
        if (allSuccess) {
            // Store the full booking results with ID
            gameState.bookedTickets = results;
            console.log('Booked tickets:', gameState.bookedTickets);
            showMessage('purchaseMessage', `✅ ${ticketsToBook} ticket(s) booked successfully!`, 'success');
            setTimeout(() => {
                goToPaymentScreenAfterBooking(playerName, playerEmail);
            }, 1000);
        } else {
            const errors = results.filter(r => !r.success).map(r => r.error).join(', ');
            showMessage('purchaseMessage', `❌ Booking failed: ${errors}`, 'error');
            setTimeout(() => loadAvailableTickets(), 1500);
        }
    })
    .catch(err => {
        hideLoader();
        console.error('Booking error:', err);
        showMessage('purchaseMessage', '❌ Error booking tickets: ' + err.message, 'error');
    });
}

function goToPaymentScreenAfterBooking(playerName, playerEmail) {
    // Ensure player data is preserved in gameState
    gameState.playerNameForPayment = playerName;
    gameState.playerEmailForPayment = playerEmail;
    
    showLoader();
    setTimeout(() => {
        document.getElementById('selectPreGeneratedTicketScreen').classList.add('hidden');
        document.getElementById('paymentScreenshotScreen').classList.remove('hidden');
        
        // Update payment screen to show number of tickets
        const paymentTitle = document.querySelector('#paymentScreenshotScreen h2') || {};
        if (paymentTitle.textContent) {
            paymentTitle.textContent = `Submit Payment for ${ticketsToBook} Ticket(s)`;
        }
        
        hideLoader();
    }, 400);
}

function selectPreGeneratedTicket(ticket, playerName, playerEmail) {
    // This function is no longer used in multi-ticket mode
}

function goToCreateCustomTicket() {
    showLoader();
    setTimeout(() => {
        document.getElementById('purchaseOptionsScreen').classList.add('hidden');
        document.getElementById('ticketPurchaseScreen').classList.remove('hidden');
        generateSuggestedNumbers();
        generateNumberSelector();
        hideLoader();
    }, 400);
}

function showTicketSelection(playerName, tickets) {
    gameState.playerName = playerName;
    document.getElementById('playerLoginScreen').classList.add('hidden');
    document.getElementById('selectTicketScreen').classList.remove('hidden');
    document.getElementById('ticketScreenPlayerName').textContent = playerName;

    const list = document.getElementById('ticketsList');
    list.innerHTML = tickets.map((t, idx) => `
        <div class="ticket-item" id="ticket-${t.id}" onclick="selectTicket(${t.id})">
            <div class="ticket-item-header">
                <span class="ticket-item-id">Ticket ${idx + 1}</span>
                <span class="ticket-item-date">${new Date(t.purchasedAt).toLocaleDateString()}</span>
            </div>
            <div class="ticket-item-numbers">
                ${t.ticket.flat().map(num => `
                    <div class="ticket-item-num ${num === 0 ? 'empty' : ''}">${num || ''}</div>
                `).join('')}
            </div>
        </div>
    `).join('');

    purchasedTickets = tickets;
}

function selectTicket(ticketId) {
    gameState.selectedTicketId = ticketId;
    document.querySelectorAll('.ticket-item').forEach(el => el.classList.remove('selected'));
    document.getElementById(`ticket-${ticketId}`).classList.add('selected');

    // Enable button immediately
    const joinBtn = document.getElementById('joinGameBtn');
    joinBtn.disabled = false;
    joinBtn.style.opacity = '1';
    joinBtn.style.cursor = 'pointer';
    
    checkJoinButtonState();
}

function checkJoinButtonState() {
    const gameCodeInput = document.getElementById('gameCodeInput');
    const joinBtn = document.getElementById('joinGameBtn');
    
    if (gameState.selectedTicketId && gameCodeInput.value.trim()) {
        joinBtn.disabled = false;
        joinBtn.style.opacity = '1';
        joinBtn.style.cursor = 'pointer';
    } else {
        joinBtn.disabled = true;
        joinBtn.style.opacity = '0.5';
        joinBtn.style.cursor = 'not-allowed';
    }
}

function joinGame() {
    const gameCode = document.getElementById('gameCodeInput').value.trim();
    
    if (!gameCode) {
        showMessage('ticketSelectMessage', '❌ Please enter a game code', 'error');
        return;
    }

    if (!gameState.selectedTicketId) {
        showMessage('ticketSelectMessage', '❌ Please select a ticket', 'error');
        return;
    }

    const selectedTicket = purchasedTickets.find(t => t.id === gameState.selectedTicketId);
    if (!selectedTicket) {
        showMessage('ticketSelectMessage', '❌ Ticket not found', 'error');
        return;
    }

    showLoader();
    fetch(`${API_BASE_URL}/api/use-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            playerName: gameState.playerName, 
            ticketId: gameState.selectedTicketId 
        })
    })
    .then(res => res.json())
    .then(data => {
        hideLoader();
        if (data.success) {
            startPlayerGame(gameCode, gameState.playerName, data.ticket);
        } else {
            showMessage('ticketSelectMessage', '❌ ' + (data.error || 'Error using ticket'), 'error');
        }
    })
    .catch(err => {
        hideLoader();
        console.error('Join game error:', err);
        showMessage('ticketSelectMessage', '❌ Error joining game: ' + err.message, 'error');
    });
}

function startPlayerGame(gameCode, playerName, ticket) {
    gameState.role = 'player';
    gameState.gameId = gameCode;
    gameState.playerId = generateId();
    gameState.ticket = ticket;
    gameState.markedNumbers.clear();
    gameState.calledNumbers = [];

    document.getElementById('selectTicketScreen').classList.add('hidden');
    document.getElementById('playerScreen').classList.remove('hidden');

    updateTicketDisplay();
    connectWebSocket();
}

// ===== ADMIN LOGIN FLOW =====
function handleAdminLogin() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();

    if (!username || !password) {
        showMessage('adminLoginMessage', '❌ Please enter both username and password', 'error');
        return;
    }

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        startAdminGame();
    } else {
        showMessage('adminLoginMessage', '❌ Invalid credentials', 'error');
        document.getElementById('adminPassword').value = '';
    }
}

function startAdminGame() {
    showLoader();
    setTimeout(() => {
        gameState.role = 'admin';
        gameState.gameId = generateGameId();
        gameState.playerId = generateId();
        gameState.drawMode = 'auto';
        gameState.adminGameCode = gameState.gameId;

        document.getElementById('adminLoginScreen').classList.add('hidden');
        document.getElementById('adminScreen').classList.remove('hidden');
        document.getElementById('codeDisplay').textContent = gameState.gameId;

        setMode('auto');
        connectWebSocket();
        hideLoader();
    }, 400);
}

function switchAdminTab(tab) {
    const hostTab = document.getElementById('hostTab');
    const ticketTab = document.getElementById('ticketTab');
    const hostBtn = document.getElementById('hostTabBtn');
    const ticketBtn = document.getElementById('ticketTabBtn');
    
    if (tab === 'host') {
        hostTab.classList.remove('hidden');
        ticketTab.classList.add('hidden');
        hostBtn.style.background = 'linear-gradient(135deg, var(--danger), #C0392B)';
        hostBtn.style.color = 'white';
        ticketBtn.style.background = '#ccc';
        ticketBtn.style.color = 'var(--dark)';
    } else {
        hostTab.classList.add('hidden');
        ticketTab.classList.remove('hidden');
        hostBtn.style.background = '#ccc';
        hostBtn.style.color = 'var(--dark)';
        ticketBtn.style.background = 'linear-gradient(135deg, var(--success), #1E8449)';
        ticketBtn.style.color = 'white';
        loadPendingPayments();
    }
}

function loadPendingPayments() {
    fetch(`${API_BASE_URL}/api/pending-payments`)
        .then(res => res.json())
        .then(data => {
            displayPendingPayments(data.pendingPayments || []);
        })
        .catch(err => {
            console.error('Error loading pending payments:', err);
            document.getElementById('pendingPaymentsContainer').innerHTML = '<p style="text-align: center; color: #999;">Error loading payments</p>';
        });
}

function displayPendingPayments(payments) {
    const container = document.getElementById('pendingPaymentsContainer');
    const noMessage = document.getElementById('noPendingMessage');
    
    if (payments.length === 0) {
        container.innerHTML = '';
        noMessage.style.display = 'block';
        return;
    }
    
    noMessage.style.display = 'none';
    
    container.innerHTML = payments.map((payment, idx) => {
        const playerName = payment.playername || payment.playerName || 'Unknown';
        const playerEmail = payment.playeremail || payment.playerEmail || 'unknown@email.com';
        const ticketId = payment.ticketid || payment.ticketId || 0;
        const paymentId = payment.id || 0;
        const screenshot = payment.paymentscreenshot || payment.paymentScreenshot || '';
        const submitted = payment.submittedat || payment.submittedAt || new Date().toISOString();
        
        return `
        <div style="background: #f8f9fa; border-left: 5px solid #FF9800; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">
                <!-- Left: Player Info -->
                <div>
                    <h3 style="color: var(--dark); margin: 0 0 15px 0; font-size: 1.2em;">
                        <i class="fas fa-user-circle"></i> ${playerName}
                    </h3>
                    <p style="color: #666; margin: 8px 0; font-size: 0.95em;">
                        <strong>Email:</strong> ${playerEmail}
                    </p>
                    <p style="color: #666; margin: 8px 0; font-size: 0.95em;">
                        <strong>Ticket ID:</strong> #${ticketId}
                    </p>
                    <p style="color: #999; margin: 8px 0; font-size: 0.85em;">
                        Submitted: ${new Date(submitted).toLocaleString()}
                    </p>
                    <div style="margin-top: 15px;">
                        <span style="display: inline-block; background: #FFC107; color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 700;">
                            ⏳ PENDING
                        </span>
                    </div>
                </div>
                
                <!-- Right: Screenshot Preview & Action Buttons -->
                <div>
                    <p style="color: #666; margin: 0 0 10px 0; font-size: 0.9em; font-weight: 700;">📸 Payment Screenshot:</p>
                    ${screenshot ? `
                        <img src="${screenshot}" style="width: 100%; max-height: 200px; border-radius: 8px; object-fit: contain; margin-bottom: 15px; border: 2px solid #ddd;">
                    ` : '<div style="background: #e0e0e0; padding: 30px; text-align: center; border-radius: 8px; color: #999;">No screenshot</div>'}
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button onclick="approvePayment(${paymentId}, ${ticketId}, '${playerEmail}', '${playerName}')" 
                            style="padding: 12px; background: linear-gradient(135deg, var(--success), #1E8449); color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.3s ease;">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button onclick="rejectPayment(${paymentId}, ${ticketId}, '${playerEmail}', '${playerName}')" 
                            style="padding: 12px; background: linear-gradient(135deg, var(--danger), #C0392B); color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.3s ease;">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function approvePayment(verificationId, ticketId, playerEmail, playerName) {
    const notes = prompt('Add notes (optional):') || 'Payment verified successfully';
    
    if (notes === null) return; // User cancelled
    
    // Fetch the ticket data to get ticket numbers
    fetch(`/api/get-ticket-data/${ticketId}`)
        .then(res => {
            if (!res.ok) throw new Error('Ticket not found');
            return res.json();
        })
        .then(data => {
            const ticket = data.ticket || [];
            
            return fetch(`${API_BASE_URL}/api/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    verificationId: parseInt(verificationId),
                    ticketId: parseInt(ticketId),
                    playerEmail,
                    playerName,
                    approved: true,
                    notes,
                    ticket
                })
            });
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showPlayerMessage(`✅ ${data.message}`, 'success');
                setTimeout(() => loadPendingPayments(), 1000);
            } else {
                showPlayerMessage(`❌ ${data.error}`, 'error');
            }
        })
        .catch(err => {
            showPlayerMessage(`❌ Error: ${err.message}`, 'error');
        });
}

function rejectPayment(verificationId, ticketId, playerEmail, playerName) {
    const reason = prompt('Reason for rejection:');
    
    if (reason === null) return; // User cancelled
    
    fetch(`${API_BASE_URL}/api/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            verificationId: parseInt(verificationId),
            ticketId: parseInt(ticketId),
            playerEmail,
            playerName,
            approved: false,
            notes: reason || 'No reason provided',
            ticket: []
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showPlayerMessage(`✅ Payment rejected and email sent`, 'success');
            setTimeout(() => loadPendingPayments(), 1000);
        } else {
            showPlayerMessage(`❌ ${data.error}`, 'error');
        }
    })
    .catch(err => {
        showPlayerMessage(`❌ Error: ${err.message}`, 'error');
    });
}

// ===== WEBSOCKET =====
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
        ws.send(JSON.stringify({
            type: gameState.role === 'admin' ? 'create_game' : 'join_game',
            gameId: gameState.gameId,
            playerId: gameState.playerId,
            playerName: gameState.playerName,
            ticket: gameState.ticket
        }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };

    ws.onerror = (err) => {
        console.error('Connection error:', err);
    };
}

function handleMessage(msg) {
    if (msg.type === 'player_joined') {
        gameState.players.set(msg.playerId, msg.playerName);
        updatePlayerLists();
    }

    if (msg.type === 'number_announced') {
        gameState.lastNumber = msg.number;
        gameState.calledNumbers.push(msg.number);

        if (gameState.role === 'admin') {
            document.getElementById('displayNumber').textContent = msg.number;
            document.getElementById('callCount').textContent = gameState.calledNumbers.length;
            document.getElementById('numbersCalledAdmin').textContent = gameState.calledNumbers.length;
            updateCalledNumbers();
        } else {
            autoMarkTicket(msg.number);
            document.getElementById('numbersCalled').textContent = gameState.calledNumbers.length;
            updateCalledNumbers();
        }

        speakNumber(msg.number);
    }

    if (msg.type === 'player_count') {
        gameState.players = new Map(msg.players.map(p => [p.id, p.name]));
        updatePlayerLists();
        if (document.getElementById('playerCountAdmin')) {
            document.getElementById('playerCountAdmin').textContent = msg.players.length;
        }
        if (document.getElementById('playerCount')) {
            document.getElementById('playerCount').textContent = msg.players.length;
        }
    }

    if (msg.type === 'winner_announced') {
        gameState.winners.push({ 
            name: msg.playerName, 
            type: msg.winType,
            tieDetected: msg.tieDetected,
            tieCount: msg.tieCount,
            tieWinners: msg.tieWinners
        });
        updateWinners();
        
        if (msg.tieDetected) {
            showPlayerMessage(
                `🏆 TIE! Prize split equally among ${msg.tieCount} winners: ${msg.tieWinners.join(', ')}`,
                'success'
            );
        } else {
            showPlayerMessage(`🏆 ${msg.playerName} wins ${msg.winType}!`, 'success');
        }
    }
}

// ===== ADMIN FUNCTIONS =====
function setMode(mode) {
    gameState.drawMode = mode;

    const autoBtn = document.getElementById('autoModeBtn');
    const manualBtn = document.getElementById('manualModeBtn');
    const autoSection = document.getElementById('autoSection');
    const manualSection = document.getElementById('manualSection');

    if (mode === 'auto') {
        autoBtn.style.background = 'linear-gradient(135deg, var(--success), #1E8449)';
        autoBtn.style.color = 'white';
        manualBtn.style.background = '#ccc';
        manualBtn.style.color = 'var(--dark)';
        autoSection.classList.remove('hidden');
        manualSection.classList.add('hidden');
        
        // Reset buttons for auto mode
        resetAutoDrawButtons();
    } else {
        autoBtn.style.background = '#ccc';
        autoBtn.style.color = 'var(--dark)';
        manualBtn.style.background = 'linear-gradient(135deg, var(--danger), #C0392B)';
        manualBtn.style.color = 'white';
        autoSection.classList.add('hidden');
        manualSection.classList.remove('hidden');
        document.getElementById('numberInput').focus();
        
        // Stop auto-draw when switching to manual
        stopAutoDrawTimer();
    }
}

function resetAutoDrawButtons() {
    // Reset to START state
    document.getElementById('startBtn').disabled = false;
    document.getElementById('startBtn').style.opacity = '1';
    document.getElementById('startBtn').style.cursor = 'pointer';
    
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('pauseBtn').style.opacity = '0.5';
    document.getElementById('pauseBtn').style.cursor = 'not-allowed';
    
    document.getElementById('resumeBtn').disabled = true;
    document.getElementById('resumeBtn').style.opacity = '0.5';
    document.getElementById('resumeBtn').style.cursor = 'not-allowed';
    
    stopAutoDrawTimer();
}

function startAutoDraws() {
    gameState.autoDrawEnabled = true;
    
    // Draw first number after 1 second
    setTimeout(() => {
        if (ws && gameState.autoDrawEnabled) {
            drawAuto();
        }
    }, 1000);
    
    // Then draw every 4 seconds
    gameState.autoDrawInterval = setInterval(() => {
        if (ws && gameState.autoDrawEnabled && gameState.drawMode === 'auto') {
            drawAuto();
        }
    }, 4000);
    
    // Update button states
    document.getElementById('startBtn').disabled = true;
    document.getElementById('startBtn').style.opacity = '0.5';
    document.getElementById('startBtn').style.cursor = 'not-allowed';
    
    document.getElementById('pauseBtn').disabled = false;
    document.getElementById('pauseBtn').style.opacity = '1';
    document.getElementById('pauseBtn').style.cursor = 'pointer';
}

function startAutoDrawTimer() {
    // This is now called by startAutoDraws button
    // Keeping for compatibility
}

function stopAutoDrawTimer() {
    gameState.autoDrawEnabled = false;
    if (gameState.autoDrawInterval) {
        clearInterval(gameState.autoDrawInterval);
        gameState.autoDrawInterval = null;
    }
}

function pauseAutoDraws() {
    gameState.autoDrawEnabled = false;
    if (gameState.autoDrawInterval) {
        clearInterval(gameState.autoDrawInterval);
        gameState.autoDrawInterval = null;
    }
    
    // Update button states
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('pauseBtn').style.opacity = '0.5';
    document.getElementById('pauseBtn').style.cursor = 'not-allowed';
    
    document.getElementById('resumeBtn').disabled = false;
    document.getElementById('resumeBtn').style.opacity = '1';
    document.getElementById('resumeBtn').style.cursor = 'pointer';
}

function resumeAutoDraws() {
    gameState.autoDrawEnabled = true;
    
    // Draw immediately
    if (ws) {
        drawAuto();
    }
    
    // Then draw every 4 seconds
    gameState.autoDrawInterval = setInterval(() => {
        if (ws && gameState.autoDrawEnabled && gameState.drawMode === 'auto') {
            drawAuto();
        }
    }, 4000);
    
    // Update button states
    document.getElementById('pauseBtn').disabled = false;
    document.getElementById('pauseBtn').style.opacity = '1';
    document.getElementById('pauseBtn').style.cursor = 'pointer';
    
    document.getElementById('resumeBtn').disabled = true;
    document.getElementById('resumeBtn').style.opacity = '0.5';
    document.getElementById('resumeBtn').style.cursor = 'not-allowed';
}

function drawAuto() {
    if (!ws) return; // Safety check
    
    const unused = [];
    for (let i = 1; i <= 90; i++) {
        if (!gameState.calledNumbers.includes(i)) {
            unused.push(i);
        }
    }

    if (unused.length === 0) {
        stopAutoDrawTimer();
        alert('All numbers drawn!');
        return;
    }

    const num = unused[Math.floor(Math.random() * unused.length)];
    ws.send(JSON.stringify({
        type: 'announce_number',
        gameId: gameState.gameId,
        number: num
    }));
}

function announceNumber() {
    const input = document.getElementById('numberInput');
    const num = parseInt(input.value);

    if (!num || num < 1 || num > 90) {
        alert('Enter valid number (1-90)');
        return;
    }

    if (gameState.calledNumbers.includes(num)) {
        alert('Number already called');
        return;
    }

    ws.send(JSON.stringify({
        type: 'announce_number',
        gameId: gameState.gameId,
        number: num
    }));

    input.value = '';
    input.focus();
}

function copyCode() {
    navigator.clipboard.writeText(gameState.gameId);
    alert('Game code copied!');
}

// NEW: Allow admin to join their own game as a player
function adminJoinAsPlayer() {
    const playerName = prompt('Enter your name to play:');
    if (!playerName || !playerName.trim()) {
        alert('Name required to play');
        return;
    }

    // Admin can directly join game (no ticket purchase needed now)
    showLoader();
    joinGameAsAdmin(gameState.gameId, playerName.trim());
}

function joinGameAsAdmin(gameCode, playerName) {
    showLoader();
    fetch(`/api/player-tickets/${playerName}`)
        .then(res => res.json())
        .then(data => {
            hideLoader();
            if (data.tickets && data.tickets.length > 0) {
                const ticket = data.tickets[0];
                
                // Create a second WebSocket connection for player
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const playerWs = new WebSocket(`${protocol}//${window.location.host}`);

                playerWs.onopen = () => {
                    playerWs.send(JSON.stringify({
                        type: 'join_game',
                        gameId: gameCode,
                        playerId: generateId() + '_admin_player',
                        playerName: playerName,
                        ticket: ticket.ticket
                    }));
                };

                playerWs.onmessage = (event) => {
                    // Handle player messages (for when admin plays)
                    const msg = JSON.parse(event.data);
                    handlePlayerMessage(msg);
                };

                alert(`✅ You're now playing as "${playerName}" in game ${gameCode}!\n\nYou can see your ticket in a new view. Keep the admin panel open to manage the game.`);
            } else {
                alert('Error retrieving ticket');
            }
        })
        .catch(err => {
            hideLoader();
            console.error(err);
            alert('Error joining game');
        });
}

function handlePlayerMessage(msg) {
    // Similar to handleMessage but for admin playing as player
    if (msg.type === 'number_announced') {
        gameState.lastNumber = msg.number;
        gameState.calledNumbers.push(msg.number);
        autoMarkTicket(msg.number);
        // Could show a notification that admin marked a number
    }
}

// ===== PLAYER FUNCTIONS =====
function autoMarkTicket(num) {
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
            if (gameState.ticket[row][col] === num) {
                gameState.markedNumbers.add(num);
                updateTicketDisplay();
                return;
            }
        }
    }
}

function updateTicketDisplay() {
    const grid = document.getElementById('ticketGrid');
    grid.innerHTML = '';

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
            const num = gameState.ticket[row][col];
            const cell = document.createElement('div');
            cell.className = 'ticket-cell';

            if (num === 0) {
                cell.classList.add('empty');
            } else {
                cell.textContent = num;
                if (gameState.markedNumbers.has(num)) {
                    cell.classList.add('marked');
                }
            }
            grid.appendChild(cell);
        }
    }

    let marked = 0;
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
            const num = gameState.ticket[row][col];
            if (num !== 0 && gameState.markedNumbers.has(num)) {
                marked++;
            }
        }
    }

    const total = 15;
    document.getElementById('markedCount').textContent = marked;
    document.getElementById('remainingCount').textContent = total - marked;
    document.getElementById('progressPercent').textContent = `${Math.round((marked / total) * 100)}%`;
}

function updateCalledNumbers() {
    const adminList = document.getElementById('calledNumbersList');
    const playerList = document.getElementById('playerCalledNumbers');

    const html = gameState.calledNumbers.map(num => `
        <div style="background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; padding: 8px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 0.95em;">${num}</div>
    `).join('');

    if (adminList) adminList.innerHTML = html || '<p style="grid-column: 1/-1; text-align: center; color: #999;">No numbers called</p>';
    if (playerList) playerList.innerHTML = html || '<p style="grid-column: 1/-1; text-align: center; color: #999;">No numbers called</p>';
}

function updatePlayerLists() {
    const adminList = document.getElementById('playersListAdmin');
    const playerList = document.getElementById('playersList');

    const html = Array.from(gameState.players.entries()).map(([id, name]) => `
        <div class="player-item">
            <span>👤 ${name || `Player ${id.substring(0, 6)}`}</span>
            <span style="color: var(--success); font-weight: 700;">●</span>
        </div>
    `).join('');

    if (adminList) adminList.innerHTML = html || '<p style="color: #999;">Waiting for players...</p>';
    if (playerList) playerList.innerHTML = html || '<p style="color: #999;">Connecting...</p>';
}

function updateWinners() {
    const list = document.getElementById('winnersListAdmin');
    const html = gameState.winners.map(w => `
        <div class="winner-item">
            <span>🏆 ${w.name}</span>
            <span style="background: ${w.tieDetected ? '#FFB84D' : 'var(--gold)'}; color: var(--dark); padding: 3px 10px; border-radius: 8px; font-size: 0.85em;">
                ${w.tieDetected ? `TIE x${w.tieCount}` : w.type}
            </span>
        </div>
    `).join('');
    if (list) list.innerHTML = html || '<p style="color: #999;">No winners yet</p>';
}

function claimWin(winType) {
    ws.send(JSON.stringify({
        type: 'claim_win',
        gameId: gameState.gameId,
        playerId: gameState.playerId,
        winType: winType,
        markedNumbers: Array.from(gameState.markedNumbers)
    }));
}

function showPlayerMessage(text, type) {
    const container = document.getElementById('playerMessages');
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : 'info'}-circle"></i> ${text}`;
    container.appendChild(msg);
    setTimeout(() => msg.remove(), 4000);
}

function showMessage(elementId, text, type) {
    const elem = document.getElementById(elementId);
    elem.innerHTML = `<div class="message ${type}"><i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i> ${text}</div>`;
}

function speakNumber(num) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(`Number ${num}`);
        utterance.rate = 0.8;
        speechSynthesis.speak(utterance);
    }
}

function generateGameId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateId() {
    return Math.random().toString(36).substring(2, 11);
}

function logout() {
    showLoader();
    setTimeout(() => {
        // Stop auto-draw timer
        stopAutoDrawTimer();
        
        gameState.role = null;
        gameState.playerName = null;
        gameState.gameId = null;
        gameState.ticket = null;
        gameState.markedNumbers.clear();
        gameState.calledNumbers = [];
        gameState.players.clear();
        gameState.winners = [];
        selectedCustomNumbers.clear();

        if (ws) {
            ws.close();
            ws = null;
        }

        backToMain();
    }, 300);
}

// Handle URL parameters
const params = new URLSearchParams(window.location.search);
if (params.get('game')) {
    document.getElementById('gameCodeInput').value = params.get('game');
}

// Hide loader when page is fully loaded
window.addEventListener('load', function() {
    setTimeout(function() {
        const loader = document.getElementById('pageLoader');
        if (loader) {
            loader.classList.add('hidden');
        }
    }, 800);
});

// Game code input listener
document.addEventListener('DOMContentLoaded', function() {
    const gameCodeInput = document.getElementById('gameCodeInput');
    if (gameCodeInput) {
        gameCodeInput.addEventListener('input', checkJoinButtonState);
        gameCodeInput.addEventListener('change', checkJoinButtonState);
    }
});

// Enter key support
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const activeId = document.activeElement.id;
        if (activeId === 'numberInput') announceNumber();
        else if (activeId === 'adminPassword' || activeId === 'adminUsername') handleAdminLogin();
        else if (activeId === 'playerLoginName') searchPlayerTickets();
        else if (activeId === 'purchasePlayerName') useSuggestedNumbers();
        else if (activeId === 'gameCodeInput') joinGame();
    }
});
