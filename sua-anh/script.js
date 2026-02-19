document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const imageInput = document.getElementById('imageInput');
    const logoInput = document.getElementById('logoInput');
    const previewImage = document.getElementById('previewImage');
    const logoImage = document.getElementById('logoImage');
    const overlay = document.getElementById('overlay');
    const placeholderText = document.getElementById('placeholderText');
    const captureTarget = document.getElementById('captureTarget');

    const nameInput = document.getElementById('nameInput');
    const dateInput = document.getElementById('dateInput');
    const timeInput = document.getElementById('timeInput');
    const useCurrentTimeCheckbox = document.getElementById('useCurrentTime');
    const coordsInput = document.getElementById('coordsInput');
    const getLocationBtn = document.getElementById('getLocationBtn');
    const openMapBtn = document.getElementById('openMapBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // Display Elements
    const displayName = document.getElementById('displayName');
    const displayTime = document.getElementById('displayTime');
    const displayDate = document.getElementById('displayDate');
    const displayDay = document.getElementById('displayDay');
    const displayCoords = document.getElementById('displayCoords');

    let timeInterval;

    // Helper: Format date to dd/mm/yyyy
    const formatDate = (date) => {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    };

    // Helper: Format time to HH:MM
    const formatTime = (date) => {
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        return `${h}:${min}`;
    };

    // Helper: Get Day of week (th2, th3, etc)
    const getDayOfWeek = (date) => {
        const day = date.getDay(); // 0 = Sunday
        if (day === 0) return 'CN';
        return `th${day + 1}`;
    };

    // Update Time Display
    const updateTimeDisplay = () => {
        const now = new Date();

        if (useCurrentTimeCheckbox.checked) {
            // Update inputs to reflect current time
            dateInput.valueAsDate = now; // sets YYYY-MM-DD
            // timeInput requires HH:MM string
            timeInput.value = formatTime(now);

            displayTime.textContent = formatTime(now);
            displayDate.textContent = formatDate(now);
            displayDay.textContent = getDayOfWeek(now);
        } else {
            // Manual update from inputs
            if (timeInput.value) displayTime.textContent = timeInput.value;

            if (dateInput.value) {
                const dateParts = dateInput.value.split('-');
                if (dateParts.length === 3) {
                    const dateObj = new Date(dateInput.value);
                    displayDate.textContent = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                    displayDay.textContent = getDayOfWeek(dateObj);
                }
            }
        }
    };

    // Initial load
    updateTimeDisplay();
    timeInterval = setInterval(updateTimeDisplay, 1000);

    // Event Listeners
    useCurrentTimeCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            updateTimeDisplay();
            timeInterval = setInterval(updateTimeDisplay, 1000);
            timeInput.disabled = true;
            dateInput.disabled = true;
        } else {
            clearInterval(timeInterval);
            timeInput.disabled = false;
            dateInput.disabled = false;
        }
    });

    // Handle Manual Inputs
    nameInput.addEventListener('input', (e) => {
        displayName.textContent = e.target.value || '';
    });

    coordsInput.addEventListener('input', (e) => {
        displayCoords.textContent = `Tọa độ: ${e.target.value}`;
    });

    timeInput.addEventListener('input', () => {
        if (!useCurrentTimeCheckbox.checked) updateTimeDisplay();
    });

    dateInput.addEventListener('input', () => {
        if (!useCurrentTimeCheckbox.checked) updateTimeDisplay();
    });

    // Image Upload
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                previewImage.src = event.target.result;
                previewImage.style.display = 'block';
                overlay.style.display = 'flex'; // Show overlay
                placeholderText.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    // Logo Upload
    logoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                logoImage.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Geolocation
    getLocationBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            getLocationBtn.textContent = '⏳';
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude.toFixed(6);
                    const long = position.coords.longitude.toFixed(6);
                    const coords = `${lat}, ${long}`;
                    coordsInput.value = coords;
                    displayCoords.textContent = `Tọa độ: ${coords}`;
                    getLocationBtn.textContent = '📍';
                },
                (error) => {
                    alert('Lỗi lấy tọa độ: ' + error.message);
                    getLocationBtn.textContent = '📍';
                }
            );
        } else {
            alert('Trình duyệt không hỗ trợ Geolocation');
        }
    });

    // Open Map Modal
    const mapModal = document.getElementById('mapModal');
    const closeBtn = document.querySelector('.close-btn');
    const confirmCoordsBtn = document.getElementById('confirmCoordsBtn');
    let map, marker, selectedCoords;

    openMapBtn.addEventListener('click', () => {
        mapModal.style.display = 'flex';

        // Initialize Map if not exists
        if (!map) {
            // Default to Di Linh coords or current coordsInput
            let initialLat = 11.539336;
            let initialLng = 107.944720;

            const currentCoords = coordsInput.value.split(',').map(s => parseFloat(s.trim()));
            if (currentCoords.length === 2 && !isNaN(currentCoords[0]) && !isNaN(currentCoords[1])) {
                initialLat = currentCoords[0];
                initialLng = currentCoords[1];
            }

            map = L.map('map').setView([initialLat, initialLng], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            marker = L.marker([initialLat, initialLng]).addTo(map);

            // Map Click Event
            map.on('click', (e) => {
                const lat = e.latlng.lat;
                const lng = e.latlng.lng;

                if (marker) {
                    marker.setLatLng([lat, lng]);
                } else {
                    marker = L.marker([lat, lng]).addTo(map);
                }

                selectedCoords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                // Optional: Update popup
                marker.bindPopup(`Tọa độ đã chọn: ${selectedCoords}`).openPopup();
            });
        }

        // Invalidate size to ensure map renders correctly after modal show
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    });

    closeBtn.addEventListener('click', () => {
        mapModal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target == mapModal) {
            mapModal.style.display = 'none';
        }
    });

    confirmCoordsBtn.addEventListener('click', () => {
        if (selectedCoords) {
            coordsInput.value = selectedCoords;
            displayCoords.textContent = `Tọa độ: ${selectedCoords}`;
            mapModal.style.display = 'none';
        } else if (marker) {
            // If user didn't click but just wants current marker pos
            const pos = marker.getLatLng();
            const coords = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
            coordsInput.value = coords;
            displayCoords.textContent = `Tọa độ: ${coords}`;
            mapModal.style.display = 'none';
        } else {
            alert('Vui lòng chọn một điểm trên bản đồ');
        }
    });

    // Download Image
    downloadBtn.addEventListener('click', () => {
        if (!previewImage.src || previewImage.style.display === 'none') {
            alert('Vui lòng chọn ảnh trước!');
            return;
        }

        // Use html2canvas to capture the div
        html2canvas(captureTarget, {
            useCORS: true,
            scale: 2,
            allowTaint: true, // Allow local images
            logging: false,
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `viettel_stamp_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            console.error(err);
            alert('Lỗi khi tạo ảnh download');
        });
    });
});
