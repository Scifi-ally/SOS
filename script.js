const firebaseConfig = {
    apiKey: "AIzaSyDxmmnQMTfoTBGarz65NdHm1t3NyxWM-rE",
    authDomain: "soapp-80936.firebaseapp.com",
    projectId: "soapp-80936",
    storageBucket: "soapp-80936.firebasestorage.app",
    messagingSenderId: "152328551150",
    appId: "1:152328551150:web:211ab46d98e41560d1d1ff",
    measurementId: "G-2ZVT8KSKHR"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const authForm = document.getElementById('auth-form');
const signupForm = document.getElementById('signup-form');
const mapContainer = document.getElementById('map-container');
const bottomSheet = document.getElementById('bottom-sheet');
const profilePage = document.getElementById('profile-page');
const navigation = document.getElementById('navigation');
const loadingOverlay = document.getElementById('loading-overlay');
const toast = document.getElementById('toast');
let map, placesService, currentPosition, directionsService, directionsRenderer, currentLocationMarker, startAutocomplete, endAutocomplete;

const showLoading = () => loadingOverlay.style.display = 'flex';
const hideLoading = () => loadingOverlay.style.display = 'none';
const showToast = (message, type = 'info', button = null, callback = null) => {
    toast.innerHTML = message + (button ? ` <button id="toast-btn">${button}</button>` : '');
    toast.className = `toast active ${type}`;
    setTimeout(() => toast.classList.remove('active'), 5000);
    if (button && callback) document.getElementById('toast-btn').addEventListener('click', callback);
};
const showError = (elementId, message) => {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.classList.add('active');
    setTimeout(() => errorElement.classList.remove('active'), 5000);
    showToast(message, 'error');
};
const generateEmergencyKey = () => 'SOAPP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
const validateEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = phone => phone === '' || /^\+?[\d\s-]{8,15}$/.test(phone);
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
};

async function loadGoogleMapsScript() {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) return resolve();
        const script = document.createElement('script');
        script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyA41wHVKnsb1RNhcftpHS5qNwvYz59nXIE&libraries=places,directions&callback=initMap';
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

const showMainInterface = () => {
    showLoading();
    authForm.classList.remove('active');
    signupForm.classList.remove('active');
    mapContainer.classList.add('active');
    navigation.classList.add('active');
    bottomSheet.classList.add('active');
    bottomSheet.style.transform = 'translateY(calc(100% - 25px))';
    profilePage.classList.remove('active');
    requestAnimationFrame(() => {
        setupBottomSheet();
        setupNavigation();
        setupNotificationListener();
        hideLoading();
    });
};

const handleSignIn = async (e) => {
    e.preventDefault();
    showLoading();
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value.trim();
    if (!validateEmail(email)) {
        showError('signin-error-message', 'Please enter a valid email.');
        hideLoading();
        return;
    }
    if (password.length < 6) {
        showError('signin-error-message', 'Password must be at least 6 characters.');
        hideLoading();
        return;
    }
    try {
        await auth.signInWithEmailAndPassword(email, password);
        await loadGoogleMapsScript();
        showMainInterface();
        showToast('Logged in successfully!', 'success');
    } catch (error) {
        let errorMessage = 'Login failed. Please try again.';
        switch (error.code) {
            case 'auth/user-not-found': errorMessage = 'No account found with this email.'; break;
            case 'auth/wrong-password': errorMessage = 'Incorrect password.'; break;
            case 'auth/network-request-failed': errorMessage = 'Network error.'; break;
            case 'auth/too-many-requests': errorMessage = 'Too many attempts.'; break;
        }
        showError('signin-error-message', errorMessage);
    }
    hideLoading();
};

const handleSignUp = async (e) => {
    e.preventDefault();
    showLoading();
    const fullName = document.getElementById('signup-fullname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    if (!fullName) {
        showError('signup-error-message', 'Please enter your full name.');
        hideLoading();
        return;
    }
    if (!validateEmail(email)) {
        showError('signup-error-message', 'Please enter a valid email.');
        hideLoading();
        return;
    }
    if (password.length < 6) {
        showError('signup-error-message', 'Password must be at least 6 characters.');
        hideLoading();
        return;
    }
    if (phone && !validatePhone(phone)) {
        showError('signup-error-message', 'Please enter a valid phone number.');
        hideLoading();
        return;
    }
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            fullName, email, phone, emergencyKey: generateEmergencyKey(),
            emergencyContacts: [], createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await loadGoogleMapsScript();
        showMainInterface();
        showToast('Account created!', 'success');
    } catch (error) {
        let errorMessage = 'Sign-up failed.';
        if (error.code === 'auth/email-already-in-use') errorMessage = 'Email already in use.';
        showError('signup-error-message', errorMessage);
    }
    hideLoading();
};

authForm.addEventListener('submit', handleSignIn);
signupForm.addEventListener('submit', handleSignUp);
document.getElementById('show-signup').addEventListener('click', () => {
    authForm.classList.remove('active');
    signupForm.classList.add('active');
});
document.getElementById('show-signin').addEventListener('click', () => {
    signupForm.classList.remove('active');
    authForm.classList.add('active');
});
document.getElementById('back-to-signin').addEventListener('click', () => {
    signupForm.classList.remove('active');
    authForm.classList.add('active');
});
document.getElementById('forgot-password').addEventListener('click', async () => {
    const email = document.getElementById('signin-email').value.trim();
    if (!validateEmail(email)) {
        showError('signin-error-message', 'Invalid email.');
        return;
    }
    showLoading();
    try {
        await auth.sendPasswordResetEmail(email);
        showToast('Password reset email sent!', 'success');
    } catch (error) {
        showError('signin-error-message', error.message);
    }
    hideLoading();
});

window.initMap = function() {
    const blackAndWhiteStyle = [
        { elementType: "geometry", stylers: [{ color: "#212121" }] },
        { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
        { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] }
    ];
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 37.7749, lng: -122.4194 },
        zoom: 14,
        styles: blackAndWhiteStyle,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    });
    placesService = new google.maps.places.PlacesService(map);
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#ffffff', strokeWeight: 5 }
    });
    startAutocomplete = new google.maps.places.Autocomplete(document.getElementById('start-point'));
    startAutocomplete.bindTo('bounds', map);
    endAutocomplete = new google.maps.places.Autocomplete(document.getElementById('end-point'));
    endAutocomplete.bindTo('bounds', map);
    getCurrentLocation();
    ['zoom-in', 'zoom-out', 'center-map'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
            if (id === 'zoom-in') map.setZoom(map.getZoom() + 1);
            else if (id === 'zoom-out' && map.getZoom() > 1) map.setZoom(map.getZoom() - 1);
            else if (currentPosition) map.panTo(currentPosition);
            else getCurrentLocation();
        });
    });
    document.getElementById('set-current-location').addEventListener('click', () => {
        if (currentPosition) {
            document.getElementById('start-point').value = 'My Location';
            showToast('Starting point set to current location', 'success');
        } else {
            showToast('Location unavailable, please enable location services', 'error');
            getCurrentLocation();
        }
    });
};

function getCurrentLocation() {
    if (!navigator.geolocation) return showToast('Geolocation not supported.', 'error');
    navigator.geolocation.getCurrentPosition(
        position => {
            currentPosition = { lat: position.coords.latitude, lng: position.coords.longitude };
            map.setCenter(currentPosition);
            if (currentLocationMarker) currentLocationMarker.setMap(null);
            currentLocationMarker = new google.maps.Marker({
                position: currentPosition,
                map: map,
                title: 'Your Location',
                icon: { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' }
            });
            findNearbySafetyPoints(currentPosition);
        },
        () => {
            showToast('Please enable location services.', 'error', 'Turn On', getCurrentLocation);
            map.setCenter({ lat: 37.7749, lng: -122.4194 });
        },
        { timeout: 10000, enableHighAccuracy: true }
    );
}

function findNearbySafetyPoints(location) {
    const safetyTypes = ['police', 'hospital'];
    let allResults = [];
    safetyTypes.forEach(type => {
        placesService.nearbySearch({ location, radius: 5000, type }, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                results.forEach(place => {
                    place.type = type;
                    place.distance = calculateDistance(location.lat, location.lng, place.geometry.location.lat(), place.geometry.location.lng());
                    allResults.push(place);
                });
                allResults.sort((a, b) => a.distance - b.distance);
                displayPlaces(allResults, true);
            } else {
                showToast('Failed to fetch nearby safety points.', 'error');
            }
        });
    });
}

function displayPlaces(places, isNearby = true) {
    const placesList = document.getElementById('places-list');
    const activeCategory = document.querySelector('.category.active').dataset.type;
    placesList.innerHTML = '';
    const filteredPlaces = activeCategory === 'all' ? places : places.filter(place => place.type === activeCategory);
    if (!filteredPlaces.length) {
        placesList.innerHTML = '<p>No places found.</p>';
    } else {
        filteredPlaces.forEach(place => {
            const placeItem = document.createElement('div');
            placeItem.classList.add('place-item');
            const iconClass = place.type === 'police' ? 'fas fa-shield-alt' : 'fas fa-hospital';
            placeItem.innerHTML = `
                <div class="place-icon"><i class="${iconClass}"></i></div>
                <div class="place-info">
                    <div class="place-name">${place.name}</div>
                    <div class="place-address">${place.vicinity || place.formatted_address}</div>
                    ${isNearby ? `<div class="place-distance">${place.distance} km away</div>` : ''}
                </div>
            `;
            placeItem.addEventListener('click', () => {
                map.panTo(place.geometry.location);
                map.setZoom(16);
                directionsRenderer.setDirections(null);
                if (isNearby && currentPosition) {
                    directionsService.route({ 
                        origin: currentPosition, 
                        destination: place.geometry.location, 
                        travelMode: 'WALKING' 
                    }, (response, status) => {
                        if (status === 'OK') directionsRenderer.setDirections(response);
                        else showToast('Route calculation failed.', 'error');
                    });
                }
            });
            placesList.appendChild(placeItem);
        });
    }
    document.querySelector('.section-title').textContent = `Nearby Safety Points (${filteredPlaces.length})`;
}

function setupBottomSheet() {
    const customSheet = document.getElementById('bottom-sheet');
    customSheet.classList.add('active');
    const sheetHeight = customSheet.offsetHeight;
    const minimizedPosition = sheetHeight - 25;
    let startY = minimizedPosition;
    let currentY = startY;
    const snapPositions = [0, sheetHeight * 0.25, sheetHeight * 0.60, minimizedPosition];
    customSheet.style.transform = `translateY(${currentY}px)`;
    const mc = new Hammer.Manager(customSheet);
    mc.add(new Hammer.Pan({ threshold: 0, pointers: 0, direction: Hammer.DIRECTION_VERTICAL }));
    mc.on('panstart', e => { 
        startY = currentY; 
        customSheet.style.transition = 'none';
    });
    mc.on('panmove', e => {
        let newY = startY + e.deltaY;
        newY = Math.max(0, Math.min(newY, minimizedPosition));
        currentY = newY;
        customSheet.style.transform = `translateY(${currentY}px)`;
    });
    mc.on('panend', e => {
        customSheet.style.transition = 'transform 0.3s ease-out';
        const closestSnap = snapPositions.reduce((prev, curr) => 
            Math.abs(curr - currentY) < Math.abs(prev - currentY) ? curr : prev
        );
        currentY = closestSnap;
        customSheet.style.transform = `translateY(${currentY}px)`;
        document.body.className = currentY === 0 ? 'expanded' : 
            (currentY === minimizedPosition ? 'minimized' : 
            (currentY === sheetHeight * 0.25 ? 'quarter-expanded' : 'semi-expanded'));
    });
    mc.add(new Hammer.Tap());
    mc.on('tap', e => {
        if (!customSheet.contains(e.target)) return;
        if (document.body.classList.contains('minimized')) {
            currentY = 0;
            customSheet.style.transform = `translateY(${currentY}px)`;
            document.body.classList.remove('minimized');
            document.body.classList.add('expanded');
        }
    });
    document.addEventListener('click', e => {
        if (!customSheet.contains(e.target) && mapContainer.contains(e.target) && !document.body.classList.contains('minimized')) {
            currentY = minimizedPosition;
            customSheet.style.transform = `translateY(${currentY}px)`;
            document.body.classList.add('minimized');
            document.body.classList.remove('expanded', 'quarter-expanded', 'semi-expanded');
        }
    });
    document.querySelectorAll('.category').forEach(category => {
        category.addEventListener('click', () => {
            document.querySelectorAll('.category').forEach(cat => cat.classList.remove('active'));
            category.classList.add('active');
            if (currentPosition) findNearbySafetyPoints(currentPosition);
        });
    });
    document.getElementById('calculate-route').addEventListener('click', () => {
        const startInput = document.getElementById('start-point').value;
        const endPlace = endAutocomplete.getPlace();
        if (!endPlace || !endPlace.geometry) {
            showToast('Please select a valid destination.', 'error');
            return;
        }
        const origin = startInput === 'My Location' && currentPosition ? currentPosition : startAutocomplete.getPlace()?.geometry?.location;
        if (!origin) {
            showToast('Please select a valid starting point.', 'error');
            return;
        }
        directionsService.route({
            origin: origin,
            destination: endPlace.geometry.location,
            travelMode: 'WALKING'
        }, (response, status) => {
            if (status === 'OK') {
                directionsRenderer.setDirections(response);
                map.fitBounds(response.routes[0].bounds);
                showToast('Route calculated!', 'success');
            } else {
                showToast('Route calculation failed.', 'error');
            }
        });
    });
}

function setupNavigation() {
    document.querySelectorAll('.list').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.list').forEach(li => li.classList.remove('active'));
            item.classList.add('active');
            if (item.id === 'map-nav') {
                mapContainer.classList.add('active');
                bottomSheet.classList.add('active');
                profilePage.classList.remove('active');
            } else {
                mapContainer.classList.remove('active');
                bottomSheet.classList.remove('active');
                profilePage.classList.add('active');
                loadProfile();
            }
        });
    });
    document.querySelector('.indicator').addEventListener('click', async () => {
        if (!confirm('Send SOS alert?')) return;
        showLoading();
        const user = auth.currentUser;
        if (!user) {
            showToast('Please log in to send SOS.', 'error');
            hideLoading();
            return;
        }
        if (!currentPosition) {
            showToast('Location unavailable.', 'error');
            hideLoading();
            return;
        }
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const contacts = userDoc.data().emergencyContacts || [];
            const emergencyMessage = document.getElementById('emergency-message').value.trim() || 'I need help!';
            if (!contacts.length) throw new Error('No emergency contacts.');
            const sosData = { 
                senderId: user.uid, 
                senderName: userDoc.data().fullName, 
                location: currentPosition, 
                message: emergencyMessage, 
                timestamp: firebase.firestore.FieldValue.serverTimestamp(), 
                status: 'active' 
            };
            await Promise.all(contacts.map(contactId => db.collection('notifications').doc(contactId).set(sosData)));
            showToast('SOS sent!', 'success');
        } catch (error) {
            showToast('SOS failed: ' + error.message, 'error');
        }
        hideLoading();
    });
}

async function loadProfile() {
    showLoading();
    const user = auth.currentUser;
    if (!user) {
        showToast('Please log in to view profile.', 'error');
        hideLoading();
        return;
    }
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data() || { fullName: user.displayName || 'User', email: user.email };
        document.getElementById('profile-name').textContent = userData.fullName || 'User';
        document.getElementById('profile-email').innerHTML = `<i class="fas fa-envelope"></i> ${userData.email || 'N/A'}`;
        document.getElementById('profile-phone').innerHTML = `<i class="fas fa-phone"></i> ${userData.phone || 'Not provided'}`;
        document.getElementById('emergency-key').textContent = userData.emergencyKey || 'N/A';
        document.getElementById('full-name').value = userData.fullName || '';
        document.getElementById('email-display').value = userData.email || '';
        document.getElementById('phone').value = userData.phone || '';
        document.getElementById('emergency-message').value = userData.emergencyMessage || 'I need help!';
        document.getElementById('safety-status').textContent = 'Status: Safe';
        document.getElementById('last-verified').textContent = `Verified: ${new Date().toLocaleString()}`;
        const contactList = document.getElementById('contact-list');
        contactList.innerHTML = '';
        const contacts = userData.emergencyContacts || [];
        if (contacts.length) {
            await Promise.all(contacts.map(async contactId => {
                const contactDoc = await db.collection('users').doc(contactId).get();
                if (contactDoc.exists) {
                    const contactData = contactDoc.data();
                    contactList.innerHTML += `
                        <div class="contact-item">
                            <div class="contact-avatar">${contactData.fullName[0]}</div>
                            <div class="contact-info">
                                <div class="contact-name">${contactData.fullName}</div>
                                <div class="place-address">${contactData.email}</div>
                            </div>
                            <button class="btn btn-outline" onclick="removeContact('${contactId}')">Remove</button>
                        </div>
                    `;
                }
            }));
        } else {
            contactList.innerHTML = '<p>No emergency contacts added.</p>';
        }
    } catch (error) {
        showToast('Failed to load profile: ' + error.message, 'error');
    }
    hideLoading();
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
    document.getElementById('edit-profile').addEventListener('click', () => {
        const editSection = document.getElementById('edit-section');
        const inputs = editSection.querySelectorAll('input, textarea');
        const saveBtn = document.getElementById('save-changes');
        editSection.classList.toggle('active');
        inputs.forEach(input => input.readOnly = !input.readOnly);
        saveBtn.disabled = !saveBtn.disabled;
    });
    document.getElementById('save-changes').addEventListener('click', async () => {
        showLoading();
        const fullName = document.getElementById('full-name').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const emergencyMessage = document.getElementById('emergency-message').value.trim();
        if (!fullName) {
            showToast('Full name is required.', 'error');
            hideLoading();
            return;
        }
        if (phone && !validatePhone(phone)) {
            showToast('Invalid phone number.', 'error');
            hideLoading();
            return;
        }
        try {
            await db.collection('users').doc(user.uid).update({ fullName, phone, emergencyMessage });
            document.getElementById('profile-name').textContent = fullName;
            document.getElementById('profile-phone').innerHTML = `<i class="fas fa-phone"></i> ${phone || 'Not provided'}`;
            showToast('Profile updated!', 'success');
            document.getElementById('edit-section').classList.remove('active');
            document.getElementById('edit-section').querySelectorAll('input, textarea').forEach(input => input.readOnly = true);
            document.getElementById('save-changes').disabled = true;
        } catch (error) {
            showToast('Update failed: ' + error.message, 'error');
        }
        hideLoading();
    });
    document.getElementById('sign-out').addEventListener('click', async () => {
        showLoading();
        try {
            await auth.signOut();
            profilePage.classList.remove('active');
            mapContainer.classList.remove('active');
            bottomSheet.classList.remove('active');
            navigation.classList.remove('active');
            authForm.classList.add('active');
            showToast('Logged out successfully.', 'success');
        } catch (error) {
            showToast('Logout failed: ' + error.message, 'error');
        }
        hideLoading();
    });
    document.getElementById('add-contact-btn').addEventListener('click', () => {
        document.getElementById('add-contact-form').classList.add('active');
    });
    document.getElementById('cancel-contact-btn').addEventListener('click', () => {
        document.getElementById('add-contact-form').classList.remove('active');
        document.getElementById('contact-key-input').value = '';
    });
    document.getElementById('submit-contact-btn').addEventListener('click', async () => {
        showLoading();
        const key = document.getElementById('contact-key-input').value.trim();
        if (!key.startsWith('SOAPP-')) {
            showError('add-contact-error', 'Invalid safety key format.');
            hideLoading();
            return;
        }
        try {
            const snapshot = await db.collection('users').where('emergencyKey', '==', key).get();
            if (snapshot.empty) throw new Error('No user found with this key.');
            const contactDoc = snapshot.docs[0];
            const contactId = contactDoc.id;
            if (contactId === user.uid) throw new Error('Cannot add yourself.');
            const userDoc = await db.collection('users').doc(user.uid).get();
            const contacts = userDoc.data().emergencyContacts || [];
            if (contacts.includes(contactId)) throw new Error('Contact already added.');
            contacts.push(contactId);
            await db.collection('users').doc(user.uid).update({ emergencyContacts: contacts });
            showToast('Contact added!', 'success');
            document.getElementById('add-contact-form').classList.remove('active');
            document.getElementById('contact-key-input').value = '';
            loadProfile();
        } catch (error) {
            showError('add-contact-error', error.message);
        }
        hideLoading();
    });
    document.getElementById('key-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(document.getElementById('emergency-key').textContent);
        showToast('Key copied!', 'success');
    });
}

async function removeContact(contactId) {
    if (!confirm('Remove this contact?')) return;
    showLoading();
    const user = auth.currentUser;
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const contacts = userDoc.data().emergencyContacts || [];
        const updatedContacts = contacts.filter(id => id !== contactId);
        await db.collection('users').doc(user.uid).update({ emergencyContacts: updatedContacts });
        showToast('Contact removed!', 'success');
        loadProfile();
    } catch (error) {
        showToast('Failed to remove contact: ' + error.message, 'error');
    }
    hideLoading();
}

function setupNotificationListener() {
    const user = auth.currentUser;
    if (!user) return;
    db.collection('notifications').doc(user.uid).onSnapshot(doc => {
        if (doc.exists && doc.data().status === 'active') {
            const { senderName, message, location } = doc.data();
            showToast(`SOS from ${senderName}: ${message}`, 'error', 'View', () => {
                map.panTo(location);
                map.setZoom(15);
                directionsService.route({ 
                    origin: currentPosition, 
                    destination: location, 
                    travelMode: 'WALKING' 
                }, (response, status) => {
                    if (status === 'OK') directionsRenderer.setDirections(response);
                });
                db.collection('notifications').doc(user.uid).update({ status: 'viewed' });
            });
        }
    });
}

auth.onAuthStateChanged(user => {
    if (user) {
        loadGoogleMapsScript().then(() => showMainInterface());
    } else {
        authForm.classList.add('active');
        mapContainer.classList.remove('active');
        navigation.classList.remove('active');
        bottomSheet.classList.remove('active');
        profilePage.classList.remove('active');
    }
});