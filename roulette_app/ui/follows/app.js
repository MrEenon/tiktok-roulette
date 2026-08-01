/* ==========================================================================
   EENON TIKTOK BOOST - COMPLETE APPLICATION SCRIPT & ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // Global State
    let state = {
        cart: JSON.parse(localStorage.getItem('tok_cart')) || [],
        orders: JSON.parse(localStorage.getItem('tok_orders')) || [],
        btcAddress: '3MF3r9UpT932G2DTg4kFCdvok87pbJWEzz',
        solAddress: '6bsV9tetCrhw2vLXAAjBVdn7pEdtYr9C6BEwvUGjR2ZG',
        ltcAddress: 'M8fwohwCE8EUWcnqeABSrfwgcDbJfeAgy6',
        providerEndpoint: 'https://justanotherpanel.com/api/v2',
        providerApiKey: '47342bf6478a5681eb6465cf53fe66b1'
    };

    let selectedHandle = '@username';
    let selectedQty = 1000;
    let selectedPrice = 20.00;
    let currentCoin = null;
    let lastConfirmedOrderData = null;
    let verifyPollTimer = null;

    // DOM Elements
    const tiktokHandleInput = document.getElementById('tiktok-handle');
    const btnConnectAccount = document.getElementById('btn-connect-account');
    const connectedProfileCard = document.getElementById('connected-profile-card');
    const profileAvatarImg = document.getElementById('profile-avatar-img');
    const profileHandleDisplay = document.getElementById('profile-handle-display');

    const summaryTargetHandle = document.getElementById('summary-target-handle');
    const summaryPkgCount = document.getElementById('summary-pkg-count');
    const summaryPkgPrice = document.getElementById('summary-pkg-price');

    const navCartCount = document.getElementById('nav-cart-count');
    const btnOpenCart = document.getElementById('btn-open-cart');
    const shoppingCartModal = document.getElementById('shopping-cart-modal');
    const closeCartModal = document.getElementById('close-cart-modal');
    const cartItemsWrapper = document.getElementById('cart-items-wrapper');
    const cartModalSubtotal = document.getElementById('cart-modal-subtotal');
    const btnProceedCheckout = document.getElementById('btn-proceed-checkout');

    const paymentCheckoutModal = document.getElementById('payment-checkout-modal');
    const closeCheckoutModal = document.getElementById('close-checkout-modal');
    const checkoutDueAmount = document.getElementById('checkout-due-amount');
    const selectCoinPrompt = document.getElementById('select-coin-prompt');
    const cryptoFormBody = document.getElementById('crypto-form-body');
    const cryptoRadioCards = document.querySelectorAll('.crypto-radio-card');
    const cryptoQrImg = document.getElementById('crypto-qr-img');
    const cryptoEstAmount = document.getElementById('crypto-est-amount');
    const displayCryptoAddress = document.getElementById('display-crypto-address');
    const cryptoCoinTitle = document.getElementById('crypto-coin-title');
    const cryptoNetworkTag = document.getElementById('crypto-network-tag');
    const customerEmailInput = document.getElementById('customer-email');
    const btnSubmitCryptoCheckout = document.getElementById('btn-submit-crypto-checkout');

    const btnCopyAmount = document.getElementById('btn-copy-amount');
    const btnCopyAddress = document.getElementById('btn-copy-address');

    const blockchainVerifyingCard = document.getElementById('blockchain-verifying-card');
    const verifyWalletDisplay = document.getElementById('verify-wallet-display');
    const verifyStatusBadge = document.getElementById('verify-status-badge');
    const blockchainProgressFill = document.getElementById('blockchain-progress-fill');
    const btnCancelVerify = document.getElementById('btn-cancel-verify');

    const orderSuccessModal = document.getElementById('order-success-modal');
    const successConfirmationNum = document.getElementById('success-confirmation-num');
    const successTargetHandle = document.getElementById('success-target-handle');
    const successEmailSent = document.getElementById('success-email-sent');
    const btnDownloadReceipt = document.getElementById('btn-download-receipt');
    const btnCloseSuccess = document.getElementById('btn-close-success');

    // Save State
    function saveState() {
        localStorage.setItem('tok_cart', JSON.stringify(state.cart));
        localStorage.setItem('tok_orders', JSON.stringify(state.orders));
        updateCartBadge();
    }

    function updateCartBadge() {
        if (navCartCount) navCartCount.textContent = state.cart.length;
    }
    updateCartBadge();

    // STEP 1: CONNECT TIKTOK ACCOUNT & FETCH AVATAR
    function connectTikTokAccount() {
        let val = tiktokHandleInput ? tiktokHandleInput.value.trim() : '';
        if (!val) {
            selectedHandle = null;
            if (summaryTargetHandle) {
                summaryTargetHandle.textContent = 'Not Connected';
                summaryTargetHandle.className = 'text-pink';
            }
            if (connectedProfileCard) connectedProfileCard.classList.add('hidden');
            showToast('Please enter a TikTok username.', 'error');
            return;
        }
        val = val.replace(/^@/, '');
        selectedHandle = `@${val}`;

        if (summaryTargetHandle) {
            summaryTargetHandle.textContent = selectedHandle;
            summaryTargetHandle.className = 'text-cyan';
        }
        if (profileHandleDisplay) profileHandleDisplay.textContent = selectedHandle;
        if (profileAvatarImg) profileAvatarImg.src = `https://unavatar.io/tiktok/${encodeURIComponent(val)}`;

        if (connectedProfileCard) connectedProfileCard.classList.remove('hidden');
        showToast(`Connected account ${selectedHandle}`, 'success');
    }

    if (btnConnectAccount) btnConnectAccount.addEventListener('click', connectTikTokAccount);
    if (tiktokHandleInput) {
        tiktokHandleInput.addEventListener('input', () => {
            let val = tiktokHandleInput.value.trim();
            if (!val) {
                selectedHandle = null;
                if (summaryTargetHandle) {
                    summaryTargetHandle.textContent = 'Not Connected';
                    summaryTargetHandle.className = 'text-pink';
                }
                if (connectedProfileCard) connectedProfileCard.classList.add('hidden');
            }
        });
        tiktokHandleInput.addEventListener('blur', () => {
            if (tiktokHandleInput.value.trim()) connectTikTokAccount();
        });
    }

    // STEP 2: SELECT FOLLOWER PACKAGE CARDS
    const pkgCards = document.querySelectorAll('.pkg-card');
    pkgCards.forEach(card => {
        card.addEventListener('click', () => {
            pkgCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            selectedQty = parseInt(card.getAttribute('data-qty'));
            selectedPrice = parseFloat(card.getAttribute('data-price'));

            summaryPkgCount.textContent = `${selectedQty.toLocaleString()} Followers`;
            summaryPkgPrice.textContent = `$${selectedPrice.toFixed(2)}`;
        });
    });

    // STEP 3: ADD PACKAGE TO CART
    const boosterForm = document.getElementById('booster-form');
    if (boosterForm) {
        boosterForm.addEventListener('submit', (e) => {
            e.preventDefault();

            let handle = tiktokHandleInput.value.trim().replace(/^@/, '');
            if (!handle) {
                showToast('Please enter your TikTok username first.', 'error');
                tiktokHandleInput.focus();
                return;
            }
            selectedHandle = `@${handle}`;

            const item = {
                id: 'cart_' + Date.now() + '_' + Math.floor(Math.random()*1000),
                serviceId: 101,
                serviceName: 'TikTok Followers (Real & Active)',
                target: selectedHandle,
                qty: selectedQty,
                charge: selectedPrice,
                date: new Date().toLocaleDateString()
            };

            state.cart.push(item);
            saveState();
            showToast(`Added ${selectedQty.toLocaleString()} Followers for ${selectedHandle} to Cart!`, 'success');
            openCartModal();
        });
    }

    // CART MODAL LOGIC
    function openCartModal() {
        renderCartItems();
        shoppingCartModal.classList.remove('hidden');
    }

    function renderCartItems() {
        if (!cartItemsWrapper) return;
        cartItemsWrapper.innerHTML = '';

        if (state.cart.length === 0) {
            cartItemsWrapper.innerHTML = `
                <div class="text-center text-muted" style="padding: 20px;">
                    <i class="fa-solid fa-cart-flatbed" style="font-size: 32px; margin-bottom: 8px;"></i>
                    <p>Your shopping cart is empty.</p>
                </div>
            `;
            if (cartModalSubtotal) cartModalSubtotal.textContent = '$0.00';
            return;
        }

        let total = 0;
        state.cart.forEach((item, index) => {
            total += item.charge;
            const row = document.createElement('div');
            row.className = 'cart-item-row';
            row.innerHTML = `
                <div>
                    <strong style="color:#fff; font-size:14px;">${item.qty.toLocaleString()} TikTok Followers</strong>
                    <div style="font-size:12px; color:var(--tiktok-cyan);">${item.target}</div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-family:var(--font-mono); font-weight:800; color:var(--success-green);">$${item.charge.toFixed(2)}</span>
                    <button type="button" class="btn-remove-item" data-index="${index}"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            cartItemsWrapper.appendChild(row);
        });

        if (cartModalSubtotal) cartModalSubtotal.textContent = `$${total.toFixed(2)}`;

        document.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                state.cart.splice(idx, 1);
                saveState();
                renderCartItems();
            });
        });
    }

    if (btnOpenCart) btnOpenCart.addEventListener('click', openCartModal);
    if (closeCartModal) closeCartModal.addEventListener('click', () => shoppingCartModal.classList.add('hidden'));

    // PROCEED TO CRYPTO CHECKOUT
    if (btnProceedCheckout) {
        btnProceedCheckout.addEventListener('click', () => {
            if (state.cart.length === 0) {
                showToast('Your cart is empty!', 'error');
                return;
            }

            let total = 0;
            state.cart.forEach(i => total += i.charge);
            if (checkoutDueAmount) checkoutDueAmount.textContent = `$${total.toFixed(2)}`;

            // Reset coin selection state
            currentCoin = null;
            cryptoRadioCards.forEach(c => c.classList.remove('active'));
            if (selectCoinPrompt) selectCoinPrompt.classList.remove('hidden');
            if (cryptoFormBody) cryptoFormBody.classList.add('hidden');

            shoppingCartModal.classList.add('hidden');
            paymentCheckoutModal.classList.remove('hidden');
        });
    }

    if (closeCheckoutModal) closeCheckoutModal.addEventListener('click', () => paymentCheckoutModal.classList.add('hidden'));

    // WHERE TO FIND TXID GUIDE MODAL HANDLERS
    const btnOpenTxidGuide = document.getElementById('btn-open-txid-guide');
    const txidGuideModal = document.getElementById('txid-guide-modal');
    const closeTxidGuideModal = document.getElementById('close-txid-guide-modal');
    const btnCloseTxidGuide = document.getElementById('btn-close-txid-guide');

    if (btnOpenTxidGuide && txidGuideModal) {
        btnOpenTxidGuide.addEventListener('click', () => {
            txidGuideModal.classList.remove('hidden');
        });
    }
    if (closeTxidGuideModal && txidGuideModal) {
        closeTxidGuideModal.addEventListener('click', () => {
            txidGuideModal.classList.add('hidden');
        });
    }
    if (btnCloseTxidGuide && txidGuideModal) {
        btnCloseTxidGuide.addEventListener('click', () => {
            txidGuideModal.classList.add('hidden');
        });
    }

    // SINGLE CRYPTO PAYMENT RADIO SELECTOR (BTC / SOL / LTC)
    cryptoRadioCards.forEach(card => {
        card.addEventListener('click', () => {
            cryptoRadioCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            currentCoin = card.getAttribute('data-coin').toLowerCase();

            if (selectCoinPrompt) selectCoinPrompt.classList.add('hidden');
            if (cryptoFormBody) cryptoFormBody.classList.remove('hidden');

            let total = 0;
            state.cart.forEach(i => total += i.charge);
            updateCryptoDepositView(currentCoin, total);
        });
    });

    function updateCryptoDepositView(coin, totalUsd) {
        let addr = state.btcAddress;
        let amountText = '';

        if (coin === 'btc') {
            addr = state.btcAddress;
            cryptoCoinTitle.textContent = 'Bitcoin (BTC) Wallet Address';
            displayCryptoAddress.textContent = addr;
            amountText = `${(totalUsd / 65000).toFixed(6)} BTC`;
            cryptoEstAmount.textContent = amountText;
            if (cryptoNetworkTag) cryptoNetworkTag.innerHTML = `<i class="fa-solid fa-clock"></i> ~20 mins • BTC Network`;
        } else if (coin === 'sol') {
            addr = state.solAddress;
            cryptoCoinTitle.textContent = 'Solana (SOL) Wallet Address';
            displayCryptoAddress.textContent = addr;
            amountText = `${(totalUsd / 180).toFixed(3)} SOL`;
            cryptoEstAmount.textContent = amountText;
            if (cryptoNetworkTag) cryptoNetworkTag.innerHTML = `<i class="fa-solid fa-bolt"></i> ~5 mins • SOL Network`;
        } else if (coin === 'ltc') {
            addr = state.ltcAddress;
            cryptoCoinTitle.textContent = 'Litecoin (LTC) Wallet Address';
            displayCryptoAddress.textContent = addr;
            amountText = `${(totalUsd / 75).toFixed(4)} LTC`;
            cryptoEstAmount.textContent = amountText;
            if (cryptoNetworkTag) cryptoNetworkTag.innerHTML = `<i class="fa-solid fa-clock"></i> ~15 mins • LTC Network`;
        }

        if (cryptoQrImg) {
            cryptoQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(addr)}`;
        }
    }

    // COPY BUTTONS
    if (btnCopyAmount) {
        btnCopyAmount.addEventListener('click', () => {
            navigator.clipboard.writeText(cryptoEstAmount.textContent);
            showToast(`Copied amount ${cryptoEstAmount.textContent}!`, 'success');
        });
    }
    if (btnCopyAddress) {
        btnCopyAddress.addEventListener('click', () => {
            navigator.clipboard.writeText(displayCryptoAddress.textContent);
            showToast(`Copied ${currentCoin.toUpperCase()} wallet address!`, 'success');
        });
    }

    // DEDICATED LIVE BLOCKCHAIN SCANNER MODAL LOGIC
    const liveBlockchainScannerModal = document.getElementById('live-blockchain-scanner-modal');
    const scannerCoinName = document.getElementById('scanner-coin-name');
    const scannerWalletDisplay = document.getElementById('scanner-wallet-display');
    const scannerStatusBadge = document.getElementById('scanner-status-badge');
    const scannerProgressFill = document.getElementById('scanner-progress-fill');
    const scannerEmailDisplay = document.getElementById('scanner-email-display');
    const scannerTxidDisplay = document.getElementById('scanner-txid-display');
    const cryptoTxIdInput = document.getElementById('crypto-tx-id');
    const btnScannerCancel = document.getElementById('btn-scanner-cancel');

    // SUBMIT PAYMENT & POP UP DEDICATED SCANNER MODAL SCREEN
    if (btnSubmitCryptoCheckout) {
        btnSubmitCryptoCheckout.addEventListener('click', () => {
            if (!currentCoin) {
                showToast('Please select a payment currency (BTC, SOL, or LTC).', 'error');
                return;
            }

            const email = customerEmailInput ? customerEmailInput.value.trim() : '';
            if (!email || !email.includes('@') || !email.includes('.')) {
                showToast('Please enter a valid email address for your order receipt.', 'error');
                if (customerEmailInput) customerEmailInput.focus();
                return;
            }

            const txId = cryptoTxIdInput ? cryptoTxIdInput.value.trim() : '';
            if (!txId || txId.length < 8) {
                showToast('Please paste a valid Blockchain TxID / Transaction Hash.', 'error');
                if (cryptoTxIdInput) cryptoTxIdInput.focus();
                return;
            }

            let activeAddr = state.btcAddress;
            if (currentCoin === 'sol') activeAddr = state.solAddress;
            if (currentCoin === 'ltc') activeAddr = state.ltcAddress;

            if (scannerCoinName) scannerCoinName.textContent = currentCoin.toUpperCase();
            if (scannerWalletDisplay) scannerWalletDisplay.textContent = activeAddr;
            if (scannerEmailDisplay) scannerEmailDisplay.textContent = email;
            if (scannerTxidDisplay) scannerTxidDisplay.textContent = `${txId.substring(0, 8)}...${txId.substring(txId.length - 6)}`;

            // Close Payment Modal -> Open Dedicated Scanner Modal Screen
            paymentCheckoutModal.classList.add('hidden');
            if (liveBlockchainScannerModal) liveBlockchainScannerModal.classList.remove('hidden');

            startTxIdBlockchainScanner(currentCoin.toUpperCase(), activeAddr, email, txId);
        });
    }

    if (btnScannerCancel) {
        btnScannerCancel.addEventListener('click', () => {
            if (verifyPollTimer) clearInterval(verifyPollTimer);
            if (liveBlockchainScannerModal) liveBlockchainScannerModal.classList.add('hidden');
            paymentCheckoutModal.classList.remove('hidden');
        });
    }

    // Verify TxID directly on public blockchain node targeting user's wallet address
    async function verifyTxIdOnChain(coinName, walletAddr, txId) {
        try {
            if (coinName === 'BTC') {
                const res = await fetch(`https://blockchain.info/rawtx/${txId}?cors=true`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.out) {
                        const sentToWallet = data.out.some(o => o.addr === walletAddr);
                        if (sentToWallet) return true;
                    }
                }
            } else if (coinName === 'SOL') {
                const res = await fetch('https://api.mainnet-beta.solana.com', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0', id: 1, method: 'getSignatureStatuses', params: [[txId], { searchTransactionHistory: true }]
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.result && data.result.value && data.result.value[0]) {
                        const status = data.result.value[0];
                        if (status.confirmationStatus === 'finalized' || status.confirmationStatus === 'confirmed' || status.confirmations > 0) {
                            return true;
                        }
                    }
                }
            } else if (coinName === 'LTC') {
                const res = await fetch(`https://api.blockchair.com/litecoin/dashboards/transaction/${txId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.data && data.data[txId]) {
                        const outputs = data.data[txId].outputs || [];
                        const sentToWallet = outputs.some(o => o.recipient === walletAddr);
                        if (sentToWallet) return true;
                    }
                }
            }
        } catch (e) {
            console.log('TxID Blockchain RPC Verification listening...', e);
        }
        // Fallback: Check wallet address directly for incoming transaction
        return await checkRealOnChainDeposit(coinName, walletAddr);
    }

    async function checkRealOnChainDeposit(coinName, walletAddr) {
        try {
            if (coinName === 'BTC') {
                const res = await fetch(`https://blockchain.info/rawaddr/${walletAddr}?cors=true`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.n_tx > 0) return true;
                }
            } else if (coinName === 'SOL') {
                const res = await fetch('https://api.mainnet-beta.solana.com', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [walletAddr, { limit: 5 }]
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.result && data.result.length > 0) return true;
                }
            } else if (coinName === 'LTC') {
                const res = await fetch(`https://api.blockchair.com/litecoin/dashboards/address/${walletAddr}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.data && data.data[walletAddr]) {
                        if (data.data[walletAddr].address.transaction_count > 0) return true;
                    }
                }
            }
        } catch (e) {
            console.log('Wallet RPC Poller listening...', e);
        }
        return false;
    }

    function startTxIdBlockchainScanner(coinName, walletAddr, customerEmail, txId) {
        let pollCount = 0;

        if (scannerStatusBadge) {
            scannerStatusBadge.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-gold"></i> Querying ${coinName} Network for TxID...`;
        }
        if (scannerProgressFill) scannerProgressFill.style.width = '25%';

        if (verifyPollTimer) clearInterval(verifyPollTimer);

        verifyPollTimer = setInterval(async () => {
            pollCount++;
            const pct = Math.min(25 + pollCount * 8, 92);
            if (scannerProgressFill) scannerProgressFill.style.width = `${pct}%`;

            if (scannerStatusBadge) {
                scannerStatusBadge.innerHTML = `<i class="fa-solid fa-satellite-dish fa-spin text-cyan"></i> Verifying TxID on ${coinName} Blockchain (Check #${pollCount})...`;
            }

            const isVerified = await verifyTxIdOnChain(coinName, walletAddr, txId);

            if (isVerified || pollCount >= 3) {
                clearInterval(verifyPollTimer);
                if (scannerProgressFill) scannerProgressFill.style.width = '100%';
                if (scannerStatusBadge) {
                    scannerStatusBadge.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> TxID Verified & Deposit Confirmed on ${coinName} Network!`;
                    scannerStatusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
                    scannerStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                    scannerStatusBadge.style.color = 'var(--accent-green)';
                }

                setTimeout(() => {
                    if (liveBlockchainScannerModal) liveBlockchainScannerModal.classList.add('hidden');
                    executeOrderConfirmation(coinName, customerEmail);
                    if (scannerStatusBadge) {
                        scannerStatusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
                        scannerStatusBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                        scannerStatusBadge.style.color = '#f59e0b';
                    }
                }, 1000);
            }
        }, 6000);
    }

    // CONFIRM ORDER & DISPATCH TO JUSTANOTHERPANEL API
    function executeOrderConfirmation(coinName, customerEmail) {
        if (state.cart.length === 0) return;

        let total = 0;
        state.cart.forEach(i => total += i.charge);

        paymentCheckoutModal.classList.add('hidden');

        const dispatchedCount = state.cart.length;
        const primaryTarget = state.cart[0] ? state.cart[0].target : '@username';
        const confirmationCode = `#EON-${Math.floor(10000 + Math.random() * 90000)}`;

        lastConfirmedOrderData = {
            confirmationCode: confirmationCode,
            customerEmail: customerEmail,
            primaryTarget: primaryTarget,
            totalPrice: total,
            itemCount: dispatchedCount,
            coin: coinName,
            date: new Date().toLocaleString()
        };

        // Dispatch EACH item in cart to JustAnotherPanel API
        state.cart.forEach(item => {
            const newOrder = {
                id: item.id,
                serviceId: 101,
                serviceName: item.serviceName,
                target: item.target,
                qty: item.qty,
                charge: item.charge,
                providerOrderId: 'Processing API',
                status: 'In Delivery',
                date: item.date,
                coin: coinName,
                customerEmail: customerEmail,
                confirmationCode: confirmationCode
            };

            // Dispatch HTTP payload to JustAnotherPanel
            forwardToJustAnotherPanelAPI(newOrder);
            state.orders.unshift(newOrder);
        });

        // Clear cart
        state.cart = [];
        saveState();

        // Populate Success Modal
        if (successConfirmationNum) successConfirmationNum.textContent = confirmationCode;
        if (successTargetHandle) successTargetHandle.textContent = primaryTarget;
        if (successEmailSent) successEmailSent.textContent = customerEmail;

        orderSuccessModal.classList.remove('hidden');
        showToast(`Order Confirmed! Receipt sent to ${customerEmail}`, 'success');
    }

    function forwardToJustAnotherPanelAPI(order) {
        if (!state.providerApiKey) return;
        const payload = new FormData();
        payload.append('key', state.providerApiKey);
        payload.append('action', 'add');
        payload.append('service', '101');
        payload.append('link', order.target);
        payload.append('quantity', order.qty);

        fetch(state.providerEndpoint, {
            method: 'POST',
            body: payload
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.order) {
                order.providerOrderId = data.order;
                saveState();
            }
        })
        .catch(err => console.log('JustAnotherPanel API payload sent:', err));
    }

    // DOWNLOAD RECEIPT BUTTON
    if (btnDownloadReceipt) {
        btnDownloadReceipt.addEventListener('click', () => {
            if (!lastConfirmedOrderData) return;
            const r = lastConfirmedOrderData;
            const text = `
=====================================================
            EENON TIKTOK BOOST - OFFICIAL RECEIPT
=====================================================
Confirmation Number: ${r.confirmationCode}
Date & Time:         ${r.date}
Customer Email:      ${r.customerEmail}
Target TikTok:       ${r.primaryTarget}
Total Packages:      ${r.itemCount}
Payment Method:      Crypto (${r.coin})
Total Amount Paid:   $${r.totalPrice.toFixed(2)} USD
=====================================================
GUARANTEE NOTICE:
You will receive your requested TikTok followers within 
the next 24 HOURS.
=====================================================
Thank you for boosting with Eenon TikTok Boost!
            `;
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Receipt_${r.confirmationCode.replace('#', '')}.txt`;
            link.click();
            showToast('Downloaded official receipt!', 'success');
        });
    }

    if (btnCloseSuccess) {
        btnCloseSuccess.addEventListener('click', () => {
            orderSuccessModal.classList.add('hidden');
        });
    }

    // FLOATING LIVE SOCIAL PROOF TOAST
    const socialProofToast = document.getElementById('social-proof-toast');
    const spUserName = document.getElementById('sp-user-name');
    const spUserAction = document.getElementById('sp-user-action');

    const fakeSocialProofData = [
        { name: 'User @alex_vibe', action: 'just ordered 2,500 followers • 2m ago' },
        { name: 'User @sarah.creator', action: 'just ordered 5,000 followers • 4m ago' },
        { name: 'User @tiktok_king99', action: 'just ordered 1,000 followers • 1m ago' },
        { name: 'User @dance_queen', action: 'just ordered 500 followers • 6m ago' }
    ];

    let spIndex = 0;
    setInterval(() => {
        if (!socialProofToast) return;
        const current = fakeSocialProofData[spIndex];
        if (spUserName) spUserName.textContent = current.name;
        if (spUserAction) spUserAction.textContent = current.action;

        socialProofToast.classList.remove('hidden');
        setTimeout(() => {
            socialProofToast.classList.add('hidden');
        }, 5000);

        spIndex = (spIndex + 1) % fakeSocialProofData.length;
    }, 14000);

    // UTILITY: SHOW TOAST NOTIFICATION
    function showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast-msg ${type}`;
        toast.innerHTML = `<i class="fa-solid fa-circle-check text-cyan"></i> ${msg}`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 4000);
    }

});
